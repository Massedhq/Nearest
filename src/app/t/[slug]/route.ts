import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { tapBySlug, TAP_COOKIE, TAP_COOKIE_HOURS } from "@/lib/tap-links";

/**
 * usenearest.com/t/<slug> — an owner's GRANTED tap link (NFC tap card or QR). Counts the open, remembers the tap for
 * a couple of hours and opens the normal vote. A paused or unknown link just opens the vote without a reward.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await tapBySlug(slug);
  const res = NextResponse.redirect(new URL(t?.active ? "/card?tap=1" : "/card", req.url));
  if (t?.active) {
    await db.execute(sql`update tap_links set opens = opens + 1 where user_id = ${t.userId}`);
    res.cookies.set(TAP_COOKIE, t.slug, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: TAP_COOKIE_HOURS * 3600 });
  } else {
    res.cookies.delete(TAP_COOKIE);
  }
  return res;
}
