import { sweep, sendReminders, stepUpPrices } from "@/lib/enforcement";
import { releaseExpiredHolds } from "@/lib/entry";

// Vercel Cron calls this every 15 minutes with "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const [result, reminders, steppedUp, seatsReleased] = [await sweep(), await sendReminders(), await stepUpPrices(), await releaseExpiredHolds()];
  const bundlesExpired = await (await import("@/lib/bundles")).expireBundles(); // unbooked bundles clear after 14 days
  const verifyReminders = await (await import("@/lib/verify-reminders")).remindUnfinishedVerification(); // 1, 3, 7 days
  return Response.json({ ...result, reminders, steppedUp, seatsReleased, bundlesExpired, verifyReminders });
}
