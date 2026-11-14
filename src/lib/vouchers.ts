import "server-only";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, nearestCardBatches, nearestCards, studentVotes, studentProfiles } from "@/db";

/**
 * Nearest GRANTED Certificate Vouchers (2026-11-11) — replace the individually numbered Nearest Card as the promotional
 * handout. Every voucher of one campaign (distributor × discount|free) carries the SAME 16-digit number and code, so:
 * - a campaign is a nearest_card_batches row with shared_number / shared_code / distributor_id;
 * - each student who activates it gets their OWN nearest_cards row (shared = true, one per campaign per student — unique
 *   index), so checkout, promo credit, payouts and "Used" all work exactly like Nearest Cards (src/lib/nearest-cards.ts);
 * - one discount + one free-service voucher per student at most;
 * - each campaign takes at most `count` unique student claims (900 discount / 100 free per distributor — 3,000 in all),
 *   counted atomically in nearest_card_batches.claimed. Voting and registration are never limited.
 * - a distributor has ONE 16-digit number for both types; the code (3 digits discount / 4 digits free) picks the campaign.
 * Vouchers have no 30-day save window — they're good until the campaign's Valid thru date (or turned off).
 * The /card page is the "YOUR CITY. YOUR CHOICE." vote (src/app/vote-actions.ts); votes live in student_votes.
 */
export const VOTE_COOKIE = "nearest_vote";
export const VOUCHER = { name: "Nearest GRANTED Certificate Voucher", short: "GRANTED voucher", triesPerHour: 5 };

export const voucherLabel = (kind: string) => (kind === "free" ? "GRANTED Voucher — free service" : "GRANTED Voucher — discount");

/** The benefit of THIS campaign, read from its own type and value (free-service vs discount) — never a fixed wording. */
export const benefitLine = (kind: string, amountCents: number) => {
  const amt = `$${(amountCents / 100).toFixed(amountCents % 100 ? 2 : 0)}`;
  return kind === "free" ? "GRANTED free-service voucher" : `GRANTED discount voucher (${amt} off a service)`;
};

/** Is this number a published GRANTED voucher number (any distributor, any status)? */
export async function campaignByNumber(number: string) {
  return (await db.query.nearestCardBatches.findFirst({ where: and(eq(nearestCardBatches.sharedNumber, number), eq(nearestCardBatches.draft, false)) })) ?? null;
}

export type CampaignCheck = { ok: true; batch: typeof nearestCardBatches.$inferSelect } | { ok: false; error: string };

/**
 * Checks a number + code against the published voucher campaigns (no account needed). The number names the distributor,
 * the code the type. Null = not a voucher number at all. A security code only identifies a campaign — it never opens an account.
 */
export async function checkCampaign(number: string, code: string): Promise<CampaignCheck | null> {
  if (!(await campaignByNumber(number))) return null;
  const b = (await db.query.nearestCardBatches.findFirst({ where: and(eq(nearestCardBatches.sharedNumber, number), eq(nearestCardBatches.sharedCode, code), eq(nearestCardBatches.draft, false)) })) ?? null;
  if (!b) return { ok: false, error: "That voucher number and security code don't match. The discount voucher has a 3-digit code and the free-service voucher a 4-digit code — enter the one printed on your voucher." };
  if (b.status !== "active") return { ok: false, error: "This voucher campaign has ended. You can still create your free Nearest account." };
  if (b.validThru.getTime() < Date.now()) return { ok: false, error: "This voucher has expired. You can still create your free Nearest account." };
  if (b.claimed >= b.count) return { ok: false, error: "All vouchers in this campaign have been claimed. You can still create your free Nearest account." };
  return { ok: true, batch: b };
}

