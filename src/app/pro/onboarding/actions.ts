"use server";
import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, users, professionalProfiles, invitations } from "@/db";
import { getViewer, clerkContact } from "@/lib/viewer";
import { getSettings } from "@/lib/settings";
import { checkInvite, INVITE_MESSAGES } from "@/lib/invites";
import { validName, validDob } from "@/lib/validate";

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
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(professionalProfiles)
      .where(eq(professionalProfiles.cohort, "SECOND"));
    cohort = n < 750 ? "SECOND" : "STANDARD";
  }

  await db.insert(professionalProfiles).values({ userId: user.id, cohort, invitationId }).onConflictDoNothing();
  redirect("/go");
}
