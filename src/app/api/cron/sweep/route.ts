import { sweep } from "@/lib/enforcement";

// Vercel Cron calls this every hour with "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const result = await sweep();
  return Response.json(result);
}
