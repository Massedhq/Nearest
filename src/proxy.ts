import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Pages anyone can open. Everything else needs a signed-in user; role checks
// happen again in each layout, page and server action (never only here).
const PUBLIC_EXACT = new Set(["/", "/pro", "/manifest.webmanifest", "/pro/manifest.webmanifest", "/sw.js", "/api/stripe/webhook", "/api/cron/sweep", "/terms", "/privacy", "/api/rep/accept"]); // rep accept checks sign-in itself and sends signed-out people to sign in
const PUBLIC_PREFIX = ["/sign-in", "/sign-up", "/pro/sign-in", "/pro/sign-up", "/pro/invite/", "/admin/sign-in", "/admin/sign-up", "/rep/join/", "/rep/agreement", "/guardian/", "/go/", "/unsubscribe/", "/invite-expired", "/api/inbound/", "/api/time", "/r/"];

function isPublic(path: string) {
  if (/^\/pro-[a-z0-9-]{2,40}$/i.test(path)) return true; // shareable pro links: usenearest.com/pro-<name>
  return PUBLIC_EXACT.has(path) || PUBLIC_PREFIX.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`));
}

/** Partner links (?ref=AVY): remember the code for 30 days so the partner gets credit even if they sign up later. */
function withRef(req: Request & { nextUrl: URL }, res: NextResponse) {
  const ref = req.nextUrl.searchParams.get("ref");
  if (ref && /^[A-Za-z0-9]{3,12}$/.test(ref)) res.cookies.set("nearest_ref", ref.toUpperCase(), { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax", secure: true, httpOnly: true });
  // Sales rep links (?rep=RXXXXXX): same 30-day memory, kept separate from partner links.
  const rep = req.nextUrl.searchParams.get("rep");
  if (rep && /^[A-Za-z0-9]{3,12}$/.test(rep)) res.cookies.set("nearest_rep", rep.toUpperCase(), { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax", secure: true, httpOnly: true });
  // Student "Invite friends" links (?friend=FXXXXXX): both students get $5 once the friend is verified.
  const friend = req.nextUrl.searchParams.get("friend");
  if (friend && /^[A-Za-z0-9]{3,12}$/.test(friend)) res.cookies.set("nearest_friend", friend.toUpperCase(), { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax", secure: true, httpOnly: true });
  return res;
}

export default clerkMiddleware(async (auth, req) => {
  const path = req.nextUrl.pathname;
  if (isPublic(path)) return withRef(req, NextResponse.next());
  const { userId } = await auth();
  if (userId) return withRef(req, NextResponse.next());
  if (path.startsWith("/api/")) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const signIn = path.startsWith("/admin") ? "/admin/sign-in" : path.startsWith("/pro") ? "/pro/sign-in" : "/sign-in";
  const url = new URL(signIn, req.url);
  url.searchParams.set("redirect_url", req.nextUrl.pathname + req.nextUrl.search);
  return withRef(req, NextResponse.redirect(url));
});

export const config = {
  matcher: [
    "/((?!_next|icons|brand|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
