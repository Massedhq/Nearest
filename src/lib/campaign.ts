import "server-only";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, campaigns, campaignEntries, campaignEvidence, campaignEvents, campaignWaitlist, studentProfiles, users } from "@/db";
import { chicagoToUtc, fmtDate, fmtTime } from "./time";

/**
 * Nearest student launch campaign — ELAPSED-TIME TRACKING + MANUAL EVIDENCE REVIEW.
 * The clock only measures 168 hours from the server-recorded start. It never checks social media and does not
 * prove the picture stayed up the whole time; admins review screenshots and check profiles by hand.
 */
export const CAMPAIGN_KEY = "launch-2026";
export const CAMPAIGN_HOURS = 168;
export const DAY_MS = 24 * 3600 * 1000;
export const CAMPAIGN_MS = CAMPAIGN_HOURS * 3600 * 1000;
export const MAX_UPLOADS_PER_WINDOW = 3;
export const EVIDENCE_MAX_BYTES = 4 * 1024 * 1024;
export const CLOCK_LABEL = "Elapsed-time tracking + manual evidence review";
export const CLOCK_DISCLAIMER =
  "This clock only counts the 168 hours since Nearest recorded your start. It doesn't watch your social account and doesn't prove the picture stayed up the whole time — Nearest reviews your screenshots and checks your profile by hand.";
export const DISCLOSURE_LINE = "I'm part of the Nearest launch campaign and get Nearest credit for using this picture. #ad";
/** The line students used before the reward became credit (kept so earlier bios still count). */
const LEGACY_DISCLOSURE = "I'm part of the Nearest launch campaign and get a free service for using this picture. #ad";

export type Campaign = typeof campaigns.$inferSelect;
export type Entry = typeof campaignEntries.$inferSelect;
export type Evidence = typeof campaignEvidence.$inferSelect;

export const STATUS_LABEL: Record<string, string> = {
  reserved: "Reserved",
  in_progress: "In progress",
  ready_for_review: "Ready for final review",
  needs_correction: "Needs correction",
  approved: "Approved",
  redeemed: "Approved — credit added",
  rejected: "Not approved",
  cancelled: "Cancelled",
};
/** Places that stay taken. Approved/redeemed are never given back. */
export const OCCUPYING = ["reserved", "in_progress", "ready_for_review", "needs_correction", "approved", "redeemed"];

/** The previous default steps — a campaign still holding them is upgraded to the new seven steps automatically. */
const LEGACY_INSTRUCTIONS = `1. Download the Nearest profile picture below.
2. Set it as your profile picture on Instagram, Facebook or TikTok (any one — no follower minimum).
3. Add this line to your bio while the picture is up: "${LEGACY_DISCLOSURE}"
4. Submit your profile link and a screenshot of your profile showing the picture. Your seven days (168 hours) start the moment Nearest accepts it.
5. Upload one screenshot of your profile in each of the seven daily windows shown on your campaign page.
6. After the full 168 hours, upload your final screenshot. Nearest then reviews everything by hand.
Never share your social media password — Nearest will never ask for it.`;

/** Every screenshot (starting, daily and final) must show this. */
export const SCREENSHOT_RULE = "Every screenshot must clearly show your account username and your profile picture.";

/** "How to participate" — shown in the invitation and kept on the campaign page throughout. One step per line. */
const FREE_SERVICE_INSTRUCTIONS = `1. Join the campaign to reserve your place.
2. Download the Nearest profile picture.
3. Change your Instagram, Facebook or TikTok profile picture to the Nearest picture, and add this line to your bio: "${LEGACY_DISCLOSURE}"
4. Submit your profile link and a screenshot of your profile. Your seven-day clock starts when Nearest accepts them.
5. Keep the Nearest picture up for seven full consecutive days, and upload a screenshot of your profile each day.
6. After the countdown ends, upload your final screenshot. Nearest reviews your screenshots and checks your profile.
7. Once you're approved, your reward appears in your Nearest account. Redeem it after booking opens.`;

/** "How to participate" — shown in the invitation and kept on the campaign page throughout. One step per line. */
export const DEFAULT_INSTRUCTIONS = `1. Join the campaign to reserve your place.
2. Download the Nearest profile picture.
3. Change your Instagram, Facebook or TikTok profile picture to the Nearest picture, and add this line to your bio: "${DISCLOSURE_LINE}"
4. Submit your profile link and a screenshot of your profile. Your seven-day clock starts when Nearest accepts them.
5. Keep the Nearest picture up for seven full consecutive days, and upload a screenshot of your profile each day.
6. After the countdown ends, upload your final screenshot. Nearest reviews your screenshots and checks your profile.
7. Once you're approved, your Nearest credit is added to your account automatically. Use it toward any service you book with a professional on Nearest.`;

