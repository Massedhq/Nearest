"use server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, cities, cardPlaces, nearestCardBatches, voucherDistributions, voucherDistributionEvents } from "@/db";
import { requireAdmin, isMainOwner } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { ORG_KINDS, DIST_STATUS, locationKey } from "@/lib/distribution";

/**
 * My Voucher Distribution actions (2026-11-12). A distributor works ONLY on their own published campaigns — every action
 * re-checks on the server that the campaign belongs to the signed-in owner (the main owner may act for anyone). Inventory
 * can't be over-assigned; nothing is deleted (canceling keeps the row); every change is written to
 * voucher_distribution_events and the activity log.
 */
type FormState = { error?: string; ok?: string };
const s = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const refresh = () => { revalidatePath("/admin/cards"); revalidatePath("/admin/my-vouchers"); revalidatePath("/admin/vouchers", "layout"); revalidatePath("/card"); };
const STATUSES = ["planned", "assigned", "delivered", "completed"] as const;

async function owner() {
  const a = await requireAdmin();
  if (a.role !== "OWNER") throw new Error("Only distributors can do this.");
  return { user: a.user, main: await isMainOwner(a.user.id) };
}

/** A published campaign the signed-in owner may assign from (their own; the main owner: any). */
async function campaignFor(batchId: string, userId: string, main: boolean) {
  if (!/^[0-9a-f-]{36}$/.test(batchId)) return null;
  const b = await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.id, batchId) });
  if (!b?.sharedNumber || b.draft) return null;
  if (!main && b.distributorId !== userId) return null;
  return b;
}

/** An assignment the signed-in owner may change (on their own campaign; the main owner: any). */
async function assignmentFor(id: string, userId: string, main: boolean) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const d = await db.query.voucherDistributions.findFirst({ where: eq(voucherDistributions.id, id) });
  if (!d) return null;
  const b = await campaignFor(d.batchId, userId, main);
  return b ? { d, b } : null;
}

function readQty(form: FormData) {
  const quantity = Number(s(form, "quantity", 6));
  const rawDelivered = s(form, "delivered", 6);
  const delivered = rawDelivered === "" ? null : Number(rawDelivered);
  const status = (STATUSES as readonly string[]).includes(s(form, "status", 12)) ? s(form, "status", 12) : "";
  const day = s(form, "date", 10);
  const at = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T17:00:00Z`) : null;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) return { error: "Enter how many vouchers (1 or more)." };
  if (delivered !== null && (!Number.isInteger(delivered) || delivered < 0 || delivered > quantity)) return { error: "Delivered can't be more than the vouchers assigned." };
  if (!status) return { error: "Choose the status." };
  if (!at) return { error: "Enter the delivery date (or the planned date)." };
  // Delivered/Completed with no number = all of them; Planned/Assigned never counts as delivered unless a number is entered.
  const del = delivered ?? (status === "delivered" || status === "completed" ? quantity : 0);
  return { quantity, delivered: del, status, at, notes: s(form, "notes", 300) || null };
}

/** Add an organization location (or reuse it when that exact location is already listed). Shared directory, no assignments shown. */
export async function addOrganization(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await owner();
  const name = s(form, "name", 120);
  const kind = ORG_KINDS[s(form, "kind", 30)] ? s(form, "kind", 30) : "other";
  const street = s(form, "street", 160), state = s(form, "state", 2).toUpperCase(), zip = s(form, "zip", 10);
  const cityName = s(form, "city", 80).replace(/,\s*[A-Za-z]{2}$/, "");
  if (!name) return { error: "Enter the organization's name." };
  if (street.length < 5 || !/\d/.test(street)) return { error: "Enter the street address (number and street)." };
  if (!/^[A-Z]{2}$/.test(state)) return { error: "Choose the state." };
  if (!/^\d{5}(-\d{4})?$/.test(zip)) return { error: "Enter the 5-digit ZIP code." };
  const matches = await db.select({ id: cities.id, name: cities.name }).from(cities)
    .where(and(eq(cities.active, true), eq(cities.state, state), sql`lower(${cities.name}) = lower(${cityName})`)).limit(2);
  if (matches.length !== 1) return { error: `We couldn't find ${cityName || "that city"}, ${state}. Start typing and pick the city from the list.` };
  const key = locationKey(name, street, zip.slice(0, 5));
  const [p] = await db.insert(cardPlaces).values({
    name, kind, street, state, zip, cityId: matches[0].id, address: `${street}, ${matches[0].name}, ${state} ${zip}`,
    contactName: s(form, "contactName", 100) || null, contact: s(form, "contact", 120) || null, locationKey: key, createdBy: user.id,
  }).onConflictDoNothing().returning();
  refresh();
  if (!p) return { ok: `${name} at ${street} is already listed — pick it in "Assign vouchers".` };
  await logActivity({ actorUserId: user.id, action: "vouchers.org_added", targetType: "card_place", targetId: p.id, after: { name, kind, street, city: matches[0].name, state, zip } });
  return { ok: `${name} — ${matches[0].name}, ${state} added. Now assign vouchers to it.` };
}

