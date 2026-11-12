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
 * - at most vouchers.max_activations (1,500) different students across all campaigns. Students already counted can still
 *   add their other voucher type; everyone can always create a normal account.
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

export async function maxActivations() {
  const { getSettings } = await import("./settings");
  const n = Number((await getSettings())["vouchers.max_activations"] ?? 1500);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 1500;
}

/** Different students who have activated any GRANTED voucher (turned-off campaigns still count — those students keep it). */
export async function activatedStudents() {
  const r = (await db.execute(sql`select count(distinct student_id)::int as n from nearest_cards where shared and student_id is not null and status = 'activated'`)).rows[0] as { n: number };
  return r.n;
}

/** The voucher campaign printed with this number (any status), or null. */
export async function campaignByNumber(number: string) {
  return (await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.sharedNumber, number) })) ?? null;
}

export type CampaignCheck = { ok: true; batch: typeof nearestCardBatches.$inferSelect } | { ok: false; error: string };

/** Checks a number + code against the voucher campaigns (no account needed). Null = not a voucher number at all. */
export async function checkCampaign(number: string, code: string): Promise<CampaignCheck | null> {
  const b = await campaignByNumber(number);
  if (!b) return null;
  if (b.sharedCode !== code) return { ok: false, error: "That voucher number and security code don't match. The discount voucher has a 3-digit code and the free-service voucher a 4-digit code — enter the one printed on your voucher." };
  if (b.status !== "active") return { ok: false, error: "This voucher campaign has ended. You can still create your free Nearest account." };
  if (b.validThru.getTime() < Date.now()) return { ok: false, error: "This voucher has expired. You can still create your free Nearest account." };
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
  const max = await maxActivations();
  // One statement: only inserts while under the student limit (students already counted can still add their other type).
  const r = await db.execute(sql`insert into nearest_cards (batch_id, number, code, status, student_id, activated_at, shared)
    select ${batch.id}, ${batch.sharedNumber}, ${batch.sharedCode}, 'activated', ${userId}, now(), true
    where exists (select 1 from nearest_cards where shared and student_id = ${userId} and status = 'activated')
       or (select count(distinct student_id) from nearest_cards where shared and student_id is not null and status = 'activated') < ${max}
    on conflict do nothing returning id`);
  const row = r.rows[0] as { id: string } | undefined;
  if (!row) {
    const again = await db.query.nearestCards.findFirst({ where: and(eq(nearestCards.batchId, batch.id), eq(nearestCards.studentId, userId), eq(nearestCards.shared, true)) });
    if (again) return { ok: false, error: "This voucher is already activated on your account — choose it when you pay for a booking." };
    return { ok: false, error: "All GRANTED voucher activations have been claimed. Your Nearest account still works — you just can't add a voucher right now." };
  }
  return { ok: true, id: row.id, amountCents: batch.amountCents, kind };
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
    if (r.linked) return `/cards?welcome=1${r.voucher ? `&v=${r.voucher.ok ? "ok" : "no"}` : ""}`;
  } catch (e) { console.error("claimVote", e); }
  return "/verify";
}
