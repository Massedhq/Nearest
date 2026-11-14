"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  const prior = id ? await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.id, id) }) : undefined;
  if (prior?.scratch) return saveScratchRow(user.id, prior, { amountCents, validThru, count, name: s(form, "name", 80) });
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
 * Edit one row of a scratch-off pool (2026-11-14): $ off (discount row), how many, Valid thru and the batch name. The
 * number, code, type and distributor never change here. Valid thru and the batch name apply to the whole pool.
 */
async function saveScratchRow(userId: string, before: typeof nearestCardBatches.$inferSelect, v: { amountCents: number; validThru: Date | null; count: number; name: string }): Promise<FormState> {
  const amountCents = before.kind === "free" ? before.amountCents : v.amountCents;
  if (before.kind === "discount" && (amountCents < CARD_LIMITS.discountMin || amountCents > CARD_LIMITS.discountMax)) return { error: "A discount is $5 to $40 off." };
  if (!v.validThru) return { error: "Enter Valid thru as the month printed on the card." };
  if (v.count < 0 || v.count > 100000) return { error: "Enter how many." };
  if (v.count < before.claimed) return { error: `${before.claimed} of these are already revealed — the number can't be lower than that.` };
  const claimedOnCard = (await db.execute(sql`select count(*)::int as n from nearest_cards where batch_id = ${before.id} and shared`)).rows[0] as { n: number };
  if (claimedOnCard.n > 0 && before.kind === "discount" && amountCents !== before.amountCents) return { error: "Students already have this discount, so its $ off can't change." };
  const label = before.kind === "free" ? "Free service" : `$${amountCents / 100} off`;
  const name = v.name ? `${v.name} — ${label}` : before.name.replace(/ — \$\d+ off$/, ` — ${label}`);
  await db.update(nearestCardBatches).set({ amountCents, count: v.count, name }).where(eq(nearestCardBatches.id, before.id));
  await db.update(nearestCardBatches).set({ validThru: v.validThru }).where(and(eq(nearestCardBatches.sharedNumber, before.sharedNumber!), eq(nearestCardBatches.sharedCode, before.sharedCode!), eq(nearestCardBatches.scratch, true)));
  await logActivity({ actorUserId: userId, action: "vouchers.campaign_changed", targetType: "voucher_campaign", targetId: before.id, before: { amountCents: before.amountCents, count: before.count, validThru: before.validThru }, after: { amountCents, count: v.count, validThru: v.validThru } });
  refresh();
  return { ok: `${name} saved.${before.draft ? " Review it, then Publish." : ""}` };
}

/** The one 16-digit number on every universal GRANTED card (the newest scratch pool's), or a brand-new one. */
async function universalNumber() {
  const r = (await db.execute(sql`select shared_number as n from nearest_card_batches where scratch and shared_number is not null
    order by (status = 'active') desc, created_at desc limit 1`)).rows[0] as { n: string } | undefined;
  return r?.n ?? (await newVoucherNumber());
}

/**
 * A 4-digit code for a distributor's pool on that number: 1000–9999, not used on that number, and different from every
 * other code there in at least two places (so a typo never lands on someone else's pool).
 */
async function newScratchCode(number: string) {
  const { randomInt } = await import("crypto");
  const taken = ((await db.execute(sql`select distinct shared_code as c from nearest_card_batches where shared_number = ${number} and shared_code is not null`)).rows as { c: string }[]).map((r) => r.c);
  const diff = (a: string, b: string) => [...a].filter((ch, i) => ch !== b[i]).length;
  for (let i = 0; i < 500; i++) {
    const c = String(randomInt(1000, 10000));
    if (taken.every((t) => t.length !== 4 || diff(c, t) >= 2)) return c;
  }
  throw new Error("Couldn't make a new code — try again.");
}

