import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublic = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pro",
  "/pro/sign-in(.*)",
  "/pro/sign-up(.*)",
  "/pro/invite/(.*)",
  "/pro/manifest.webmanifest",
  "/admin/sign-in(.*)",
  "/admin/sign-up(.*)",
  "/manifest.webmanifest",
  "/sw.js",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) return;
  const { userId } = await auth();
  if (userId) return;
  const path = req.nextUrl.pathname;
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
