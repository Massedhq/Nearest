import "server-only";
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db, salesReps, repLinkClicks } from "@/db";
import { REP_COOKIE } from "./reps";

/** An ambassador link was tapped: count it, remember the ambassador for 30 days, then open the right page. */
export async function repClick(req: Request, code: string, kind: "pro" | "student") {
  const dest = new URL(kind === "pro" ? "/pro" : "/", req.url);
  const c = code.toUpperCase();
  if (!/^[A-Z0-9]{3,12}$/.test(c)) return NextResponse.redirect(dest);
  const rep = await db.query.salesReps.findFirst({ where: and(eq(salesReps.code, c), eq(salesReps.status, "active")) });
  if (rep) {
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
    await db.insert(repLinkClicks).values({ repId: rep.id, kind, day, clicks: 1 })
      .onConflictDoUpdate({ target: [repLinkClicks.repId, repLinkClicks.kind, repLinkClicks.day], set: { clicks: sql`${repLinkClicks.clicks} + 1` } });
  }
  const res = NextResponse.redirect(dest);
  if (rep) res.cookies.set(REP_COOKIE, c, { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax", secure: true, httpOnly: true });
  return res;
}
