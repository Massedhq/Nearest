import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, teamAssistants, users, adminMembers } from "@/db";
import { getViewer, clerkContact } from "@/lib/viewer";
import { logActivity } from "@/lib/log";
import { teamTokenShape } from "@/lib/team";
import { notifyAdmins } from "@/lib/outreach";

// Links an owner's assistant's new (or existing staff) login to their invitation, then opens /outreach.
// The login's verified email must be the exact email the owner invited.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const to = (p: string) => NextResponse.redirect(new URL(p, req.url));
  const a = teamTokenShape(token) ? await db.query.teamAssistants.findFirst({ where: eq(teamAssistants.token, token) }) : null;
  if (!a) return to("/outreach?e=invalid");
  const viewer = await getViewer();
  if (!viewer) return to(`/sign-in?redirect_url=${encodeURIComponent(`/api/team/accept?token=${token}`)}`);
  const contact = await clerkContact();
  if (!contact?.email || !contact.emailVerifiedAt || contact.email !== a.email) return to("/outreach?e=email");
  if (a.status === "removed") return to("/outreach?e=removed");
  if (a.status === "active") return to("/outreach");
  if (a.inviteExpiresAt.getTime() < Date.now()) return to("/outreach?e=expired");

  let user = viewer.user;
  // Their own staff login — never a student, professional or owner account.
  if (user && (user.accountType !== "staff" || (await db.query.adminMembers.findFirst({ where: eq(adminMembers.userId, user.id) })))) return to("/outreach?e=account");
  if (!user) {
    [user] = await db.insert(users).values({
      clerkUserId: viewer.clerkUserId, accountType: "staff",
      firstName: contact.clerkUser.firstName, lastName: contact.clerkUser.lastName,
      email: contact.email, emailVerifiedAt: contact.emailVerifiedAt, phone: contact.phone, phoneVerifiedAt: contact.phoneVerifiedAt,
    }).onConflictDoNothing().returning();
    user = user ?? (await db.query.users.findFirst({ where: eq(users.clerkUserId, viewer.clerkUserId) }))!;
  }
  await db.update(teamAssistants).set({ userId: user.id, status: "active", acceptedAt: new Date() }).where(and(eq(teamAssistants.id, a.id), eq(teamAssistants.status, "invited")));
  await logActivity({ actorUserId: user.id, action: "team.assistant_accepted", targetType: "team_assistant", targetId: a.id, after: { name: a.name } });
  await notifyAdmins({ kind: "field", title: `${a.name} joined your field team`, body: "They can now work your outreach and area.", href: "/admin/field/team" }, [a.ownerId]);
  return to("/outreach");
}
