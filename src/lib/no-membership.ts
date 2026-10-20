import "server-only";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db, professionalProfiles, proServices, users } from "@/db";
import { MEMBERSHIP_ENABLED } from "./membership";

/**
 * No monthly membership (2026-10-17). Two cron jobs and one pro action:
 *  - endOldMemberships(): every old Stripe membership is cancelled — at the end of the month already paid for (no
 *    refund owed, no further charge), or right away if it's past due / unpaid. Each pro is told once.
 *  - releaseInactiveSpots(): spots are for pros who take bookings. A pro who joined 30+ days ago (clock restarts when a
 *    spot is reclaimed) and still isn't live for reasons on their side gets a warning at day 23 and is released at day
 *    30 (never sooner than 6 days after the warning). Not counted: anyone waiting on Nearest (profile in review or ID
 *    check pending), owners' businesses, Ambassador / pay-from-bookings accounts.
 *  - reclaimSpot(): a released pro takes their spot back if their city still has room in their categories.
 */

const BASE = () => process.env.APP_URL || "https://www.usenearest.com";
async function tell(userId: string, kind: string, title: string, body: string, href: string, email?: { subject: string; heading: string; lines: string[]; button: string }) {
  try {
    const { inbox } = await import("./inbox");
    await inbox(userId, { kind, title, body, href });
    if (email) {
      const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
      if (u?.email) await (await import("./email")).sendEmail({ to: u.email, subject: email.subject, eyebrow: "Nearest", heading: email.heading, lines: email.lines, button: { label: email.button, url: `${BASE()}${href}` } });
    }
  } catch (e) { console.error("no-membership notify", e); }
}

export async function endOldMemberships() {
  if (MEMBERSHIP_ENABLED) return 0;
  const { stripe, stripeEnabled } = await import("./stripe");
  if (!stripeEnabled()) return 0;
  const rows = await db.select().from(professionalProfiles).where(and(
    isNotNull(professionalProfiles.subscriptionId), isNull(professionalProfiles.membershipEndsAt),
    inArray(professionalProfiles.subscriptionStatus, ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]),
  )).limit(25);
  let n = 0;
  for (const p of rows) {
    try {
      const s = stripe();
      let endsAt = new Date();
      if (p.subscriptionStatus === "active" || p.subscriptionStatus === "trialing") {
        // They already paid for this month: it simply doesn't renew.
        const sub = await s.subscriptions.update(p.subscriptionId!, { cancel_at_period_end: true });
        const end = (sub as unknown as { cancel_at?: number | null; current_period_end?: number }).cancel_at ?? (sub as unknown as { current_period_end?: number }).current_period_end
          ?? (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end;
        endsAt = end ? new Date(end * 1000) : p.currentPeriodEnd ?? new Date();
      } else {
        // Past due / unpaid: stop collection now so no further charge is attempted.
        await s.subscriptions.cancel(p.subscriptionId!);
        await db.update(professionalProfiles).set({ subscriptionStatus: "canceled" }).where(eq(professionalProfiles.userId, p.userId));
      }
      await db.update(professionalProfiles).set({ membershipEndsAt: endsAt, membershipPausedAt: null }).where(eq(professionalProfiles.userId, p.userId));
      await tell(p.userId, "account", "No more monthly membership", "Nearest no longer charges a monthly membership. Yours is cancelled — you won't be charged again. Nearest only earns its service fee on completed bookings.", "/pro/payments",
        { subject: "Good news: no more monthly membership", heading: "There's no monthly membership anymore.", lines: ["Being on Nearest is now free. Nearest only earns its $5 service fee on each completed booking.", "Your membership is cancelled and you won't be charged again. Nothing else about your account changes."], button: "See your fees" });
      n++;
    } catch (e) { console.error("endOldMemberships", p.userId, e); }
  }
  return n;
}

/** Pros whose spot clock counts: joined, not released, not live, not waiting on Nearest, not exempt. */
const notLiveOnTheirSide = sql`${professionalProfiles.entryPaidAt} is not null and ${professionalProfiles.placementReleasedAt} is null
  and not (${professionalProfiles.reviewStatus} = 'approved' and ${professionalProfiles.searchable} and ${professionalProfiles.identityStatus} = 'verified')
  and ${professionalProfiles.reviewStatus} <> 'submitted' and ${professionalProfiles.identityStatus} <> 'pending'
  and coalesce(${professionalProfiles.entryType}, '') not in ('AMBASSADOR', 'BOOKING_PAID')
  and ${professionalProfiles.invitationId} is null
  and not exists (select 1 from admin_members a where a.user_id = ${professionalProfiles.userId} and a.role = 'OWNER' and a.active)`;
