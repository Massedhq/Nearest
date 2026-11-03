"use server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, nearestCardBatches, nearestCards } from "@/db";
import { requireMainOwner } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { money } from "@/lib/time";
import { batchProblem, createCardBatch, endOfMonth, type CardKind } from "@/lib/nearest-cards";

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
  const name = s(form, "name", 80) || `${kind === "free" ? "Free" : `$${amountCents / 100}`} cards ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}`;
  const { cardFund } = await import("@/lib/nearest-cards");
  const fund = await cardFund();
  const worst = amountCents * count;
  const batch = await createCardBatch({ name, kind, amountCents, count, validThru: validThru!, by: user.id });
  await logActivity({ actorUserId: user.id, action: "cards.batch_created", targetType: "nearest_card_batch", targetId: batch.id, after: { name, kind, amountCents, count, validThru } });
  revalidatePath("/admin/cards");
  const fundNote = worst > fund.available - fund.saved
    ? ` Heads up: if every card is used, this batch is ${money(worst)} — more than the ${money(Math.max(0, fund.available - fund.saved))} left in the Nearest Cards fund after cards already saved.`
    : ` If every card is used, this batch is ${money(worst)} of the ${money(fund.available - fund.saved)} left in the fund.`;
  return { ok: `"${name}" — ${count} card${count === 1 ? "" : "s"} made. Download the file for your printer below.${fundNote}` };
}

/** Owners: turn a whole batch off (cards not yet added can't be used) or back on. */
export async function setCardBatchStatus(form: FormData) {
  const user = await owner();
  if (!user) return;
  const id = s(form, "id", 40), to = s(form, "to", 10) === "off" ? "off" : "active";
  const before = await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.id, id) });
  if (!before) return;
  await db.update(nearestCardBatches).set({ status: to }).where(eq(nearestCardBatches.id, id));
  await logActivity({ actorUserId: user.id, action: to === "off" ? "cards.batch_off" : "cards.batch_on", targetType: "nearest_card_batch", targetId: id, before: { status: before.status }, after: { status: to } });
  revalidatePath("/admin/cards");
}

/** Owners: turn one card off (lost or stolen before it was added), back on, or unlock it after too many wrong codes. */
export async function setCardStatus(form: FormData) {
  const user = await owner();
  if (!user) return;
  const id = s(form, "id", 40), to = s(form, "to", 10);
  const c = await db.query.nearestCards.findFirst({ where: eq(nearestCards.id, id) });
  if (!c || c.status === "activated") return; // added cards are already credit on a student's account
  if (to === "off") await db.update(nearestCards).set({ status: "off" }).where(and(eq(nearestCards.id, id), inArray(nearestCards.status, ["issued", "locked"])));
  if (to === "on") await db.update(nearestCards).set({ status: "issued", failedAttempts: 0 }).where(and(eq(nearestCards.id, id), inArray(nearestCards.status, ["off", "locked"])));
  await logActivity({ actorUserId: user.id, action: to === "off" ? "cards.card_off" : "cards.card_on", targetType: "nearest_card", targetId: id, before: { status: c.status }, after: { status: to === "off" ? "off" : "issued" } });
  revalidatePath("/admin/cards");
}

