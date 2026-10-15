import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, leadContributors, users, adminMembers } from "@/db";
import { getViewer, clerkContact } from "@/lib/viewer";
import { logActivity } from "@/lib/log";
import { contributorTokenShape } from "@/lib/lead-contributors";

// Links a Lead Contributor's new (or existing staff) login to their invitation, then opens their workspace.
// The login's verified email must be the exact email the invitation was made for.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const to = (p: string) => NextResponse.redirect(new URL(p, req.url));
  const c = contributorTokenShape(token) ? await db.query.leadContributors.findFirst({ where: eq(leadContributors.token, token) }) : null;
  if (!c) return to("/leads?e=invalid");
  const viewer = await getViewer();
  if (!viewer) return to(`/sign-in?redirect_url=${encodeURIComponent(`/api/leads/accept?token=${token}`)}`);
  const contact = await clerkContact();
  if (!contact?.email || !contact.emailVerifiedAt || contact.email !== c.email) return to("/leads?e=email");
  if (c.status === "removed") return to("/leads?e=removed");
  if (c.status === "active") return to("/leads");
  if (c.inviteExpiresAt.getTime() < Date.now()) return to("/leads?e=expired");

  let user = viewer.user;
  if (user && (user.accountType !== "staff" || (await db.query.adminMembers.findFirst({ where: eq(adminMembers.userId, user.id) })))) return to("/leads?e=account");
  if (!user) {
    [user] = await db.insert(users).values({
      clerkUserId: viewer.clerkUserId, accountType: "staff",
      firstName: contact.clerkUser.firstName, lastName: contact.clerkUser.lastName,
      email: contact.email, emailVerifiedAt: contact.emailVerifiedAt, phone: contact.phone, phoneVerifiedAt: contact.phoneVerifiedAt,
    }).onConflictDoNothing().returning();
    user = user ?? (await db.query.users.findFirst({ where: eq(users.clerkUserId, viewer.clerkUserId) }))!;
  }
  await db.update(leadContributors).set({ userId: user.id, status: "active", acceptedAt: new Date() }).where(and(eq(leadContributors.id, c.id), eq(leadContributors.status, "invited")));
  await logActivity({ actorUserId: user.id, action: "lead_contributor.accepted", targetType: "lead_contributor", targetId: c.id });
  return to("/leads");
}
