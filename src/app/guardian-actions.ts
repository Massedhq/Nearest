"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, studentProfiles } from "@/db";
import { requireStudent } from "@/lib/student";
import { profileByGuardianToken, sendGuardianInvite, needsGuardian } from "@/lib/guardian";
import { logActivity } from "@/lib/log";

type FormState = { error?: string; ok?: string };

/** The parent approves from the email link: checkbox + typed full name. */
export async function approveGuardian(_: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("token") ?? "");
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  if (form.get("agree") !== "on") return { error: "Check the box to approve." };
  if (name.length < 4 || !name.includes(" ")) return { error: "Type your full name (first and last)." };
  const hit = await profileByGuardianToken(token);
  if (!hit) return { error: "This link isn't valid anymore." };
  if (hit.profile.guardianStatus === "approved") return { ok: "Already approved." };
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64) || null;
  await db.update(studentProfiles).set({ guardianStatus: "approved", guardianApprovedAt: new Date(), guardianName: name, guardianIp: ip }).where(eq(studentProfiles.userId, hit.user.id));
  await logActivity({ actorUserId: null, action: "guardian.approved", targetType: "student", targetId: hit.user.id, after: { name, email: hit.profile.guardianEmail, ip } });
  try { const { inbox } = await import("@/lib/inbox"); await inbox(hit.user.id, { kind: "guardian", title: "Your parent approved Nearest", body: "You're all set to use Nearest.", href: "/home" }); } catch (e) { console.error(e); }
  revalidatePath(`/guardian/${token}`);
  return { ok: "Approved." };
}

/** The parent declines (or says this wasn't them). The student can't book. */
export async function declineGuardian(form: FormData) {
  const token = String(form.get("token") ?? "");
  const hit = await profileByGuardianToken(token);
  if (hit && hit.profile.guardianStatus !== "approved") {
    await db.update(studentProfiles).set({ guardianStatus: "declined" }).where(eq(studentProfiles.userId, hit.user.id));
    await logActivity({ actorUserId: null, action: "guardian.declined", targetType: "student", targetId: hit.user.id, after: { email: hit.profile.guardianEmail } });
  }
  redirect(`/guardian/${token}`);
}

/** Student: send the approval email again (at most every 2 minutes). */
export async function resendGuardianEmail(): Promise<void> {
  const { user, profile } = await requireStudent();
  if (!needsGuardian(user) || profile.guardianStatus === "approved" || profile.guardianStatus === "declined") redirect("/verify/parent");
  if (profile.guardianEmailSentAt && Date.now() - profile.guardianEmailSentAt.getTime() < 120000) redirect("/verify/parent?wait=1");
  await sendGuardianInvite(user, profile, { force: true });
  redirect("/verify/parent?sent=1");
}

/** Student: fix a mistyped parent email (not after the parent has approved or declined). */
export async function changeGuardianEmail(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requireStudent();
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter your parent or guardian's email." };
  if (email === (user.email ?? "").toLowerCase()) return { error: "Use your parent or guardian's email, not your own." };
  if (profile.guardianStatus === "approved" || profile.guardianStatus === "declined") return { error: "This can't be changed now. Email support@usenearest.com." };
  const [p] = await db.update(studentProfiles).set({ guardianEmail: email, guardianToken: null, guardianEmailSentAt: null, guardianStatus: "pending" }).where(eq(studentProfiles.userId, user.id)).returning();
  await sendGuardianInvite(user, p, { force: true });
  revalidatePath("/verify/parent");
  return { ok: `Sent to ${email}.` };
}
