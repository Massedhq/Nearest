import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, partnerAssistants, users, adminMembers } from "@/db";
import { getViewer, clerkContact } from "@/lib/viewer";
import { logActivity } from "@/lib/log";
import { assistantTokenShape } from "@/lib/assistants";
import { inbox } from "@/lib/inbox";

// Links a partner assistant's new (or existing staff) login to their invitation, then opens /pro/assistant.
// The login's verified email must be the exact email the partner invited.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const to = (p: string) => NextResponse.redirect(new URL(p, req.url));
  const a = assistantTokenShape(token) ? await db.query.partnerAssistants.findFirst({ where: eq(partnerAssistants.token, token) }) : null;
  if (!a) return to("/pro/assistant?e=invalid");
  const viewer = await getViewer();
  if (!viewer) return to(`/sign-in?redirect_url=${encodeURIComponent(`/api/assistant/accept?token=${token}`)}`);
  const contact = await clerkContact();
  if (!contact?.email || !contact.emailVerifiedAt || contact.email !== a.email) return to("/pro/assistant?e=email");
  if (a.status === "removed") return to("/pro/assistant?e=removed");
  if (a.status === "active") return to("/pro/assistant");
  if (a.inviteExpiresAt.getTime() < Date.now()) return to("/pro/assistant?e=expired");

  let user = viewer.user;
  // Assistants use a staff login of their own — never a student, professional or owner account.
  if (user && (user.accountType !== "staff" || (await db.query.adminMembers.findFirst({ where: eq(adminMembers.userId, user.id) })))) return to("/pro/assistant?e=account");
  if (!user) {
    [user] = await db.insert(users).values({
      clerkUserId: viewer.clerkUserId, accountType: "staff",
      firstName: contact.clerkUser.firstName, lastName: contact.clerkUser.lastName,
      email: contact.email, emailVerifiedAt: contact.emailVerifiedAt, phone: contact.phone, phoneVerifiedAt: contact.phoneVerifiedAt,
    }).onConflictDoNothing().returning();
    user = user ?? (await db.query.users.findFirst({ where: eq(users.clerkUserId, viewer.clerkUserId) }))!;
  }
  await db.update(partnerAssistants).set({ userId: user.id, status: "active", acceptedAt: new Date() }).where(and(eq(partnerAssistants.id, a.id), eq(partnerAssistants.status, "invited")));
  await logActivity({ actorUserId: user.id, action: "assistant.accepted", targetType: "partner", targetId: a.partnerId, after: { by: a.name } });
  await inbox(a.partnerId, { kind: "assistant", title: `${a.name} is now your assistant`, body: "They can manage your Model Calls, services, photos, partner page, appointments and messages.", href: "/pro/partner#assistants" });
  return to("/pro/assistant");
}
