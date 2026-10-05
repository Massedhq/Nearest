import { sweep, sendReminders, stepUpPrices } from "@/lib/enforcement";
import { releaseExpiredHolds } from "@/lib/entry";

// Vercel Cron calls this every 15 minutes with "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  // Booking requests first, so students and pros are told (the general sweep below would expire them silently).
  const requestsExpired = await (await import("@/lib/requests")).expireRequests(); // unanswered requests + accepted-but-unpaid
  const spotsReleased = await (await import("@/lib/requests")).releaseUnactivated(); // no activation 7 days after a first request
  const [result, reminders, steppedUp, seatsReleased] = [await sweep(), await sendReminders(), await stepUpPrices(), await releaseExpiredHolds()];
  const bundlesExpired = await (await import("@/lib/bundles")).expireBundles(); // unbooked bundles clear after 14 days
  const verifyReminders = await (await import("@/lib/verify-reminders")).remindUnfinishedVerification(); // 1, 3, 7 days
  const setupReminders = await (await import("@/lib/setup-reminders")).remindUnfinishedSetup(); // pros: 1, 3, 7 days
  const outreach = await (await import("@/lib/outreach-mail")).runOutreach(); // Professional Outreach emails + follow-ups
  const broadcastSent = await (await import("@/lib/broadcasts")).sendBroadcasts(); // Broadcasts, in batches
  return Response.json({ ...result, reminders, steppedUp, seatsReleased, bundlesExpired, verifyReminders, setupReminders, outreach, broadcastSent, requestsExpired, spotsReleased });
}
