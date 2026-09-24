import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Pages anyone can open. Everything else needs a signed-in user; role checks
// happen again in each layout, page and server action (never only here).
const PUBLIC_EXACT = new Set(["/", "/pro", "/manifest.webmanifest", "/pro/manifest.webmanifest", "/sw.js", "/api/stripe/webhook"]);
const PUBLIC_PREFIX = ["/sign-in", "/sign-up", "/pro/sign-in", "/pro/sign-up", "/pro/invite/", "/admin/sign-in", "/admin/sign-up"];

function isPublic(path: string) {
  return PUBLIC_EXACT.has(path) || PUBLIC_PREFIX.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`));
}

export default clerkMiddleware(async (auth, req) => {
  const path = req.nextUrl.pathname;
  if (isPublic(path)) return;
  const { userId } = await auth();
  if (userId) return;
  if (path.startsWith("/api/")) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const signIn = path.startsWith("/admin") ? "/admin/sign-in" : path.startsWith("/pro") ? "/pro/sign-in" : "/sign-in";
  const url = new URL(signIn, req.url);
  url.searchParams.set("redirect_url", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
});

export const config = {
  matcher: [
    "/((?!_next|icons|brand|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
