"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, studentProfiles, studentIdDocs, schools, schoolRequests, users, professionalProfiles } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { nextAug31 } from "@/lib/student";
import type { FormState } from "@/components/ActionForm";
import { placeFromForm } from "@/app/admin/place-actions";
import { inbox } from "@/lib/inbox";

const str = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);

async function studentName(id: string) {
  const u = await db.query.users.findFirst({ where: eq(users.id, id) });
  return u ? `${u.firstName} ${u.lastName}` : id;
}

export async function approveStudent(form: FormData) {
  const { user } = await requireAdmin();
  const id = str(form, "userId", 40);
  const sp = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, id) });
  if (!sp || sp.verificationStatus !== "pending") return;
  if (!sp.schoolId) return; // add their requested school first
  await db
    .update(studentProfiles)
    .set({ verificationStatus: "verified", verifiedAt: new Date(), reverifyBy: nextAug31(), reviewNote: null })
    .where(eq(studentProfiles.userId, id));
  await db.delete(studentIdDocs).where(eq(studentIdDocs.userId, id));
  await inbox(id, { kind: "verified", title: "You're a Verified Student", body: "Find who's available near you.", href: "/home" });
  // Joined through a friend's invite link? Now that they're verified, both students get $5.
  try { await (await import("@/lib/student-invites")).grantInviteRewards(id); } catch (e) { console.error("invite rewards", e); }
  await logActivity({ actorUserId: user.id, action: "student.verified", targetType: "student", targetId: await studentName(id), before: "pending", after: "verified" });
  revalidatePath("/admin", "layout");
}

export async function rejectStudent(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const id = str(form, "userId", 40);
  const note = str(form, "note");
  if (!note) return { error: "Tell the student what to fix." };
  await db.update(studentProfiles).set({ verificationStatus: "rejected", reviewNote: note, schoolEmailVerifiedAt: null }).where(and(eq(studentProfiles.userId, id), eq(studentProfiles.verificationStatus, "pending")));
  await db.delete(studentIdDocs).where(eq(studentIdDocs.userId, id));
  await inbox(id, { kind: "verification", title: "We couldn't verify you yet", body: note, href: "/verify/status" });
  await logActivity({ actorUserId: user.id, action: "student.rejected", targetType: "student", targetId: await studentName(id), before: "pending", after: note });
  revalidatePath("/admin", "layout");
  return { ok: "Sent back. Their photos were deleted." };
}

export async function addSchool(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const name = str(form, "name", 120);
  const type = str(form, "type", 20) as "high_school" | "college" | "trade";
  const requestId = str(form, "requestId", 40);
  if (!name || !["high_school", "college", "trade"].includes(type)) return { error: "Enter the school name and type." };
  const place = await placeFromForm(form);
  if ("error" in place) return place;
  const cityId = place.cityId;
  let [school] = await db.insert(schools).values({ name, cityId, type }).onConflictDoNothing().returning();
  school ??= (await db.query.schools.findFirst({ where: and(eq(schools.name, name), eq(schools.cityId, cityId)) }))!;
  await logActivity({ actorUserId: user.id, action: "school.added", targetType: "school", targetId: name });
  if (requestId) {
    const [req] = await db.update(schoolRequests).set({ status: "added" }).where(eq(schoolRequests.id, requestId)).returning();
    if (req) await db.update(studentProfiles).set({ schoolId: school.id }).where(and(eq(studentProfiles.userId, req.userId)));
  }
  revalidatePath("/admin", "layout");
  return { ok: `${name} added in ${place.label}.` };
}

export async function toggleSchool(form: FormData) {
  const { user } = await requireAdmin();
  const id = Number(form.get("id"));
  const s = await db.query.schools.findFirst({ where: eq(schools.id, id) });
  if (!s) return;
  await db.update(schools).set({ active: !s.active }).where(eq(schools.id, id));
  await logActivity({ actorUserId: user.id, action: "school.active", targetType: "school", targetId: s.name, before: s.active, after: !s.active });
  revalidatePath("/admin/schools");
}

export async function dismissRequest(form: FormData) {
  const { user } = await requireAdmin();
  const [req] = await db.update(schoolRequests).set({ status: "dismissed" }).where(eq(schoolRequests.id, str(form, "id", 40))).returning();
  if (req) await logActivity({ actorUserId: user.id, action: "school_request.dismissed", targetType: "school_request", targetId: req.name });
  revalidatePath("/admin/schools");
}

// ---------- Professional ID checks (Nearest's own — driver's license/state ID + live selfie) ----------
export async function approveProId(form: FormData) {
  const { user } = await requireAdmin();
  const id = str(form, "userId", 40);
  const [row] = await db.update(professionalProfiles).set({ identityStatus: "verified" })
    .where(and(eq(professionalProfiles.userId, id), eq(professionalProfiles.identityStatus, "pending"))).returning();
  if (!row) return;
  await db.delete(studentIdDocs).where(eq(studentIdDocs.userId, id));
  await inbox(id, { kind: "verification", title: "Your ID is verified", body: "Finish any remaining steps and you'll be live for students.", href: "/pro/payments" });
  const u = await db.query.users.findFirst({ where: eq(users.id, id) });
  await logActivity({ actorUserId: user.id, action: "pro.id_verified", targetType: "professional", targetId: u ? `${u.firstName} ${u.lastName}` : id, before: "pending", after: "verified" });
  revalidatePath("/admin", "layout");
}

export async function rejectProId(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const id = str(form, "userId", 40);
  const note = str(form, "note");
  if (!note) return { error: "Tell the professional what to fix." };
  await db.update(professionalProfiles).set({ identityStatus: "rejected" }).where(and(eq(professionalProfiles.userId, id), eq(professionalProfiles.identityStatus, "pending")));
  await db.delete(studentIdDocs).where(eq(studentIdDocs.userId, id));
  await inbox(id, { kind: "verification", title: "Please retake your ID photos", body: note, href: "/pro/payments" });
  const u = await db.query.users.findFirst({ where: eq(users.id, id) });
  await logActivity({ actorUserId: user.id, action: "pro.id_rejected", targetType: "professional", targetId: u ? `${u.firstName} ${u.lastName}` : id, before: "pending", after: note });
  revalidatePath("/admin", "layout");
  return { ok: "Sent back. Their photos were deleted." };
}
