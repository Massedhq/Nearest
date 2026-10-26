import { sweep, sendReminders, stepUpPrices } from "@/lib/enforcement";
import { releaseExpiredHolds } from "@/lib/entry";

// Vercel Cron calls this every 15 minutes with "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  // Booking requests first, so students and pros are told (the general sweep below would expire them silently).
  const requestsExpired = await (await import("@/lib/requests")).expireRequests(); // unanswered requests + accepted-but-unpaid
  const requestReminders = await (await import("@/lib/requests")).remindPendingRequests(); // one "still waiting" reminder to the pro
  const spotsReleased = await (await import("@/lib/requests")).releaseUnactivated(); // (membership on only) no activation 7 days after a first request
  const membershipsEnded = await (await import("@/lib/no-membership")).endOldMemberships(); // no monthly membership: cancel old ones, no further charge
  const inactiveSpots = await (await import("@/lib/no-membership")).releaseInactiveSpots(); // not live 30 days after joining → warn at 23, release at 30
  const [result, reminders, steppedUp, seatsReleased] = [await sweep(), await sendReminders(), await stepUpPrices(), await releaseExpiredHolds()];
  const bundlesExpired = await (await import("@/lib/bundles")).expireBundles(); // unbooked bundles clear after 14 days
  const verifyReminders = await (await import("@/lib/verify-reminders")).remindUnfinishedVerification(); // 1, 3, 7 days
  const setupReminders = await (await import("@/lib/setup-reminders")).remindUnfinishedSetup(); // pros: 1, 3, 7 days
  const outreach = await (await import("@/lib/outreach-mail")).runOutreach(); // Professional Outreach emails + follow-ups
  const broadcastSent = await (await import("@/lib/broadcasts")).sendBroadcasts(); // Broadcasts, in batches
  const campaign = await (await import("@/lib/campaign-cron")).runCampaign(); // launch campaign clock, reminders, rewards
  const enrollmentHolds = await (await import("@/lib/enrollment-holds")).runEnrollmentHolds().catch((e) => { console.error("holds", e); return null; }); // unfinished 30 days → on hold
  const lookIndex = await (await import("@/lib/look-match")).indexPendingLooks(30_000).catch((e) => { console.error("look index", e); return null; }); // Find by photo: fingerprint new portfolio photos
  return Response.json({ ...result, enrollmentHolds, lookIndex, reminders, steppedUp, seatsReleased, bundlesExpired, verifyReminders, setupReminders, outreach, broadcastSent, requestsExpired, requestReminders, spotsReleased, membershipsEnded, inactiveSpots, campaign });
}