/** Attach a voucher campaign to a student's account (their own nearest_cards row). Safe to call twice. */
export async function activateVoucher(userId: string, batch: typeof nearestCardBatches.$inferSelect): Promise<{ ok: true; id: string; amountCents: number; kind: string } | { ok: false; error: string }> {
  const kind = batch.kind;
  const same = (await db.execute(sql`select c.id, c.batch_id as "batchId" from nearest_cards c join nearest_card_batches b on b.id = c.batch_id
    where c.shared and c.student_id = ${userId} and c.status = 'activated' and b.kind = ${kind} limit 1`)).rows[0] as { id: string; batchId: string } | undefined;
  if (same) return same.batchId === batch.id
    ? { ok: false, error: "This voucher is already activated on your account — choose it when you pay for a booking." }
    : { ok: false, error: `You already have a ${kind === "free" ? "free-service" : "discount"} GRANTED voucher on your account. It's one of each type per student.` };
  // A student with an online reward-wheel card can't also activate a physical voucher (and the other way round — claimSpin).
  const online = (await db.execute(sql`select 1 from nearest_cards c join nearest_card_batches b on b.id = c.batch_id
    where c.shared and c.student_id = ${userId} and c.status = 'activated' and b.channel = 'digital' limit 1`)).rows.length;
  if (online) return { ok: false, error: "You already have a GRANTED card from the online reward wheel — it's one GRANTED card per student." };
  const already = await db.query.nearestCards.findFirst({ where: and(eq(nearestCards.batchId, batch.id), eq(nearestCards.studentId, userId), eq(nearestCards.shared, true)) });
  if (already) return { ok: false, error: "This voucher is already activated on your account — choose it when you pay for a booking." };
  // Bring the claim counter up to date (only ever raises it), then take one place and add the claim in ONE statement.
  // The UPDATE locks the campaign row, so concurrent claims queue and can never pass the campaign's limit.
  await db.execute(sql`update nearest_card_batches b set claimed = x.n
    from (select count(*)::int as n from nearest_cards where batch_id = ${batch.id} and shared) x where b.id = ${batch.id} and b.claimed < x.n`);
  const r = await db.execute(sql`with slot as (
      update nearest_card_batches set claimed = claimed + 1 where id = ${batch.id} and claimed < count returning id)
    insert into nearest_cards (batch_id, number, code, status, student_id, activated_at, shared)
    select ${batch.id}, ${batch.sharedNumber}, ${batch.sharedCode}, 'activated', ${userId}, now(), true from slot
    on conflict do nothing returning id`);
  const row = r.rows[0] as { id: string } | undefined;
  if (!row) {
    const again = await db.query.nearestCards.findFirst({ where: and(eq(nearestCards.batchId, batch.id), eq(nearestCards.studentId, userId), eq(nearestCards.shared, true)) });
    if (again) {
      // Same student twice at once: give the place back.
      await db.execute(sql`update nearest_card_batches set claimed = greatest(claimed - 1, 0) where id = ${batch.id}`);
      return { ok: false, error: "This voucher is already activated on your account — choose it when you pay for a booking." };
    }
    return { ok: false, error: "All vouchers in this campaign have been claimed. Your Nearest account still works — you just can't add this voucher." };
  }
  try { await attributeActivation(row.id, userId, batch); } catch (e) { console.error("attributeActivation", e); }
  return { ok: true, id: row.id, amountCents: batch.amountCents, kind };
}

/**
 * Student-reported attribution: copy where the student said they got the voucher (their vote) onto this activation, and
 * match it to THIS distributor's assignment to that location (same type first). No assignment there, or "Other" /
 * "Someone gave it to me" → unmatched, kept for the main owner to review. Never moved to an unrelated organization.
 */
