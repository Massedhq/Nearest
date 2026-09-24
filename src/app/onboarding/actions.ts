"use server";
import { redirect } from "next/navigation";
import { db, users, studentProfiles } from "@/db";
import { getViewer, clerkContact } from "@/lib/viewer";
import { getFlag } from "@/lib/settings";
import { validName, validDob } from "@/lib/validate";

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
  redirect("/home");
}
