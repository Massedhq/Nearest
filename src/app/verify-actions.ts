"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, studentProfiles, schools, schoolRequests, studentIdDocs } from "@/db";
import { requireStudent } from "@/lib/student";
import type { FormState } from "@/components/ActionForm";

const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);

export async function saveSchool(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requireStudent();
  if (profile.verificationStatus === "verified") redirect("/home");
  const schoolId = Number(form.get("schoolId"));
  const year = Number(form.get("graduationYear"));
  const school = schoolId ? await db.query.schools.findFirst({ where: and(eq(schools.id, schoolId), eq(schools.active, true)) }) : null;
  if (!school) return { error: "Choose your school, or tap “Can't find my school?”" };
  const now = new Date().getFullYear();
  if (!Number.isInteger(year) || year < now || year > now + 7) return { error: "Choose your expected graduation year." };
  await db.update(studentProfiles).set({ schoolId: school.id, graduationYear: year }).where(eq(studentProfiles.userId, user.id));
  redirect("/verify/id");
}

export async function requestSchool(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireStudent();
  const name = str(form, "name", 120);
  const cityName = str(form, "city", 60);
  const type = str(form, "type", 20) as "high_school" | "college" | "trade";
  const year = Number(form.get("graduationYear"));
  const now = new Date().getFullYear();
  if (!name || !cityName) return { error: "Enter your school's name and city." };
  if (!["high_school", "college", "trade"].includes(type)) return { error: "Choose the type of school." };
  if (!Number.isInteger(year) || year < now || year > now + 7) return { error: "Choose your expected graduation year." };
  await db.insert(schoolRequests).values({ userId: user.id, name, cityName, type });
  await db.update(studentProfiles).set({ graduationYear: year }).where(eq(studentProfiles.userId, user.id));
  redirect("/verify/id");
}

const DATA_URL = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/;

export async function submitIdDocs(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requireStudent();
  if (profile.verificationStatus === "verified") redirect("/home");
  const docs: { kind: string; b64: string }[] = [];
  for (const kind of ["school_id", "selfie"]) {
    const m = DATA_URL.exec(String(form.get(kind) ?? ""));
    if (!m) return { error: kind === "school_id" ? "Take a photo of your school ID." : "Take a selfie." };
    if (m[1].length > 1_400_000) return { error: "That photo is too large. Try again." };
    docs.push({ kind, b64: m[1] });
  }
  for (const d of docs) {
    await db
      .insert(studentIdDocs)
      .values({ userId: user.id, kind: d.kind, mime: "image/jpeg", dataB64: d.b64 })
      .onConflictDoUpdate({ target: [studentIdDocs.userId, studentIdDocs.kind], set: { dataB64: d.b64, createdAt: new Date() } });
  }
  await db
    .update(studentProfiles)
    .set({ verificationStatus: "pending", idSubmittedAt: new Date(), reviewNote: null })
    .where(eq(studentProfiles.userId, user.id));
  revalidatePath("/verify/status");
  redirect(profile.onboardingCompletedAt ? "/verify/status" : "/verify/interests");
}

export async function restartVerification() {
  const { user, profile } = await requireStudent();
  if (profile.verificationStatus !== "rejected") return;
  await db.update(studentProfiles).set({ verificationStatus: "unverified" }).where(eq(studentProfiles.userId, user.id));
  redirect("/verify/id");
}

export async function saveInterests(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireStudent();
  const picks = form.getAll("interest").map(String).filter(Boolean).slice(0, 20);
  await db.update(studentProfiles).set({ interests: picks }).where(eq(studentProfiles.userId, user.id));
  redirect("/verify/access");
}

export async function saveAccess(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requireStudent();
  await db
    .update(studentProfiles)
    .set({
      prefersText: form.get("prefersText") === "on",
      wantsAsl: form.get("wantsAsl") === "on",
      showAccessibility: form.get("showAccessibility") === "on",
      onboardingCompletedAt: profile.onboardingCompletedAt ?? new Date(),
    })
    .where(eq(studentProfiles.userId, user.id));
  redirect(profile.verificationStatus === "verified" ? "/home" : profile.verificationStatus === "unverified" && profile.selfieOnlyAt ? "/verify/finish" : "/verify/status");
}

export async function skipAccess() {
  const { user, profile } = await requireStudent();
  await db.update(studentProfiles).set({ onboardingCompletedAt: profile.onboardingCompletedAt ?? new Date() }).where(eq(studentProfiles.userId, user.id));
  redirect(profile.verificationStatus === "verified" ? "/home" : profile.verificationStatus === "unverified" && profile.selfieOnlyAt ? "/verify/finish" : "/verify/status");
}

