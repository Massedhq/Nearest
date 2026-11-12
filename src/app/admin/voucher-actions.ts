"use server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, nearestCardBatches, voucherDistributions, cardPlaces, adminMembers } from "@/db";
import { requireAdmin, isMainOwner } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { digits, endOfMonth, CARD_LIMITS } from "@/lib/nearest-cards";

type FormState = { error?: string; ok?: string };
const s = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const refresh = () => { revalidatePath("/admin/vouchers"); revalidatePath("/cards"); };

/**
 * GRANTED voucher campaigns (2026-11-11). Setting up / changing / turning off a campaign (its shared number, code, value)
 * is the main owner's alone. Any owner logs the vouchers THEY handed out (main owner can log for anyone). All logged.
 */
async function owner() {
  const a = await requireAdmin();
  if (a.role !== "OWNER") throw new Error("Only owners can do this.");
  return { user: a.user, main: await isMainOwner(a.user.id) };
}

export async function saveVoucherCampaign(_: FormState, form: FormData): Promise<FormState> {
  const { user, main } = await owner();
  if (!main) return { error: "Only the main owner can set up voucher campaigns." };
  const id = s(form, "id", 40);
  const distributorId = s(form, "distributorId", 40);
  const kind = s(form, "kind", 10) === "free" ? "free" : "discount";
  const number = digits(s(form, "number", 30)), code = digits(s(form, "code", 10));
  const amountCents = Math.round(Number(s(form, "amount", 10)) * 100);
  const validThru = endOfMonth(s(form, "validThru", 7));
  const count = Math.round(Number(s(form, "printed", 6)) || 0);
  const isOwner = await db.query.adminMembers.findFirst({ where: and(eq(adminMembers.userId, distributorId), eq(adminMembers.role, "OWNER")) });
  if (!isOwner) return { error: "Choose the distributor (Avrial, Kisses or Lakeisha)." };
  if (number.length !== 16) return { error: "The voucher number must be 16 digits." };
  if (kind === "discount" && code.length !== 3) return { error: "A discount voucher's security code is 3 digits." };
  if (kind === "free" && code.length !== 4) return { error: "A free-service voucher's security code is 4 digits." };
  if (kind === "discount" && (amountCents < CARD_LIMITS.discountMin || amountCents > CARD_LIMITS.discountMax)) return { error: "A discount voucher is $5 to $30 off." };
  if (kind === "free" && (amountCents < 500 || amountCents > CARD_LIMITS.freeMax)) return { error: "A free-service voucher covers $5 to $150." };
  if (!validThru) return { error: "Enter Valid thru as the month printed on the voucher (for example 2030-05 for 05/30)." };
  if (count < 0 || count > 100000) return { error: "Printed quantity looks wrong." };
  // The number must not belong to an older Nearest Card or another campaign.
  const clash = (await db.execute(sql`select 1 from nearest_cards where number = ${number} and not shared limit 1`)).rows.length
    || (await db.select({ id: nearestCardBatches.id }).from(nearestCardBatches).where(and(eq(nearestCardBatches.sharedNumber, number), id ? sql`${nearestCardBatches.id} <> ${id}` : sql`true`))).length;
  if (clash) return { error: "That number is already used by another voucher campaign or a Nearest Card. Use a different number." };
  const dist = (await db.execute(sql`select coalesce(nullif(trim(first_name || ' ' || coalesce(last_name, '')), ''), email) as n from users where id = ${distributorId}`)).rows[0] as { n: string };
  const name = `GRANTED ${kind === "free" ? "Free service" : "Discount"} — ${dist?.n ?? "Distributor"}`;
  if (id) {
    const before = await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.id, id) });
    if (!before?.sharedNumber) return { error: "Campaign not found." };
    const activated = (await db.execute(sql`select count(*)::int as n from nearest_cards where batch_id = ${id} and shared`)).rows[0] as { n: number };
    if (activated.n > 0 && (before.sharedNumber !== number || before.kind !== kind)) return { error: "Students already activated this campaign, so its number and type can't change. Turn it off and set up a new one instead." };
    await db.update(nearestCardBatches).set({ name, kind, sharedNumber: number, sharedCode: code, amountCents, validThru, count, distributorId }).where(eq(nearestCardBatches.id, id));
    await logActivity({ actorUserId: user.id, action: "vouchers.campaign_changed", targetType: "voucher_campaign", targetId: id, before: { number: before.sharedNumber, kind: before.kind, amountCents: before.amountCents, validThru: before.validThru, count: before.count, distributorId: before.distributorId }, after: { number, kind, amountCents, validThru, count, distributorId } });
    refresh();
    return { ok: `${name} saved.` };
  }
  const [b] = await db.insert(nearestCardBatches).values({ name, kind, amountCents, count, validThru, sharedNumber: number, sharedCode: code, distributorId, createdBy: user.id }).returning();
  await logActivity({ actorUserId: user.id, action: "vouchers.campaign_added", targetType: "voucher_campaign", targetId: b.id, after: { name, number, kind, amountCents, validThru, count, distributorId } });
  refresh();
  return { ok: `${name} set up. Students can activate it now.` };
}

