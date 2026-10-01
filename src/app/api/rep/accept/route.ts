import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, salesReps, users } from "@/db";
import { getViewer, clerkContact } from "@/lib/viewer";
import { logActivity } from "@/lib/log";

// Links a sales rep's new (or existing) login to their invitation, then opens their dashboard.
// The login's verified email must be the exact email the invitation was sent to.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const to = (p: string) => NextResponse.redirect(new URL(p, req.url));
  const rep = /^[0-9a-f]{48}$/.test(token) ? await db.query.salesReps.findFirst({ where: eq(salesReps.token, token) }) : null;
  if (!rep) return to("/rep?e=invalid");
  const viewer = await getViewer();
  if (!viewer) return to(`/sign-in?redirect_url=${encodeURIComponent(`/api/rep/accept?token=${token}`)}`);
  const c = await clerkContact();
  if (!c?.email || !c.emailVerifiedAt || c.email !== rep.email) return to("/rep?e=email");
  if (rep.status === "removed") return to("/rep?e=removed");
  if (rep.status === "active") return to("/rep");
  if (rep.inviteExpiresAt.getTime() < Date.now()) return to("/rep?e=expired");

  let user = viewer.user;
  if (!user) {
    [user] = await db.insert(users).values({
      clerkUserId: viewer.clerkUserId, accountType: "staff",
      firstName: c.clerkUser.firstName, lastName: c.clerkUser.lastName,
      email: c.email, emailVerifiedAt: c.emailVerifiedAt, phone: c.phone, phoneVerifiedAt: c.phoneVerifiedAt,
    }).onConflictDoNothing().returning();
    user = user ?? (await db.query.users.findFirst({ where: eq(users.clerkUserId, viewer.clerkUserId) }))!;
  }
  await db.update(salesReps).set({ userId: user.id, status: "active", acceptedAt: new Date() }).where(and(eq(salesReps.id, rep.id), eq(salesReps.status, "invited")));
  await logActivity({ actorUserId: user.id, action: "rep.accepted", targetType: "sales_rep", targetId: rep.id });
  return to("/rep");
}