/** The invitation shown after registration (and on the campaign page until the student joins). */
export const INVITE_HEADLINE = "Want to join the Nearest launch campaign?";
export const inviteBody = (credit: string) => `Complete the seven-day profile-picture promotion to earn ${credit} in Nearest credit toward any service you book with a professional.`;
export const invitePoints = (c: Pick<Campaign, "capacity" | "market">) => [
  "No minimum follower count.",
  "One campaign place and reward per verified student.",
  `${c.capacity} places across ${c.market === "DFW" ? "DFW" : c.market}.`,
  "Participation is optional and does not affect ordinary Nearest account access.",
  "Approval requires manual review; completing the countdown alone does not issue a reward.",
];
export const AGREE_TEXT = "I have read the campaign directions and reward terms and agree to participate.";
export const WAITLIST_NOTE = "A waitlist entry does not reserve a reward. If a place opens, it's offered in waitlist order and you're notified.";
/** The reward: Nearest credit, added once when Nearest approves the student's participation. */
export const rewardTitle = (credit: string) => `${credit} in Nearest credit`;
export const rewardIncludes = (credit: string) => `${credit} is added to your Nearest account as soon as Nearest approves your participation. Use it toward any service you book with any professional on Nearest — it's taken off your total automatically when you pay.`;
export const redemptionTerms = (credit: string) => [
  `${credit} in Nearest credit per approved student — added once, non-transferable, no cash value.`,
  "Use it toward any service with any professional on Nearest. If the service costs more, you pay the rest; anything left stays in your account for your next booking.",
  "It can't be used on Bundle Me bookings or withdrawn as cash.",
  "If a booking you paid with it is cancelled, the credit comes back under Nearest's normal credit rules.",
];

/** The credit amount from Rules & Settings (campaign.reward_credit_cents, $20 by default). */
export async function rewardCreditCents() {
  const { getSettings } = await import("./settings");
  return Math.max(0, Math.round(Number((await getSettings())["campaign.reward_credit_cents"] ?? 2000)));
}
export const creditLabel = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/**
 * Add the reward credit for an approved entry — exactly once. General credit (pro_id null) is usable with any
 * professional; the credit row's reason carries the entry id, so a second call finds it and adds nothing.
 */
export async function issueRewardCredit(entryId: string) {
  const { credits } = await import("@/db");
  const e = await db.query.campaignEntries.findFirst({ where: eq(campaignEntries.id, entryId) });
  if (!e || !["approved", "redeemed"].includes(e.status)) return null;
  const reason = `Launch campaign reward (${entryId})`;
  const had = await db.select({ id: credits.id }).from(credits).where(and(eq(credits.studentId, e.studentId), eq(credits.reason, reason))).limit(1);
  if (had.length) return null;
  const cents = await rewardCreditCents();
  if (!cents) return null;
  const r = await db.execute<{ id: string }>(sql`
    insert into credits (student_id, pro_id, amount_cents, reason)
    select ${e.studentId}::uuid, null, ${cents}, ${reason}
    where not exists (select 1 from credits where student_id = ${e.studentId}::uuid and reason = ${reason})
    returning id`);
  if (!r.rows.length) return null;
  await db.update(campaignEntries).set({ status: "redeemed", redeemedAt: new Date(), version: sql`${campaignEntries.version} + 1` }).where(and(eq(campaignEntries.id, entryId), eq(campaignEntries.status, "approved")));
  await recordEvent(entryId, null, "credit_added", `${creditLabel(cents)} Nearest credit added to the student's account.`);
  return cents;
}

const FREE_SERVICE_TERMS = `Nearest Launch Campaign — Terms (draft — edit before publishing)
• Participation is optional and does not affect ordinary Nearest account access. Open to verified Nearest students at schools in the campaign market. Students under 18 need parent/guardian approval on Nearest first. One entry and one reward per student.
• Places are limited. A place is reserved only when you join on Nearest. A waitlist entry does not reserve a reward.
• Your seven days are 168 hours from the moment Nearest's server accepts your profile link and starting screenshot. Submit one screenshot in each daily window and a final screenshot at or after 168 hours. Every screenshot must clearly show your account username and profile picture.
• Nearest reviews evidence manually and may visit your public profile. Screenshots support the review; they don't prove the picture was never changed. Nearest decides approval.
• Approved participants receive the reward described on the campaign page. It is one-time, non-transferable, has no cash value, and can be booked once booking opens, subject to available appointments with participating professionals. Booking opening does not guarantee an appointment on that day.
• If a reward booking is cancelled or declined it's returned to you; a no-show uses the reward.
• Nearest may cancel entries for duplicate accounts, false evidence or misuse.
• This campaign isn't sponsored or endorsed by Instagram, Facebook or TikTok.`;

