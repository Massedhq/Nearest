import { NextResponse } from "next/server";
import { SPIN_COOKIE } from "@/lib/reward-wheel";

/** The link in the "reward on hold" email: remembers the held reward on this device, then back to /vote to finish. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = NextResponse.redirect(new URL("/vote/reward", req.url));
  if (/^[a-f0-9]{48}$/.test(token)) res.cookies.set(SPIN_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 7 });
  return res;
}