/** "I don't have my school ID with me": save just the selfie and finish later. */
export async function submitSelfieOnly(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requireStudent();
  if (profile.verificationStatus === "verified") redirect("/home");
  const m = DATA_URL.exec(String(form.get("selfie") ?? ""));
  if (!m) return { error: "Take a selfie." };
  if (m[1].length > 1_400_000) return { error: "That photo is too large. Try again." };
  await db.insert(studentIdDocs).values({ userId: user.id, kind: "selfie", mime: "image/jpeg", dataB64: m[1] })
    .onConflictDoUpdate({ target: [studentIdDocs.userId, studentIdDocs.kind], set: { dataB64: m[1], createdAt: new Date() } });
  await db.update(studentProfiles).set({ selfieOnlyAt: new Date(), verificationStatus: "unverified", reviewNote: null }).where(eq(studentProfiles.userId, user.id));
  redirect("/verify/finish");
}

/** Send a 6-digit code to the student's school email (personal emails are refused). */
export async function sendSchoolCode(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requireStudent();
  if (profile.verificationStatus === "verified") redirect("/home");
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 120);
  const { schoolEmailProblem } = await import("@/lib/school-email");
  const problem = schoolEmailProblem(email);
  if (problem) return { error: problem };
  if (email === (user.email ?? "").toLowerCase() && !/\.(edu|net|org|us)$/.test(email)) return { error: "Use your school email." };
  if (profile.schoolEmailCodeExpires && profile.schoolEmail === email && profile.schoolEmailCodeExpires.getTime() - 14 * 60000 > Date.now()) return { error: "We just sent a code — wait a minute before asking for another." };
  const { randomInt, createHash } = await import("crypto");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.update(studentProfiles).set({
    schoolEmail: email, schoolEmailCodeHash: createHash("sha256").update(`${user.id}:${code}`).digest("hex"),
    schoolEmailCodeExpires: new Date(Date.now() + 15 * 60000), schoolEmailCodeTries: 0,
  }).where(eq(studentProfiles.userId, user.id));
  const { sendSchoolEmailCode } = await import("@/lib/email");
  const r = await sendSchoolEmailCode({ to: email, code });
  if (!r.sent) return { error: "We couldn't send the code right now. Try again in a minute." };
  revalidatePath("/verify/finish");
  return { ok: `Code sent to ${email}.` };
}

/** Check the code. Right code → temporary access now, and the student goes to the owner's review queue. */
export async function confirmSchoolCode(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requireStudent();
  if (profile.verificationStatus === "verified") redirect("/home");
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { error: "Enter the 6-digit code." };
  if (!profile.schoolEmailCodeHash || !profile.schoolEmailCodeExpires || profile.schoolEmailCodeExpires.getTime() < Date.now()) return { error: "That code expired. Send a new one." };
  if (profile.schoolEmailCodeTries >= 5) return { error: "Too many tries. Send a new code." };
  const { createHash } = await import("crypto");
  if (createHash("sha256").update(`${user.id}:${code}`).digest("hex") !== profile.schoolEmailCodeHash) {
    await db.update(studentProfiles).set({ schoolEmailCodeTries: profile.schoolEmailCodeTries + 1 }).where(eq(studentProfiles.userId, user.id));
    return { error: "That code isn't right. Check the email and try again." };
  }
  await db.update(studentProfiles).set({
    schoolEmailVerifiedAt: new Date(), schoolEmailCodeHash: null, schoolEmailCodeExpires: null, schoolEmailCodeTries: 0,
    verificationStatus: "pending", idSubmittedAt: profile.idSubmittedAt ?? null, reviewNote: null,
  }).where(eq(studentProfiles.userId, user.id));
  revalidatePath("/verify/status");
  redirect("/home");
}

/** "I'll finish verifying later": keep setting up the account; Nearest reminds them to come back. */
export async function finishVerifyLater() {
  const { user, profile } = await requireStudent();
  if (profile.verificationStatus === "verified") redirect("/home");
  await db.update(studentProfiles).set({ verifyLaterAt: profile.verifyLaterAt ?? new Date() }).where(eq(studentProfiles.userId, user.id));
  redirect(profile.onboardingCompletedAt ? "/verify/finish?later=1" : "/verify/interests");
}

/** Finishing with the school ID after the selfie was already saved: just the ID photo. */
export async function submitSchoolIdOnly(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requireStudent();
  if (profile.verificationStatus === "verified") redirect("/home");
  if (!profile.selfieOnlyAt) return { error: "Take your selfie first." };
  const m = DATA_URL.exec(String(form.get("school_id") ?? ""));
  if (!m) return { error: "Take or upload a photo of your school ID." };
  if (m[1].length > 1_400_000) return { error: "That photo is too large. Try again." };
  await db.insert(studentIdDocs).values({ userId: user.id, kind: "school_id", mime: "image/jpeg", dataB64: m[1] })
    .onConflictDoUpdate({ target: [studentIdDocs.userId, studentIdDocs.kind], set: { dataB64: m[1], createdAt: new Date() } });
  await db.update(studentProfiles).set({ verificationStatus: "pending", idSubmittedAt: new Date(), reviewNote: null }).where(eq(studentProfiles.userId, user.id));
  revalidatePath("/verify/status");
  redirect(profile.onboardingCompletedAt ? "/verify/status" : "/verify/interests");
}