export const DEFAULT_TERMS = `Nearest Launch Campaign — Terms (draft — edit before publishing)
• Participation is optional and does not affect ordinary Nearest account access. Open to verified Nearest students at schools in the campaign market. Students under 18 need parent/guardian approval on Nearest first. One entry and one reward per student.
• Places are limited. A place is reserved only when you join on Nearest. A waitlist entry does not reserve a reward.
• Your seven days are 168 hours from the moment Nearest's server accepts your profile link and starting screenshot. Submit one screenshot in each daily window and a final screenshot at or after 168 hours. Every screenshot must clearly show your account username and profile picture.
• Nearest reviews evidence manually and may visit your public profile. Screenshots support the review; they don't prove the picture was never changed. Nearest decides approval.
• Approved participants receive the Nearest credit shown on the campaign page, added to their Nearest account once. It can be used toward any service booked with a professional on Nearest (not on Bundle Me bookings). It is non-transferable, has no cash value and can't be withdrawn. If a booking paid with it is cancelled, the credit is returned under Nearest's normal credit rules.
• Nearest may cancel entries — and remove unused credit — for duplicate accounts, false evidence or misuse.
• This campaign isn't sponsored or endorsed by Instagram, Facebook or TikTok.`;

/** The campaign row (created with safe defaults — status "draft" — the first time it's read). */
export async function getCampaign(): Promise<Campaign> {
  const found = await db.query.campaigns.findFirst({ where: eq(campaigns.key, CAMPAIGN_KEY) });
  if (found) {
    // Upgrade a campaign still holding the old default steps to the seven-step directions.
    // Reward is Nearest credit now: directions and terms still holding the free-service defaults are updated to the
    // credit wording (anything the owner wrote themselves is left alone).
    const set: Partial<Campaign> = {};
    if (found.instructions === LEGACY_INSTRUCTIONS || found.instructions === FREE_SERVICE_INSTRUCTIONS) set.instructions = DEFAULT_INSTRUCTIONS;
    if (found.terms === FREE_SERVICE_TERMS) set.terms = DEFAULT_TERMS;
    if (Object.keys(set).length) {
      await db.update(campaigns).set(set).where(eq(campaigns.key, CAMPAIGN_KEY));
      return { ...found, ...set };
    }
    return found;
  }
  await db.insert(campaigns).values({
    key: CAMPAIGN_KEY, name: "Nearest launch campaign", status: "draft", capacity: 750, market: "DFW",
    bookingOpensAt: chicagoToUtc("2026-11-19", "00:00"), instructions: DEFAULT_INSTRUCTIONS, terms: DEFAULT_TERMS,
  }).onConflictDoNothing();
  return (await db.query.campaigns.findFirst({ where: eq(campaigns.key, CAMPAIGN_KEY) }))!;
}

export const fmtWhen = (d: Date) => `${fmtDate(d, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} at ${fmtTime(d)} CT`;
export const bookingOpensLabel = (c: Campaign) => (c.bookingOpensAt ? fmtDate(c.bookingOpensAt, { month: "long", day: "numeric", year: "numeric" }) : "a date to be announced");

// ---------- Profile links ----------
const HOSTS: Record<string, string> = {
  "instagram.com": "instagram", "facebook.com": "facebook", "fb.com": "facebook", "tiktok.com": "tiktok",
};
export const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" };