const clock = sql`coalesce(${professionalProfiles.spotClockAt}, ${professionalProfiles.entryPaidAt})`;

export async function releaseInactiveSpots() {
  if (MEMBERSHIP_ENABLED) return { warned: 0, released: 0 };
  const { isOwnerBusiness } = await import("./entry");
  const toWarn = await db.select().from(professionalProfiles).where(and(notLiveOnTheirSide, isNull(professionalProfiles.spotWarnedAt), sql`${clock} < now() - interval '23 days'`)).limit(100);
  let warned = 0;
  for (const p of toWarn) {
    if (await isOwnerBusiness(p.userId)) continue;
    await db.update(professionalProfiles).set({ spotWarnedAt: new Date() }).where(eq(professionalProfiles.userId, p.userId));
    await tell(p.userId, "account", "Go live to keep your spot", "Your profile isn't live yet. Finish what's left within 7 days so your city and category spot isn't released to another professional.", "/pro/home",
      { subject: "Go live within 7 days to keep your Nearest spot", heading: "Keep your spot — go live this week.", lines: ["Spots in each city are for professionals who are taking bookings. Your profile isn't live yet.", "Finish what's left on your home screen within 7 days, or your spot may be released to another professional. (Time Nearest spends reviewing your profile or ID never counts against you.)"], button: "Finish and go live" });
    warned++;
  }
  const toRelease = await db.select().from(professionalProfiles).where(and(notLiveOnTheirSide, isNotNull(professionalProfiles.spotWarnedAt),
    sql`${clock} < now() - interval '30 days'`, sql`${professionalProfiles.spotWarnedAt} < now() - interval '6 days'`)).limit(100);
  let released = 0;
  for (const p of toRelease) {
    if (await isOwnerBusiness(p.userId)) continue;
    await db.update(professionalProfiles).set({ placementReleasedAt: new Date() }).where(and(eq(professionalProfiles.userId, p.userId), isNull(professionalProfiles.placementReleasedAt)));
    await tell(p.userId, "account", "Your Nearest spot was released", "Your profile wasn't live within 30 days, so your spot opened for another professional. If your city still has room, you can reclaim it from your home screen.", "/pro/home",
      { subject: "Your Nearest spot was released", heading: "Your spot was released.", lines: ["Your profile wasn't live within 30 days of joining, so your city and category spot opened for another professional.", "Your account and profile are still here. If your city still has room, tap Reclaim my spot on your home screen."], button: "Open Nearest" });
    released++;
  }
  return { warned, released };
}

/** The categories a pro's spot covers in their city: their active services + the category they joined under. */
async function spotCategories(p: typeof professionalProfiles.$inferSelect) {
  const rows = await db.selectDistinct({ c: proServices.categoryId }).from(proServices).where(and(eq(proServices.userId, p.userId), eq(proServices.active, true)));
  return [...new Set([...rows.map((r) => r.c), ...(p.slotCategoryId ? [p.slotCategoryId] : [])])];
}

/** Can this released pro take a spot back right now? Returns the reason when not. */
export async function reclaimProblem(p: typeof professionalProfiles.$inferSelect): Promise<string | null> {
  if (!p.placementReleasedAt) return null;
  const cityId = p.cityId ?? p.slotCityId;
  if (!cityId) return "Add your location first.";
  const { categoryCap, slotCount } = await import("./slots");
  for (const c of await spotCategories(p)) if ((await slotCount(cityId, c, p.userId)) >= (await categoryCap(cityId, c))) return "Your city is full in one of your categories right now. Join the waitlist from the Join page and we'll tell you when a spot opens.";
  return null;
}

export async function reclaimSpot(userId: string): Promise<{ ok: string } | { error: string }> {
  const p = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, userId) });
  if (!p?.placementReleasedAt) return { ok: "Your spot is already yours." };
  const problem = await reclaimProblem(p);
  if (problem) return { error: problem };
  await db.update(professionalProfiles).set({ placementReleasedAt: null, spotWarnedAt: null, spotClockAt: new Date() }).where(eq(professionalProfiles.userId, userId));
  return { ok: "Your spot is back. Go live within 30 days to keep it." };
}