/** Turn a campaign off (no new activations; students who already activated keep it) or back on. */
export async function setVoucherCampaignStatus(form: FormData) {
  const { user, main } = await owner();
  if (!main) return;
  const id = s(form, "id", 40), on = s(form, "to", 4) === "on";
  const b = await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.id, id) });
  if (!b?.sharedNumber) return;
  await db.update(nearestCardBatches).set({ status: on ? "active" : "off" }).where(eq(nearestCardBatches.id, id));
  await logActivity({ actorUserId: user.id, action: on ? "vouchers.campaign_on" : "vouchers.campaign_off", targetType: "voucher_campaign", targetId: id, before: { status: b.status }, after: { status: on ? "active" : "off" } });
  refresh();
}

/** Log vouchers handed to an organization. Owners log their own campaigns; the main owner can log any. */
export async function logVoucherDistribution(_: FormState, form: FormData): Promise<FormState> {
  const { user, main } = await owner();
  const batchId = s(form, "batchId", 40);
  const b = await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.id, batchId) });
  if (!b?.sharedNumber) return { error: "Choose the voucher campaign." };
  if (!main && b.distributorId !== user.id) return { error: "You can log only your own vouchers." };
  const placeId = s(form, "placeId", 40);
  const place = placeId ? await db.query.cardPlaces.findFirst({ where: eq(cardPlaces.id, placeId) }) : null;
  if (!place) return { error: "Choose the organization (add it in Card places first if it's new)." };
  const quantity = Math.round(Number(s(form, "quantity", 6)));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) return { error: "Enter how many vouchers you handed out." };
  const day = s(form, "date", 10);
  const at = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T17:00:00Z`) : null;
  if (!at || at.getTime() > Date.now() + 86400000) return { error: "Enter the date you handed them out." };
  const given = (await db.execute(sql`select coalesce(sum(quantity), 0)::int as n from voucher_distributions where batch_id = ${batchId}`)).rows[0] as { n: number };
  if (b.count > 0 && given.n + quantity > b.count) return { error: `That's more than were printed for this campaign (${b.count} printed, ${given.n} already logged).` };
  const [d] = await db.insert(voucherDistributions).values({ batchId, placeId, quantity, distributedAt: at, notes: s(form, "notes", 300) || null, createdBy: user.id }).returning();
  await logActivity({ actorUserId: user.id, action: "vouchers.distributed", targetType: "voucher_campaign", targetId: batchId, after: { distributionId: d.id, place: place.name, quantity, date: day } });
  refresh();
  return { ok: `Logged ${quantity} voucher${quantity === 1 ? "" : "s"} given to ${place.name}.` };
}

/** Remove a distribution logged by mistake (the person who logged it, or the main owner). */
export async function removeVoucherDistribution(form: FormData) {
  const { user, main } = await owner();
  const id = s(form, "id", 40);
  const d = await db.query.voucherDistributions.findFirst({ where: eq(voucherDistributions.id, id) });
  if (!d || (!main && d.createdBy !== user.id)) return;
  await db.delete(voucherDistributions).where(eq(voucherDistributions.id, id));
  await logActivity({ actorUserId: user.id, action: "vouchers.distribution_removed", targetType: "voucher_campaign", targetId: d.batchId, before: { quantity: d.quantity, placeId: d.placeId, date: d.distributedAt } });
  refresh();
}