/** Assign vouchers from one of your campaigns to an organization. Can't go past what's left unassigned in that campaign. */
export async function assignVouchers(_: FormState, form: FormData): Promise<FormState> {
  const { user, main } = await owner();
  const b = await campaignFor(s(form, "batchId", 40), user.id, main);
  if (!b) return { error: "Choose your discount or free-service vouchers." };
  const placeId = s(form, "placeId", 40);
  const place = /^[0-9a-f-]{36}$/.test(placeId) ? await db.query.cardPlaces.findFirst({ where: eq(cardPlaces.id, placeId) }) : null;
  if (!place) return { error: "Choose the organization (or add it first)." };
  const q = readQty(form);
  if ("error" in q) return { error: q.error };
  // One statement: only inserts while this campaign still has that many vouchers unassigned.
  const r = await db.execute(sql`insert into voucher_distributions (batch_id, place_id, quantity, delivered, status, distributed_at, notes, created_by, updated_at)
    select ${b.id}, ${place.id}, ${q.quantity}, ${q.delivered}, ${q.status}, ${q.at.toISOString()}, ${q.notes}, ${user.id}, now()
    where (select coalesce(sum(quantity), 0) from voucher_distributions where batch_id = ${b.id} and status <> 'cancelled') + ${q.quantity} <= ${b.count}
    returning id`);
  const row = r.rows[0] as { id: string } | undefined;
  if (!row) {
    const used = (await db.execute(sql`select coalesce(sum(quantity), 0)::int as n from voucher_distributions where batch_id = ${b.id} and status <> 'cancelled'`)).rows[0] as { n: number };
    return { error: `Only ${Math.max(0, b.count - used.n)} ${b.kind === "free" ? "free-service" : "discount"} vouchers are left to assign.` };
  }
  const after = { place: place.name, kind: b.kind, quantity: q.quantity, delivered: q.delivered, status: q.status, date: q.at, notes: q.notes };
  await db.insert(voucherDistributionEvents).values({ distributionId: row.id, actorId: user.id, action: "created", after });
  await logActivity({ actorUserId: user.id, action: "vouchers.assigned", targetType: "voucher_distribution", targetId: row.id, after });
  refresh();
  return { ok: `${q.quantity} ${b.kind === "free" ? "free-service" : "discount"} voucher${q.quantity === 1 ? "" : "s"} assigned to ${place.name} (${DIST_STATUS[q.status]}).` };
}

/** Edit an assignment: quantity, delivered, status, date, notes. Reducing returns vouchers to what's available. */
export async function updateAssignment(_: FormState, form: FormData): Promise<FormState> {
  const { user, main } = await owner();
  const found = await assignmentFor(s(form, "id", 40), user.id, main);
  if (!found) return { error: "That assignment isn't yours." };
  const { d, b } = found;
  if (d.status === "cancelled") return { error: "This assignment was canceled. Add a new one instead." };
  const q = readQty(form);
  if ("error" in q) return { error: q.error };
  const r = await db.execute(sql`update voucher_distributions set quantity = ${q.quantity}, delivered = ${q.delivered}, status = ${q.status},
      distributed_at = ${q.at.toISOString()}, notes = ${q.notes}, updated_at = now()
    where id = ${d.id} and (select coalesce(sum(quantity), 0) from voucher_distributions where batch_id = ${b.id} and status <> 'cancelled' and id <> ${d.id}) + ${q.quantity} <= ${b.count}
    returning id`);
  if (!r.rows.length) return { error: "That's more vouchers than you have left to assign." };
  const before = { quantity: d.quantity, delivered: d.delivered, status: d.status, date: d.distributedAt, notes: d.notes };
  const after = { quantity: q.quantity, delivered: q.delivered, status: q.status, date: q.at, notes: q.notes };
  await db.insert(voucherDistributionEvents).values({ distributionId: d.id, actorId: user.id, action: "changed", before, after });
  await logActivity({ actorUserId: user.id, action: "vouchers.assignment_changed", targetType: "voucher_distribution", targetId: d.id, before, after });
  refresh();
  return { ok: "Saved." };
}

/** Cancel an assignment that wasn't delivered. The vouchers go back to available; the record and its history stay. */
export async function cancelAssignment(form: FormData) {
  const { user, main } = await owner();
  const found = await assignmentFor(s(form, "id", 40), user.id, main);
  if (!found || found.d.status === "cancelled") return;
  const { d } = found;
  if ((d.delivered ?? 0) > 0 || ((d.status === "delivered" || d.status === "completed") && d.delivered == null)) return; // delivered vouchers can't be canceled — reduce the quantity instead
  await db.update(voucherDistributions).set({ status: "cancelled", updatedAt: new Date() }).where(eq(voucherDistributions.id, d.id));
  const before = { status: d.status, quantity: d.quantity };
  await db.insert(voucherDistributionEvents).values({ distributionId: d.id, actorId: user.id, action: "cancelled", before, after: { status: "cancelled" } });
  await logActivity({ actorUserId: user.id, action: "vouchers.assignment_cancelled", targetType: "voucher_distribution", targetId: d.id, before, after: { status: "cancelled" } });
  refresh();
}
