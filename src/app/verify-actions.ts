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
  redirect(profile.verificationStatus === "verified" ? "/home" : "/verify/status");
}

export async function skipAccess() {
  const { user, profile } = await requireStudent();
  await db.update(studentProfiles).set({ onboardingCompletedAt: profile.onboardingCompletedAt ?? new Date() }).where(eq(studentProfiles.userId, user.id));
  redirect(profile.verificationStatus === "verified" ? "/home" : "/verify/status");
}