/** Instagram, Facebook or TikTok profile link → platform, clean https URL, and a comparable key. */
export function parseProfileUrl(raw: string): { platform: string; url: string; norm: string } | { error: string } {
  const t = raw.trim();
  if (!t) return { error: "Paste the link to your profile." };
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`); } catch { return { error: "That doesn't look like a link." }; }
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.|web\.|vm\.)/, "");
  const platform = HOSTS[host];
  if (!platform) return { error: "Use your Instagram, Facebook or TikTok profile link." };
  const path = u.pathname.replace(/\/+$/, "");
  if (!path || path === "/") return { error: "That's the home page — paste the link to your own profile." };
  if (/^\/(p|reel|reels|stories|explore|watch|share|groups|events|video)\b/i.test(path) || (platform === "tiktok" && /\/video\//.test(path))) {
    return { error: "That's a post, not your profile. Paste the link to your profile page." };
  }
  const keepQuery = platform === "facebook" && path === "/profile.php" && u.searchParams.get("id") ? `?id=${u.searchParams.get("id")}` : "";
  const url = `https://${host === "fb.com" ? "facebook.com" : `www.${host}`}${path}${keepQuery}`;
  return { platform, url, norm: `${platform}:${path.toLowerCase()}${keepQuery}` };
}

// ---------- Eligibility (always from real records) ----------
export type Eligibility =
  | { state: "eligible"; cityId: number | null; countyId: number | null; school: string }
  | { state: "incomplete"; message: string; href: string }
  | { state: "pending"; message: string; href: string }
  | { state: "outside"; message: string };

export async function campaignEligibility(user: typeof users.$inferSelect, profile: typeof studentProfiles.$inferSelect | null | undefined, c: Campaign): Promise<Eligibility> {
  if (!profile) return { state: "incomplete", message: "Finish creating your student account.", href: "/verify" };
  if (profile.verificationStatus !== "verified") {
    if (profile.verificationStatus === "pending" || profile.verificationStatus === "manual_review") {
      return { state: "pending", message: "Your student verification is being reviewed. You can join as soon as it's approved.", href: "/verify/status" };
    }
    const { verifyStep } = await import("./student");
    const step = (await verifyStep(user.id, profile)) ?? "/verify";
    return { state: "incomplete", message: profile.verificationStatus === "rejected" ? "Your verification needs attention before you can join." : "Finish verifying that you're a student to join.", href: step };
  }
  const { needsGuardian } = await import("./guardian");
  if (needsGuardian(user) && profile.guardianStatus !== "approved") {
    return { state: "incomplete", message: "Your parent or guardian needs to approve your Nearest account first.", href: "/verify/parent" };
  }
  if (!profile.schoolId) return { state: "outside", message: `The launch campaign is for students at schools in the ${c.market} area.` };
  const { schoolArea } = await import("./student");
  const area = await schoolArea(profile.schoolId);
  if (!area || area.market !== c.market) return { state: "outside", message: `The launch campaign is for students at schools in the ${c.market === "DFW" ? "DFW Metroplex" : c.market} area.` };
  return { state: "eligible", cityId: area.cityId, countyId: area.countyId ?? null, school: area.school };
}

export async function entryFor(studentId: string) {
  return db.query.campaignEntries.findFirst({ where: and(eq(campaignEntries.campaignKey, CAMPAIGN_KEY), eq(campaignEntries.studentId, studentId)) });
}

export async function recordEvent(entryId: string, actorId: string | null, kind: string, detail?: string | null) {
  await db.insert(campaignEvents).values({ entryId, actorId, kind, detail: detail ?? null });
}

