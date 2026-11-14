"use server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, nearestCardBatches, adminMembers } from "@/db";
import { requireAdmin, isMainOwner } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { digits, endOfMonth, CARD_LIMITS } from "@/lib/nearest-cards";

type FormState = { error?: string; ok?: string };
const s = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const refresh = () => { revalidatePath("/admin/cards"); revalidatePath("/admin/vouchers", "layout"); revalidatePath("/admin/my-vouchers"); revalidatePath("/cards"); revalidatePath("/card"); };

/**
 * Voucher Distribution Management (2026-11-12) — the main owner's alone. A campaign = one distributor × type: the
 * distributor's ONE 16-digit number, the 3-digit (discount) or 4-digit (free) code and how many vouchers (= the claim
 * limit, 900 / 100). New campaigns are saved as a DRAFT; Publish makes them appear in that distributor's account and lets
 * students activate them. The one-form setup (saveDistributorVouchers) makes the number and codes; this action checks and saves them. All logged.
 * Distributors record their own organization assignments in src/app/admin/distribution-actions.ts.
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
  // Free-service vouchers cover the professional's whole eligible free service, so their value isn't asked for.
  const amountCents = kind === "free" && !s(form, "amount", 10) ? CARD_LIMITS.freeMax : Math.round(Number(s(form, "amount", 10)) * 100);
  const validThru = endOfMonth(s(form, "validThru", 7));
  const count = Math.round(Number(s(form, "printed", 6)) || 0);
  const isOwner = /^[0-9a-f-]{36}$/.test(distributorId) && await db.query.adminMembers.findFirst({ where: and(eq(adminMembers.userId, distributorId), eq(adminMembers.role, "OWNER")) });
  if (!isOwner) return { error: "Choose the distributor (Avy, Kisses or Lakeesha)." };
  if (number.length !== 16) return { error: "The voucher number must be 16 digits." };
  if (kind === "discount" && code.length !== 3) return { error: "A discount voucher's security code is 3 digits." };
  if (kind === "free" && code.length !== 4) return { error: "A free-service voucher's security code is 4 digits." };
  if (kind === "discount" && (amountCents < CARD_LIMITS.discountMin || amountCents > CARD_LIMITS.discountMax)) return { error: "A discount voucher is $5 to $40 off." };
  if (kind === "free" && (amountCents < 500 || amountCents > CARD_LIMITS.freeMax)) return { error: "A free-service voucher covers $5 to $150." };
  if (!validThru) return { error: "Enter Valid thru as the month printed on the voucher (for example 2030-05 for 05/30)." };
  if (count < 1 || count > 100000) return { error: "Enter how many vouchers are in this campaign (for example 900 discount or 100 free service). It's also the most students who can claim it." };
  // ONE number per distributor (shared by their discount and free campaigns); never another distributor's or a Nearest Card's.
  if ((await db.execute(sql`select 1 from nearest_cards where number = ${number} and not shared limit 1`)).rows.length) return { error: "That number belongs to a Nearest Card. Use a different number." };
  const others = (await db.execute(sql`select id, distributor_id as "distributorId", kind, status from nearest_card_batches
    where shared_number = ${number} ${id ? sql`and id <> ${id}` : sql``}`)).rows as { id: string; distributorId: string | null; kind: string; status: string }[];
  if (others.some((o) => o.distributorId !== distributorId)) return { error: "That 16-digit number already belongs to another distributor. Each distributor has their own number." };
  if (others.some((o) => o.kind === kind && o.status === "active")) return { error: `This distributor already has a ${kind === "free" ? "free-service" : "discount"} campaign on that number. Edit it, or turn it off first.` };
  const mine = (await db.execute(sql`select distinct shared_number as n from nearest_card_batches where distributor_id = ${distributorId} and shared_number is not null and status = 'active' ${id ? sql`and id <> ${id}` : sql``}`)).rows as { n: string }[];
  if (mine.some((m) => m.n !== number)) return { error: "This distributor already uses a different 16-digit number. Both of their campaigns use the same number." };
  const dist = (await db.execute(sql`select coalesce(nullif(trim(first_name || ' ' || coalesce(last_name, '')), ''), email) as n from users where id = ${distributorId}`)).rows[0] as { n: string };
  const batchName = s(form, "name", 80);
  const name = batchName ? `${batchName} — ${kind === "free" ? "Free service" : "Discount"}` : `GRANTED ${kind === "free" ? "Free service" : "Discount"} — ${dist?.n ?? "Distributor"}`;
  if (id) {
    const before = await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.id, id) });
    if (!before?.sharedNumber) return { error: "Campaign not found." };
    const activated = (await db.execute(sql`select count(*)::int as n from nearest_cards where batch_id = ${id} and shared`)).rows[0] as { n: number };
    if (activated.n > 0 && (before.sharedNumber !== number || before.kind !== kind || before.sharedCode !== code)) return { error: "Students already activated this campaign, so its number, code and type can't change. Turn it off and set up a new one instead." };
    if (count < activated.n) return { error: `${activated.n} students already claimed this campaign — the quantity can't be lower than that.` };
    const assigned = (await db.execute(sql`select coalesce(sum(quantity), 0)::int as n from voucher_distributions where batch_id = ${id} and status <> 'cancelled'`)).rows[0] as { n: number };
    if (count < assigned.n) return { error: `${assigned.n} of these vouchers are already assigned to organizations — the quantity can't be lower than that.` };
    await db.update(nearestCardBatches).set({ name, kind, sharedNumber: number, sharedCode: code, amountCents, validThru, count, distributorId }).where(eq(nearestCardBatches.id, id));
    await logActivity({ actorUserId: user.id, action: "vouchers.campaign_changed", targetType: "voucher_campaign", targetId: id, before: { number: before.sharedNumber, kind: before.kind, amountCents: before.amountCents, validThru: before.validThru, count: before.count, distributorId: before.distributorId }, after: { number, kind, amountCents, validThru, count, distributorId } });
    refresh();
    return { ok: `${name} saved.${before.draft ? " Review it, then Publish." : ""}` };
  }
  const [b] = await db.insert(nearestCardBatches).values({ name, kind, amountCents, count, validThru, sharedNumber: number, sharedCode: code, distributorId, draft: true, createdBy: user.id }).returning();
  await logActivity({ actorUserId: user.id, action: "vouchers.campaign_added", targetType: "voucher_campaign", targetId: b.id, after: { name, number, kind, amountCents, validThru, count, distributorId, draft: true } });
  refresh();
  return { ok: `${name} saved as a draft. Review it, then Publish.` };
}

/**
 * Nearest Cards → Set up a distributor's vouchers (2026-11-13, owner): pick the distributor and the type (discount, free
 * service or both) — Nearest makes the numbers. The distributor keeps ONE 16-digit number (8877 + 12 digits): reused when
 * they already have one, otherwise made new and never used by any card or other distributor. Codes are made too: 3 digits
 * (100–999) for discount, 4 digits (1000–9999) for free service. Each type is saved as its own DRAFT — review, then Publish.
 */
