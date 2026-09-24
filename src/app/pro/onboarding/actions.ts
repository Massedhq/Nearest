"use server";
import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, users, professionalProfiles, invitations } from "@/db";
import { getViewer, clerkContact } from "@/lib/viewer";
import { getSettings } from "@/lib/settings";
import { checkInvite, INVITE_MESSAGES } from "@/lib/invites";
import { validName, validDob } from "@/lib/validate";
import { partnerByCode } from "@/lib/partner";
import { adminMembers } from "@/db";

export type FormState = { error?: string };

export async function completePro(_: FormState, form: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/pro/sign-in");
  if (viewer.user && viewer.user.accountType !== "staff") redirect("/go");

  const firstName = String(form.get("firstName") ?? "").trim();
  const lastName = String(form.get("lastName") ?? "").trim();
  const dob = String(form.get("dob") ?? "");
  const code = String(form.get("invite") ?? "").trim() || null;
  if (!validName(firstName) || !validName(lastName)) return { error: "Enter your legal first and last name." };
  if (!validDob(dob)) return { error: "Enter a real date of birth." };

  const c = await clerkContact();
  if (!c?.email || !c.emailVerifiedAt) return { error: "Your email needs to be verified. Enter the code we emailed you." };

  const settings = await getSettings();
  const check = code ? await checkInvite(code) : null;
  if (code && !check?.ok) return { error: INVITE_MESSAGES[check && !check.ok ? check.reason : "not_found"] };
  if (!code && settings["status.pro_registration"] !== true) return { error: "Registration is closed." };

  // Create (or upgrade an owner's staff row into) the professional user.
  const values = {
    accountType: "professional" as const,
    firstName,
    lastName,
    dateOfBirth: dob,
    phone: c.phone,
    phoneVerifiedAt: c.phoneVerifiedAt,
    email: c.email,
    emailVerifiedAt: c.emailVerifiedAt,
    updatedAt: new Date(),
  };
  const [user] = viewer.user
    ? await db.update(users).set(values).where(eq(users.id, viewer.user.id)).returning()
    : await db.insert(users).values({ clerkUserId: viewer.clerkUserId, ...values }).returning();

  let cohort: "FOUNDING" | "SECOND" | "STANDARD";
  let invitationId: string | null = null;
  if (code) {
    // Claim atomically so one code can never register two people.
    const [claimed] = await db
      .update(invitations)
      .set({ status: "registered", registeredUserId: user.id })
      .where(and(eq(invitations.code, code.toUpperCase()), eq(invitations.status, "invited"), gt(invitations.expiresAt, new Date())))
      .returning();
    if (!claimed) return { error: "This invitation was just used or expired." };
    cohort = "FOUNDING";
    invitationId = claimed.id;
  } else {
    // $20 pricing runs through pro #growth.second_cohort_end (3,500 by default), then standard pricing.
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(professionalProfiles);
    cohort = n < Number(settings["growth.second_cohort_end"]) ? "SECOND" : "STANDARD";
  }

  // Partner attribution: whoever created the invitation, otherwise the ?ref= code used at sign-up.
  let referredBy: string | null = null;
  if (invitationId) {
    const inv = await db.query.invitations.findFirst({ where: eq(invitations.id, invitationId) });
    const isPartner = inv ? await db.query.adminMembers.findFirst({ where: and(eq(adminMembers.userId, inv.createdBy), eq(adminMembers.role, "OWNER")) }) : null;
    referredBy = isPartner ? inv!.createdBy : null;
  }
  referredBy ??= await partnerByCode(c.ref);
  await db.insert(professionalProfiles).values({ userId: user.id, cohort, invitationId, referredBy }).onConflictDoNothing();
  redirect("/go");
}
