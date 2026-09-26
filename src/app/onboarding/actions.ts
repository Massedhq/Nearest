"use server";
import { redirect } from "next/navigation";
import { db, users, studentProfiles } from "@/db";
import { getViewer, clerkContact } from "@/lib/viewer";
import { getFlag } from "@/lib/settings";
import { validName, validDob, ageFrom } from "@/lib/validate";

export type FormState = { error?: string };

export async function completeStudent(_: FormState, form: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (viewer.user) redirect("/go");
  if (!(await getFlag("status.student_registration"))) return { error: "Registration is closed right now." };

  const firstName = String(form.get("firstName") ?? "").trim();
  const lastName = String(form.get("lastName") ?? "").trim();
  const dob = String(form.get("dob") ?? "");
  if (!validName(firstName) || !validName(lastName)) return { error: "Enter your first and last name." };
  if (!validDob(dob)) return { error: "Enter a real date of birth." };
  if (ageFrom(dob) < 13) return { error: "You must be at least 13 to use Nearest." };
  if (ageFrom(dob) < 18) return { error: "Students under 18 need a parent or guardian's permission. Please sign out and create your account from the Create account screen, where your parent or guardian can agree." };

  const c = await clerkContact();
  if (!c?.email || !c.emailVerifiedAt) return { error: "Your email needs to be verified. Enter the code we emailed you." };

  const [user] = await db
    .insert(users)
    .values({
      clerkUserId: viewer.clerkUserId,
      accountType: "student",
      firstName,
      lastName,
      dateOfBirth: dob,
      phone: c.phone,
      phoneVerifiedAt: c.phoneVerifiedAt,
      email: c.email,
      emailVerifiedAt: c.emailVerifiedAt,
    })
    .onConflictDoNothing()
    .returning();
  if (user) await db.insert(studentProfiles).values({ userId: user.id }).onConflictDoNothing();
  redirect("/verify");
}

/** Called right after the email code: builds the student account from what they typed on the sign-up screen. */
export async function createStudentFromSignUp(): Promise<boolean> {
  const viewer = await getViewer();
  if (!viewer || viewer.user) return false;
  if (!(await getFlag("status.student_registration"))) return false;
  const c = await clerkContact();
  const firstName = c?.clerkUser.firstName?.trim() ?? "";
  const lastName = c?.clerkUser.lastName?.trim() ?? "";
  if (!c?.email || !c.emailVerifiedAt || !c.dob || !validDob(c.dob) || !validName(firstName) || !validName(lastName)) return false;
  const years = ageFrom(c.dob);
  if (years < 13 || (years < 18 && (!c.guardianConsent || !c.guardianEmail))) return false;
  const [user] = await db
    .insert(users)
    .values({
      clerkUserId: viewer.clerkUserId, accountType: "student", firstName, lastName, dateOfBirth: c.dob,
      phone: c.phone ?? c.typedPhone, phoneVerifiedAt: c.phoneVerifiedAt, email: c.email, emailVerifiedAt: c.emailVerifiedAt,
    })
    .onConflictDoNothing()
    .returning();
  if (user) await db.insert(studentProfiles).values({ userId: user.id, ...(years < 18 ? { guardianEmail: c.guardianEmail, guardianConsentAt: new Date() } : {}) }).onConflictDoNothing();
  return true;
}
