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
export const DISCLOSURE_LINE = "I'm part of the Nearest launch campaign and get a free service for using this picture. #ad";

export type Campaign = typeof campaigns.$inferSelect;
export type Entry = typeof campaignEntries.$inferSelect;
export type Evidence = typeof campaignEvidence.$inferSelect;

export const STATUS_LABEL: Record<string, string> = {
  reserved: "Reserved",
  in_progress: "In progress",
  ready_for_review: "Ready for final review",
  needs_correction: "Needs correction",
  approved: "Approved",
  redeemed: "Redeemed",
  rejected: "Not approved",
  cancelled: "Cancelled",
};
/** Places that stay taken. Approved/redeemed are never given back. */
export const OCCUPYING = ["reserved", "in_progress", "ready_for_review", "needs_correction", "approved", "redeemed"];

export const DEFAULT_INSTRUCTIONS = `1. Download the Nearest profile picture below.
2. Set it as your profile picture on Instagram, Facebook or TikTok (any one — no follower minimum).
3. Add this line to your bio while the picture is up: "${DISCLOSURE_LINE}"
4. Submit your profile link and a screenshot of your profile showing the picture. Your seven days (168 hours) start the moment Nearest accepts it.
5. Upload one screenshot of your profile in each of the seven daily windows shown on your campaign page.
6. After the full 168 hours, upload your final screenshot. Nearest then reviews everything by hand.
Never share your social media password — Nearest will never ask for it.`;

export const DEFAULT_TERMS = `Nearest Launch Campaign — Terms (draft — edit before publishing)
• Open to verified Nearest students at schools in the campaign market. Students under 18 need parent/guardian approval on Nearest first. One entry and one reward per student.
• Places are limited. A place is reserved only when you join on Nearest.
• Your seven days are 168 hours from the moment Nearest's server accepts your profile link and starting screenshot. Submit one screenshot in each daily window and a final screenshot at or after 168 hours.
• Nearest reviews evidence manually and may visit your public profile. Screenshots support the review; they don't prove the picture was never changed. Nearest decides approval.
• Approved participants receive the reward described on the campaign page. It is one-time, non-transferable, has no cash value, and can be booked once booking opens, subject to available appointments with participating professionals. Booking opening does not guarantee an appointment on that day.
• If a reward booking is cancelled or declined it's returned to you; a no-show uses the reward.
• Nearest may cancel entries for duplicate accounts, false evidence or misuse.
• This campaign isn't sponsored or endorsed by Instagram, Facebook or TikTok.`;

/** The campaign row (created with safe defaults — status "draft" — the first time it's read). */
export async function getCampaign(): Promise<Campaign> {
  const found = await db.query.campaigns.findFirst({ where: eq(campaigns.key, CAMPAIGN_KEY) });
  if (found) return found;
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
  if (!c.rewardTitle?.trim() || !c.rewardIncludes?.trim()) out.push("Describe exactly what the free service includes.");
  const offers = await db.execute<{ n: number; slots: number }>(sql`select count(*)::int as n, coalesce(sum(slots_total),0)::int as slots from campaign_offers where campaign_key = ${CAMPAIGN_KEY} and active and confirmed_at is not null`);
  if (!offers.rows[0]?.n) out.push("Add at least one confirmed reward arrangement (a participating professional, service, payout and appointment capacity).");
  if (!c.rewardConfirmedAt) out.push("Confirm that the reward is arranged and funded.");
  return out;
}