export async function attributeActivation(cardId: string, userId: string, batch: { id: string; kind: string; distributorId: string | null }) {
  const v = (await db.select().from(studentVotes).where(eq(studentVotes.userId, userId)).limit(1))[0];
  if (!v?.sourceKind) { await db.update(nearestCards).set({ sourceMatch: "none" }).where(eq(nearestCards.id, cardId)); return; }
  let distributionId: string | null = null;
  if (v.sourceKind === "org" && v.sourcePlaceId && batch.distributorId) {
    const m = (await db.execute(sql`select d.id from voucher_distributions d join nearest_card_batches b on b.id = d.batch_id
      where d.place_id = ${v.sourcePlaceId} and b.distributor_id = ${batch.distributorId} and d.status <> 'cancelled'
      order by (b.kind = ${batch.kind}) desc, d.distributed_at desc limit 1`)).rows[0] as { id: string } | undefined;
    distributionId = m?.id ?? null;
  }
  await db.update(nearestCards).set({ sourcePlaceId: v.sourcePlaceId, sourceText: v.sourceText, distributionId, sourceMatch: distributionId ? "matched" : "unmatched" }).where(eq(nearestCards.id, cardId));
}

/** The current anonymous vote session id (cookie), creating one when asked. */
export async function voteSession(create = false) {
  const jar = await cookies();
  let id = jar.get(VOTE_COOKIE)?.value ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    if (!create) return null;
    id = randomUUID();
    jar.set(VOTE_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 90 });
  }
  return id;
}

/**
 * After sign-up or sign-in: link this browser's vote to the student (no second vote), copy their school and picked
 * services onto the profile when empty, and activate the voucher they entered on the thank-you screen.
 * Returns what happened so the page can show it.
 */
export async function claimVote(userId: string): Promise<{ linked: boolean; voucher?: { ok: boolean; message: string } }> {
  const sid = await voteSession(false);
  if (!sid) return { linked: false };
  const v = await db.query.studentVotes.findFirst({ where: eq(studentVotes.sessionId, sid) });
  if (!v) return { linked: false };
  if (v.userId && v.userId !== userId) return { linked: false }; // someone else's vote on a shared device
  if (!v.userId) {
    // A student who already voted on another device keeps ONE vote: the newest replaces the older linked one.
    await db.update(studentVotes).set({ userId: null, linkedAt: null }).where(and(eq(studentVotes.userId, userId)));
    await db.update(studentVotes).set({ userId, linkedAt: new Date() }).where(and(eq(studentVotes.id, v.id), isNull(studentVotes.userId)));
  }
  const p = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, userId) });
  if (p) {
    const set: Partial<typeof studentProfiles.$inferInsert> = {};
    if (!p.schoolId && v.schoolId) set.schoolId = v.schoolId;
    if (!(p.interests ?? []).length && v.categories.length) set.interests = v.categories;
    if (Object.keys(set).length) await db.update(studentProfiles).set(set).where(eq(studentProfiles.userId, userId));
  }
  let voucher: { ok: boolean; message: string } | undefined;
  if (v.pendingBatchId) {
    const b = await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.id, v.pendingBatchId) });
    if (b) {
      const r = await activateVoucher(userId, b);
      voucher = r.ok ? { ok: true, message: `Your ${benefitLine(b.kind, b.amountCents)} is now linked to your student account. Choose it at checkout once you're verified to book.` } : { ok: false, message: r.error };
    }
    await db.update(studentVotes).set({ pendingBatchId: null }).where(eq(studentVotes.id, v.id));
  }
  return { linked: true, voucher };
}

/**
 * Where a brand-new student goes. Voted on /card first (GRANTED voucher flow)? Link that vote, activate the voucher they
 * entered, and send them to Cards & activations — school ID + selfie and parent approval come later, before booking.
 * Everyone else keeps the normal verification steps.
 */
export async function afterStudentCreated(userId: string): Promise<string> {
  try {
    const r = await claimVote(userId);
    // Online voters with a reward-wheel result go to Cards & activations too — claimSpin adds the card there.
    const { mySpin } = await import("./reward-wheel");
    const spun = await mySpin().catch(() => null);
    if (r.linked || spun) {
      try { const { sendAdEvent } = await import("./ad-tags"); await sendAdEvent("CompleteRegistration", `reg-${userId}`); } catch { /* never blocks */ }
      return `/cards?welcome=1${r.voucher ? `&v=${r.voucher.ok ? "ok" : "no"}` : ""}`;
    }
  } catch (e) { console.error("claimVote", e); }
  return "/verify";
}