/**
 * Nearest Cards → Set up a distributor's GRANTED cards (2026-11-14, owner — universal scratch-off card). One printed card
 * for everyone: Nearest uses ONE 16-digit number on every distributor's cards and makes each distributor their own 4-digit
 * code. The distributor's pool = how many discount rewards ($ off) + how many free-service rewards (e.g. 900 + 100);
 * students reveal which one they get by scratching. Saved as a DRAFT pool (one discount row + one free row) — Publish.
 */
export async function saveDistributorCards(_: FormState, form: FormData): Promise<FormState> {
  const { user, main } = await owner();
  if (!main) return { error: "Only the main owner can set up GRANTED cards." };
  const distributorId = s(form, "distributorId", 40);
  const isOwner = /^[0-9a-f-]{36}$/.test(distributorId) && await db.query.adminMembers.findFirst({ where: and(eq(adminMembers.userId, distributorId), eq(adminMembers.role, "OWNER")) });
  if (!isOwner) return { error: "Choose who these cards are for (Avy, Kisses or Lakeesha)." };
  // Any mix of discounts ($5 / $10 / $20 / $30 / $40 off — fields d5, d10, …) plus free services.
  const mix = [5, 10, 20, 30, 40].map((d) => ({ amountCents: d * 100, count: Number(s(form, `d${d}`, 6) || 0) }));
  const fCount = Number(s(form, "freeCount", 6) || 0);
  if ([...mix.map((m) => m.count), fCount].some((n) => !Number.isInteger(n) || n < 0 || n > 100000)) return { error: "Enter how many of each reward as whole numbers (0 for none)." };
  const dCount = mix.reduce((t, m) => t + m.count, 0);
  if (dCount + fCount < 1) return { error: "Enter how many of each reward (for example 900 discounts and 100 free services)." };
  if (mix.some((m) => m.count > 0 && (m.amountCents < CARD_LIMITS.discountMin || m.amountCents > CARD_LIMITS.discountMax))) return { error: "A discount is $5 to $40 off." };
  const validThru = endOfMonth(s(form, "validThru", 7));
  if (!validThru) return { error: "Enter Valid thru as the month printed on the card." };
  const already = (await db.execute(sql`select 1 from nearest_card_batches where scratch and distributor_id = ${distributorId} and status = 'active' limit 1`)).rows.length;
  if (already) return { error: "This person already has GRANTED cards set up. Edit their rows in GRANTED cards below, or turn them off first." };
  const number = await universalNumber();
  const code = await newScratchCode(number);
  const batchName = s(form, "name", 80) || "GRANTED cards";
  const dist = (await db.execute(sql`select coalesce(nullif(trim(first_name || ' ' || coalesce(last_name, '')), ''), email) as n from users where id = ${distributorId}`)).rows[0] as { n: string };
  const rows = [
    ...mix.filter((m) => m.count > 0).map((m) => ({ kind: "discount", amountCents: m.amountCents, count: m.count })),
    ...(fCount > 0 ? [{ kind: "free", amountCents: CARD_LIMITS.freeMax, count: fCount }] : []),
  ];
  const made = await db.insert(nearestCardBatches).values(rows.map((r) => ({
    name: `${batchName} — ${dist?.n ?? "Distributor"} — ${r.kind === "free" ? "Free service" : `$${r.amountCents / 100} off`}`, kind: r.kind, amountCents: r.amountCents, count: r.count, validThru,
    sharedNumber: number, sharedCode: code, distributorId, draft: true, scratch: true, createdBy: user.id,
  }))).returning();
  await logActivity({ actorUserId: user.id, action: "vouchers.cards_added", targetType: "voucher_campaign", targetId: made[0].id, after: { number, code, distributorId, discounts: mix.filter((m) => m.count > 0), free: fCount, validThru, draft: true } });
  refresh();
  return { ok: `${dist?.n ?? "Their"} GRANTED cards saved as a draft: number ${number.replace(/(\d{4})(?=\d)/g, "$1 ")}, code ${code}, ${mix.filter((m) => m.count > 0).map((m) => `${m.count} × $${m.amountCents / 100} off`).join(", ") || "no discounts"} + ${fCount} free service. Check it below, then Publish.` };
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
  // A scratch-off pool (discount + free rows on one number + code) is published together.
  await db.update(nearestCardBatches).set({ draft: false }).where(b.scratch
    ? and(eq(nearestCardBatches.sharedNumber, b.sharedNumber), eq(nearestCardBatches.sharedCode, b.sharedCode!), eq(nearestCardBatches.scratch, true))
    : eq(nearestCardBatches.id, id));
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
  // Scratch-off: on/off is the distributor's whole pool (pause switch) — both rows together.
  await db.update(nearestCardBatches).set({ status: on ? "active" : "off" }).where(b.scratch
    ? and(eq(nearestCardBatches.sharedNumber, b.sharedNumber), eq(nearestCardBatches.sharedCode, b.sharedCode!), eq(nearestCardBatches.scratch, true))
    : eq(nearestCardBatches.id, id));
  await logActivity({ actorUserId: user.id, action: on ? "vouchers.campaign_on" : "vouchers.campaign_off", targetType: "voucher_campaign", targetId: id, before: { status: b.status }, after: { status: on ? "active" : "off" } });
  refresh();
}