/** Signs that two accounts may be the same person — flagged for review, never auto-blocked. */
async function duplicateFlags(studentId: string) {
  const u = await db.query.users.findFirst({ where: eq(users.id, studentId) });
  if (!u?.firstName || !u.lastName) return null;
  const rows = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from campaign_entries e join users x on x.id = e.student_id
    where e.student_id <> ${studentId} and lower(trim(x.first_name)) = lower(trim(${u.firstName})) and lower(trim(x.last_name)) = lower(trim(${u.lastName}))
      and ${u.dateOfBirth ?? null}::date is not null and x.date_of_birth = ${u.dateOfBirth ?? null}::date`);
  return rows.rows[0]?.n ? "Possible duplicate account: same name and date of birth as another participant." : null;
}

/**
 * Join: reserves a place atomically. One statement increments the counter only while open and under capacity,
 * then inserts the entry; a duplicate join gives the place straight back. Can't overfill under simultaneous joins.
 */
export async function reservePlace(studentId: string, area: { cityId: number | null; countyId: number | null }, opts: { termsVersion: string | null; fromWaitlist?: boolean } ) {
  const flags = await duplicateFlags(studentId);
  const r = await db.execute<{ took: number; id: string | null }>(sql`
    with slot as (
      update campaigns set occupied = occupied + 1, updated_at = now()
      where key = ${CAMPAIGN_KEY} and status = 'open' and occupied < capacity
      returning key
    ), ins as (
      insert into campaign_entries (campaign_key, student_id, status, terms_version, terms_accepted_at, city_id, county_id, from_waitlist, flags)
      select key, ${studentId}::uuid, 'reserved', ${opts.termsVersion}, now(), ${area.cityId}, ${area.countyId}, ${opts.fromWaitlist ?? false}, ${flags} from slot
      on conflict (campaign_key, student_id) do nothing
      returning id
    )
    select (select count(*) from slot)::int as took, (select id from ins) as id`);
  const row = r.rows[0];
  if (row?.took && !row.id) {
    // Already enrolled (double tap): give the extra place back.
    await db.update(campaigns).set({ occupied: sql`greatest(${campaigns.occupied} - 1, 0)` }).where(eq(campaigns.key, CAMPAIGN_KEY));
    return { already: true as const };
  }
  if (!row?.id) return { full: true as const };
  await recordEvent(row.id, studentId, opts.fromWaitlist ? "waitlist_placed" : "enrolled", opts.fromWaitlist ? "A place opened and was reserved from the waitlist." : null);
  if (flags) await recordEvent(row.id, null, "flagged", flags);
  return { id: row.id };
}

/** Give back an unearned place (cancelled/rejected, never approved). Atomic and only once. */
export async function releasePlace(entryId: string) {
  const r = await db.execute<{ occupied: number }>(sql`
    with rel as (
      update campaign_entries set place_released = true, version = version + 1
      where id = ${entryId}::uuid and not place_released and status in ('cancelled','rejected') and approved_at is null and redeemed_at is null
      returning campaign_key
    )
    update campaigns set occupied = greatest(occupied - 1, 0), updated_at = now() where key in (select campaign_key from rel) returning occupied`);
  return r.rows.length > 0;
}

/** Reserve released places for the next waitlisted students who are still eligible, and tell them. */
export async function fillFromWaitlist(limit = 25) {
  const c = await getCampaign();
  if (c.status !== "open") return 0;
  let placed = 0;
  const waiting = await db.select().from(campaignWaitlist)
    .where(and(eq(campaignWaitlist.campaignKey, CAMPAIGN_KEY), eq(campaignWaitlist.status, "waiting"))).orderBy(asc(campaignWaitlist.joinedAt)).limit(200);
  for (const w of waiting) {
    if (placed >= limit) break;
    const fresh = await getCampaign();
    if (fresh.status !== "open" || fresh.occupied >= fresh.capacity) break;
    const u = await db.query.users.findFirst({ where: eq(users.id, w.studentId) });
    const p = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, w.studentId) });
    if (!u) continue;
    const el = await campaignEligibility(u, p, fresh);
    if (el.state !== "eligible") continue; // stays on the list until eligible again
    const res = await reservePlace(w.studentId, el, { termsVersion: fresh.termsVersion, fromWaitlist: true });
    if ("full" in res) break;
    await db.update(campaignWaitlist).set({ status: "placed", placedAt: new Date() }).where(eq(campaignWaitlist.id, w.id));
    if ("id" in res) {
      const { notifyOnce } = await import("./campaign-notify");
      await notifyOnce(`waitlist-placed:${res.id}`, w.studentId, {
        title: "A launch campaign place is reserved for you",
        body: "A place opened up and it's yours. Open your campaign page to start your seven days.",
        href: "/campaign",
        email: { subject: "Your Nearest launch campaign place is reserved", heading: "A place opened up — it's reserved for you.", lines: ["Open your campaign page to download the picture and start your seven days."], button: "Open my campaign" },
      });
      placed++;
    }
  }
  return placed;
}

// ---------- The 168-hour clock ----------
export type WindowState = "upcoming" | "open" | "submitted" | "missing";
export type DayWindow = { index: number; opensAt: Date; closesAt: Date; state: WindowState; uploads: Evidence[] };

/** Seven 24-hour windows from the server-recorded start. Day 1 includes the starting screenshot. */
export function dayWindows(entry: Pick<Entry, "startedAt">, evidence: Evidence[], now = new Date()): DayWindow[] {
  if (!entry.startedAt) return [];
  const t0 = entry.startedAt.getTime();
  return Array.from({ length: 7 }, (_, i) => {
    const opensAt = new Date(t0 + i * DAY_MS), closesAt = new Date(t0 + (i + 1) * DAY_MS);
    const uploads = evidence.filter((e) => e.windowIndex === i + 1).sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime());
    const state: WindowState = uploads.length ? "submitted" : now < opensAt ? "upcoming" : now < closesAt ? "open" : "missing";
    return { index: i + 1, opensAt, closesAt, state, uploads };
  });
}

export function finalProof(entry: Pick<Entry, "completesAt">, evidence: Evidence[], now = new Date()) {
  const uploads = evidence.filter((e) => e.windowIndex === 8).sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime());
  const state = uploads.length ? "submitted" : !entry.completesAt || now < entry.completesAt ? "not_yet" : "missing";
  return { state: state as "submitted" | "not_yet" | "missing", uploads, opensAt: entry.completesAt };
}

/** In progress becomes "Ready for final review" once 168 hours have passed — never "Approved" automatically. */
export function effectiveStatus(entry: Pick<Entry, "status" | "completesAt">, now = new Date()) {
  if (entry.status === "in_progress" && entry.completesAt && now >= entry.completesAt) return "ready_for_review";
  return entry.status;
}

/** Plain list of what's missing, for the student and for the admin's decision. */
export function missingEvidence(entry: Pick<Entry, "startedAt" | "completesAt">, evidence: Evidence[], now = new Date()) {
  const out: string[] = [];
  if (!entry.startedAt) return ["Starting screenshot and profile link"];
  for (const w of dayWindows(entry, evidence, now)) if (w.state === "missing") out.push(`Day ${w.index} screenshot`);
  if (finalProof(entry, evidence, now).state === "missing") out.push("Final screenshot (after 168 hours)");
  return out;
}

/** Which window an upload right now would count toward (server decides on upload; this is for the label). */
export function currentWindow(entry: Pick<Entry, "startedAt" | "completesAt">, now = new Date()) {
  if (!entry.startedAt || !entry.completesAt) return null;
  if (now >= entry.completesAt) return 8;
  return Math.floor((now.getTime() - entry.startedAt.getTime()) / DAY_MS) + 1;
}

export async function evidenceFor(entryId: string) {
  return db.select().from(campaignEvidence).where(eq(campaignEvidence.entryId, entryId)).orderBy(asc(campaignEvidence.uploadedAt));
}

/** A student already has (or had) a campaign reward somewhere — one reward per student, across campaigns. */
export async function hasOtherReward(studentId: string, exceptEntryId: string) {
  const r = await db.select({ id: campaignEntries.id }).from(campaignEntries)
    .where(and(eq(campaignEntries.studentId, studentId), ne(campaignEntries.id, exceptEntryId), inArray(campaignEntries.status, ["approved", "redeemed"]))).limit(1);
  return r.length > 0;
}

/** Campaign counts for admin. */
export async function campaignCounts() {
  type Counts = { reserved: number; active: number; needs_correction: number; ready: number; approved: number; redeemed: number; cancelled: number; rejected: number; occupied_actual: number };
  const r = await db.execute<Counts>(sql`
    select
      count(*) filter (where status = 'reserved')::int as reserved,
      count(*) filter (where status = 'in_progress' and completes_at > now())::int as active,
      count(*) filter (where status = 'needs_correction')::int as needs_correction,
      count(*) filter (where status = 'ready_for_review' or (status = 'in_progress' and completes_at <= now()))::int as ready,
      count(*) filter (where status = 'approved')::int as approved,
      count(*) filter (where status = 'redeemed')::int as redeemed,
      count(*) filter (where status = 'cancelled')::int as cancelled,
      count(*) filter (where status = 'rejected')::int as rejected,
      count(*) filter (where status in ('reserved','in_progress','ready_for_review','needs_correction','approved','redeemed'))::int as occupied_actual
    from campaign_entries where campaign_key = ${CAMPAIGN_KEY}`);
  const w = await db.execute<{ n: number }>(sql`select count(*)::int as n from campaign_waitlist where campaign_key = ${CAMPAIGN_KEY} and status = 'waiting'`);
  return { ...(r.rows[0] as Counts), waitlist: w.rows[0]?.n ?? 0 };
}

/** Everything still needed before the campaign can be opened. Empty = ready. */
export async function readinessProblems(c: Campaign) {
  const out: string[] = [];
  if (!c.graphicUrl) out.push("Add the approved profile picture graphic.");
  if (!c.instructions?.trim()) out.push("Write the student instructions.");
  if (!c.termsPublishedAt) out.push("Review and publish the campaign terms.");
  if (!c.bookingOpensAt) out.push("Set the booking-opening date and time.");
  return out;
}
