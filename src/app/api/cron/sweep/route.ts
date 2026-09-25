import { sweep, sendReminders, stepUpPrices } from "@/lib/enforcement";

// Vercel Cron calls this every 15 minutes with "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const [result, reminders, steppedUp] = [await sweep(), await sendReminders(), await stepUpPrices()];
  return Response.json({ ...result, reminders, steppedUp });
}