/**
 * Delete a voucher batch (main owner, 2026-11-14) — for batches made by mistake or replaced. A scratch-off card is
 * deleted as a whole (discount + free rows). Refused once any student has revealed, held or added a reward from it,
 * because those must keep working (Pause/Turn off instead). Its organization assignments and their history go with it;
 * a full copy is kept in the activity log. Votes that entered it simply forget it.
 */
export async function deleteVoucherCampaign(form: FormData) {
  const { user, main } = await owner();
  if (!main) return;
  const id = s(form, "id", 40);
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  const b = await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.id, id) });
  if (!b?.sharedNumber) return;
  const rows = b.scratch
    ? await db.select().from(nearestCardBatches).where(and(eq(nearestCardBatches.sharedNumber, b.sharedNumber), eq(nearestCardBatches.sharedCode, b.sharedCode!), eq(nearestCardBatches.scratch, true)))
    : [b];
  const ids = rows.map((r) => r.id);
  const idList = sql.join(ids.map((x) => sql`${x}::uuid`), sql`, `);
  const inUse = (await db.execute(sql`select
      (select count(*) from nearest_cards where batch_id in (${idList}))::int as cards,
      (select count(*) from reward_spins where batch_id in (${idList}))::int as spins`)).rows[0] as { cards: number; spins: number };
  if (inUse.cards || inUse.spins) redirect(`/admin/cards?vmsg=${encodeURIComponent("Students already have rewards from this batch, so it can't be deleted. Turn it off (or Pause) instead.")}#voucher-batches`);
  const dists = (await db.execute(sql`select * from voucher_distributions where batch_id in (${idList})`)).rows;
  await db.execute(sql`delete from voucher_distribution_events where distribution_id in (select id from voucher_distributions where batch_id in (${idList}))`);
  await db.execute(sql`delete from voucher_distributions where batch_id in (${idList})`);
  await db.execute(sql`update student_votes set pending_batch_id = null where pending_batch_id in (${idList})`);
  await db.execute(sql`delete from nearest_card_batches where id in (${idList}) and claimed = 0
    and not exists (select 1 from nearest_cards c where c.batch_id = nearest_card_batches.id)
    and not exists (select 1 from reward_spins r where r.batch_id = nearest_card_batches.id)`);
  await logActivity({ actorUserId: user.id, action: "vouchers.campaign_deleted", targetType: "voucher_campaign", targetId: id, before: { batches: rows, assignments: dists } });
  refresh();
  redirect(`/admin/cards?vmsg=${encodeURIComponent(`${rows[0].name.replace(/ — (Discount|Free service)$/, "")} deleted.`)}#voucher-batches`);
}
