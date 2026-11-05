"use server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, nearestCardBatches, nearestCards } from "@/db";
import { requireMainOwner } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { money } from "@/lib/time";
import { batchProblem, createCardBatch, endOfMonth, startOfDay, FREE_SQL, type CardKind } from "@/lib/nearest-cards";

type FormState = { error?: string; ok?: string };
const s = (f: FormData, k: string, max = 120) => String(f.get(k) ?? "").trim().slice(0, max);

async function owner() {
  try { return (await requireMainOwner()).user; } catch { return null; }
}

/** Owners: make a batch of cards to print. */
export async function createCards(_: FormState, form: FormData): Promise<FormState> {
  const user = await owner();
  if (!user) return { error: "Only the main owner can make Nearest Cards." };
  const kind = (s(form, "kind", 10) === "free" ? "free" : "discount") as CardKind;
  const amountCents = Math.round(Number(s(form, "amount", 10).replace(/[$,\s]/g, "")) * 100);
  const count = Number(s(form, "count", 6));
  const validThru = endOfMonth(s(form, "validThru", 7));
  const problem = batchProblem({ kind, amountCents, count, validThru });
  if (problem) return { error: problem };
  const handedOutAt = s(form, "handedOut", 10) ? startOfDay(s(form, "handedOut", 10)) : new Date();
  if (!handedOutAt) return { error: "Choose the date the cards are handed out." };
  const name = s(form, "name", 80) || `${kind === "free" ? "Free" : `$${amountCents / 100}`} cards ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}`;
  const { cardFund } = await import("@/lib/nearest-cards");
  const fund = await cardFund();
  const worst = amountCents * count;
  const batch = await createCardBatch({ name, kind, amountCents, count, validThru: validThru!, handedOutAt, by: user.id });
  await logActivity({ actorUserId: user.id, action: "cards.batch_created", targetType: "nearest_card_batch", targetId: batch.id, after: { name, kind, amountCents, count, validThru, handedOutAt } });
  revalidatePath("/admin/cards");
  const fundNote = worst > fund.available - fund.saved
    ? ` Heads up: if every card is used, this batch is ${money(worst)} — more than the ${money(Math.max(0, fund.available - fund.saved))} left in the Nearest Cards fund after cards already saved.`
    : ` If every card is used, this batch is ${money(worst)} of the ${money(fund.available - fund.saved)} left in the fund.`;
  return { ok: `"${name}" — ${count} card${count === 1 ? "" : "s"} made. Download the file for your printer below.${fundNote}` };
}

/** Main owner: turn a whole batch off (cards not yet saved can't be added) or back on. */
export async function setCardBatchStatus(form: FormData) {
  const user = await owner();
  if (!user) return;
  const id = s(form, "id", 40), to = s(form, "to", 10) === "off" ? "off" : "active";
  const before = await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.id, id) });
  if (!before || before.status === "discarded") return;
  await db.update(nearestCardBatches).set({ status: to }).where(eq(nearestCardBatches.id, id));
  await logActivity({ actorUserId: user.id, action: to === "off" ? "cards.batch_off" : "cards.batch_on", targetType: "nearest_card_batch", targetId: id, before: { status: before.status }, after: { status: to } });
  revalidatePath("/admin/cards");
}

/** Main owner: change the date a batch was handed out — the 30-day window to save a card counts from it. */
export async function setBatchHandout(form: FormData) {
  const user = await owner();
  if (!user) return;
  const id = s(form, "id", 40);
  const when = startOfDay(s(form, "handedOut", 10));
  const before = await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.id, id) });
  if (!before || !when || before.status === "discarded") return;
  await db.update(nearestCardBatches).set({ handedOutAt: when }).where(eq(nearestCardBatches.id, id));
  await logActivity({ actorUserId: user.id, action: "cards.batch_handout_date", targetType: "nearest_card_batch", targetId: id, before: { handedOutAt: before.handedOutAt }, after: { handedOutAt: when } });
  revalidatePath("/admin/cards");
}

/**
 * Main owner: discard a whole batch for good. Every card in it stops working — including cards students saved but
 * haven't used. Only cards already used on a paid booking, or chosen for a booking that's waiting on the professional or
 * on payment, are left alone (that booking goes ahead). Can't be undone; the printer file is no longer offered.
 */
export async function discardCardBatch(form: FormData) {
  const user = await owner();
  if (!user) return;
  const id = s(form, "id", 40);
  if (form.get("sure") !== "on") return;
  const before = await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.id, id) });
  if (!before || before.status === "discarded") return;
  await db.update(nearestCardBatches).set({ status: "discarded", discardedAt: new Date() }).where(eq(nearestCardBatches.id, id));
  const gone = await db.update(nearestCards).set({ status: "discarded" })
    .where(and(eq(nearestCards.batchId, id), sql`${nearestCards.creditId} is null`, inArray(nearestCards.status, ["issued", "activated", "off", "locked"]), FREE_SQL))
    .returning({ id: nearestCards.id });
  await logActivity({ actorUserId: user.id, action: "cards.batch_discarded", targetType: "nearest_card_batch", targetId: id, before: { status: before.status }, after: { status: "discarded", cardsStopped: gone.length } });
  revalidatePath("/admin/cards");
}

/**
 * Main owner: turn one card off (lost, stolen or given out by mistake), back on, or unlock it after too many wrong codes.
 * A card a student saved can be turned off too, as long as it isn't on a paid booking or a booking in progress.
 */
export async function setCardStatus(form: FormData) {
  const user = await owner();
  if (!user) return;
  const id = s(form, "id", 40), to = s(form, "to", 10);
  const c = await db.query.nearestCards.findFirst({ where: eq(nearestCards.id, id) });
  if (!c || c.status === "discarded" || c.creditId) return;
  let changed: unknown[] = [];
  if (to === "off") changed = await db.update(nearestCards).set({ status: "off" }).where(and(eq(nearestCards.id, id), inArray(nearestCards.status, ["issued", "locked", "activated"]), sql`${nearestCards.creditId} is null`, FREE_SQL)).returning({ id: nearestCards.id });
  // Back on: a card that was on a student's account goes back to that account; otherwise it can be added again.
  if (to === "on") changed = await db.update(nearestCards).set({ status: c.studentId ? "activated" : "issued", failedAttempts: 0 }).where(and(eq(nearestCards.id, id), inArray(nearestCards.status, ["off", "locked"]))).returning({ id: nearestCards.id });
  if (!changed.length) return;
  await logActivity({ actorUserId: user.id, action: to === "off" ? "cards.card_off" : "cards.card_on", targetType: "nearest_card", targetId: id, before: { status: c.status }, after: { status: to === "off" ? "off" : c.studentId ? "activated" : "issued" } });
  revalidatePath("/admin/cards");
}
