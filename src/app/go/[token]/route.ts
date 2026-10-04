import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, outreachLinks, prospects, adminMembers } from "@/db";
import { logProspect } from "@/lib/outreach";

/** Personal invite link from an outreach email: records the click, credits the recruiter, then opens professional sign-up. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = /^[A-Za-z0-9_-]{10,40}$/.test(token) ? await db.query.outreachLinks.findFirst({ where: eq(outreachLinks.token, token) }) : null;
  if (!link) return NextResponse.redirect(new URL("/pro", req.url));
  if (link.expiresAt.getTime() < Date.now()) return NextResponse.redirect(new URL("/invite-expired", req.url));
  const p = await db.query.prospects.findFirst({ where: eq(prospects.id, link.prospectId) });
  const code = p?.recruiterId ? (await db.query.adminMembers.findFirst({ where: eq(adminMembers.userId, p.recruiterId) }))?.partnerCode : null;
  if (!link.clickedAt) {
    await db.update(outreachLinks).set({ clickedAt: new Date() }).where(eq(outreachLinks.token, token));
    if (p) {
      await db.update(prospects).set({ linkClickedAt: new Date(), updatedAt: new Date(), ...(["link_sent", "contacted", "scheduled"].includes(p.status) ? { status: "link_clicked" } : {}) }).where(eq(prospects.id, p.id));
      await logProspect(p.id, "link_clicked", "Opened their invite link.", null);
    }
  }
  const res = NextResponse.redirect(new URL(code ? `/pro?ref=${code}` : "/pro", req.url));
  if (code) res.cookies.set("nearest_ref", code, { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax", secure: true, httpOnly: true });
  return res;
}
