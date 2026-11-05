import { sweep, sendReminders, stepUpPrices } from "@/lib/enforcement";
import { releaseExpiredHolds } from "@/lib/entry";

// One job failing must never stop the jobs after it (outreach used to stop silently when an earlier step threw).
async function safe<T>(name: string, job: () => Promise<T>): Promise<T | { error: string }> {
  try { return await job(); } catch (e) { console.error(`cron ${name}`, e); return { error: (e as Error).message }; }
}

// Vercel Cron calls this every 15 minutes with "Authorization: Bearer $CRON_SECRET".
export const maxDuration = 300;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  // Booking requests first, so students and pros are told (the general sweep below would expire them silently).
  const outreach = await safe("outreach", async () => (await import("@/lib/outreach-mail")).runOutreach()); // runs early so slow jobs below can never starve it. Professional Outreach emails + follow-ups
  const requestsExpired = await safe("requestsExpired", async () => (await import("@/lib/requests")).expireRequests()); // unanswered requests + accepted-but-unpaid
  const requestReminders = await safe("requestReminders", async () => (await import("@/lib/requests")).remindPendingRequests()); // one "still waiting" reminder to the pro
  const spotsReleased = await safe("spotsReleased", async () => (await import("@/lib/requests")).releaseUnactivated()); // (membership on only) no activation 7 days after a first request
  const membershipsEnded = await safe("membershipsEnded", async () => (await import("@/lib/no-membership")).endOldMemberships()); // no monthly membership: cancel old ones, no further charge
  const inactiveSpots = await safe("inactiveSpots", async () => (await import("@/lib/no-membership")).releaseInactiveSpots()); // not live 30 days after joining → warn at 23, release at 30
  const result = await safe("sweep", sweep);
  const reminders = await safe("reminders", sendReminders);
  const steppedUp = await safe("steppedUp", stepUpPrices);
  const seatsReleased = await safe("seatsReleased", releaseExpiredHolds);
  const bundlesExpired = await safe("bundlesExpired", async () => (await import("@/lib/bundles")).expireBundles()); // unbooked bundles clear after 14 days
  const verifyReminders = await safe("verifyReminders", async () => (await import("@/lib/verify-reminders")).remindUnfinishedVerification()); // 1, 3, 7 days
  const setupReminders = await safe("setupReminders", async () => (await import("@/lib/setup-reminders")).remindUnfinishedSetup()); // pros: 1, 3, 7 days
  const broadcastSent = await safe("broadcastSent", async () => (await import("@/lib/broadcasts")).sendBroadcasts()); // Broadcasts, in batches
  const campaign = await safe("campaign", async () => (await import("@/lib/campaign-cron")).runCampaign()); // launch campaign clock, reminders, rewards
  const enrollmentHolds = await safe("enrollmentHolds", async () => (await import("@/lib/enrollment-holds")).runEnrollmentHolds()); // unfinished 30 days → on hold
  const lookIndex = await safe("lookIndex", async () => (await import("@/lib/look-match")).indexPendingLooks(30_000)); // Find by photo: fingerprint new portfolio photos
  const coverageNotices = await safe("coverageNotices", async () => (await import("@/lib/demand")).notifyNewCoverage()); // first pro for a service in a city → tell the students who picked it
  const indexNow = await safe("indexNow", async () => (await import("@/lib/indexnow")).pingSitemap()); // Bing & co.: public pages, once a day
  return Response.json({ result, coverageNotices, enrollmentHolds, lookIndex, indexNow, reminders, steppedUp, seatsReleased, bundlesExpired, verifyReminders, setupReminders, outreach, broadcastSent, requestsExpired, requestReminders, spotsReleased, membershipsEnded, inactiveSpots, campaign });
}