async function newVoucherNumber() {
  const { randomInt } = await import("crypto");
  for (let i = 0; i < 50; i++) {
    const n = `8877${Array.from({ length: 12 }, () => randomInt(10)).join("")}`;
    const used = (await db.execute(sql`select 1 from nearest_cards where number = ${n} union all select 1 from nearest_card_batches where shared_number = ${n} limit 1`)).rows.length;
    if (!used) return n;
  }
  throw new Error("Couldn't make a new number — try again.");
}

export async function saveDistributorVouchers(_: FormState, form: FormData): Promise<FormState> {
  const { main } = await owner();
  if (!main) return { error: "Only the main owner can set up vouchers." };
  const distributorId = s(form, "distributorId", 40);
  const type = s(form, "type", 10);
  const wantD = type === "discount" || type === "both", wantF = type === "free" || type === "both";
  if (!/^[0-9a-f-]{36}$/.test(distributorId)) return { error: "Choose who these vouchers are for." };
  if (!wantD && !wantF) return { error: "Choose discount, free service, or both." };
  const dCount = s(form, "discountCount", 6), fCount = s(form, "freeCount", 6);
  const okCount = (c: string) => Number.isInteger(Number(c)) && Number(c) >= 1 && Number(c) <= 100000;
  if (wantD && !okCount(dCount)) return { error: "Enter how many discount vouchers (for example 900)." };
  if (wantF && !okCount(fCount)) return { error: "Enter how many free-service vouchers (for example 100)." };
  const { randomInt } = await import("crypto");
  // The distributor's one number: the one they already have, or a brand-new one.
  const mine = (await db.execute(sql`select shared_number as n from nearest_card_batches where distributor_id = ${distributorId} and shared_number is not null
    order by (status = 'active') desc, created_at desc limit 1`)).rows[0] as { n: string } | undefined;
  const number = mine?.n ?? (await newVoucherNumber());
  const results: string[] = [];
  for (const [want, kind, count, amount] of [[wantD, "discount", dCount, s(form, "discountAmount", 10)], [wantF, "free", fCount, ""]] as const) {
    if (!want) continue;
    const f = new FormData();
    f.set("distributorId", distributorId); f.set("number", number); f.set("validThru", s(form, "validThru", 7)); f.set("name", s(form, "name", 80));
    f.set("kind", kind); f.set("code", String(kind === "free" ? randomInt(1000, 10000) : randomInt(100, 1000))); f.set("printed", count); f.set("amount", amount);
    const r = await saveVoucherCampaign({}, f);
    if (r.error) return { error: results.length ? `${results.join(" ")} The free-service part wasn't saved: ${r.error}` : r.error };
    results.push(r.ok ?? "");
  }
  return { ok: results.join(" ") };
}

/** Publish a draft: it appears in the distributor's account and students can activate it. */
export async function publishVoucherCampaign(form: FormData) {
  const { user, main } = await owner();
  if (!main) return;
  const id = s(form, "id", 40);
  const b = /^[0-9a-f-]{36}$/.test(id) ? await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.id, id) }) : null;
  if (!b?.sharedNumber || !b.draft) return;
  await db.update(nearestCardBatches).set({ draft: false }).where(eq(nearestCardBatches.id, id));
  await logActivity({ actorUserId: user.id, action: "vouchers.campaign_published", targetType: "voucher_campaign", targetId: id, before: { draft: true }, after: { draft: false, distributorId: b.distributorId, number: b.sharedNumber, kind: b.kind, count: b.count } });
  refresh();
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
