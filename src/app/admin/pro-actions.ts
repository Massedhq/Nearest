"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db, professionalProfiles, proCredentials, categories, catalogServices, invitations, cities } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { sendInviteEmail, emailEnabled } from "@/lib/email";
import type { FormState } from "@/components/ActionForm";

const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);

// ---------- Profile review ----------
export async function approvePro(form: FormData) {
  const { user } = await requireAdmin();
  const id = str(form, "userId", 40);
  const [row] = await db
    .update(professionalProfiles)
    .set({ reviewStatus: "approved", approvedAt: new Date(), reviewNote: null, searchable: true })
    .where(and(eq(professionalProfiles.userId, id), eq(professionalProfiles.reviewStatus, "submitted")))
    .returning();
  if (row) await logActivity({ actorUserId: user.id, action: "pro.approved", targetType: "professional", targetId: row.businessName ?? id, before: "submitted", after: "approved" });
  revalidatePath("/admin", "layout");
}

export async function rejectPro(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const id = str(form, "userId", 40);
  const note = str(form, "note", 500);
  if (!note) return { error: "Tell the professional what to change." };
  const [row] = await db
    .update(professionalProfiles)
    .set({ reviewStatus: "rejected", reviewNote: note, searchable: false })
    .where(and(eq(professionalProfiles.userId, id), eq(professionalProfiles.reviewStatus, "submitted")))
    .returning();
  if (row) await logActivity({ actorUserId: user.id, action: "pro.changes_requested", targetType: "professional", targetId: row.businessName ?? id, before: "submitted", after: note });
  revalidatePath("/admin", "layout");
  return { ok: "Sent back with your note." };
}

export async function setCredential(form: FormData) {
  const { user } = await requireAdmin();
  const id = str(form, "id", 40);
  const status = str(form, "status", 20) as "verified" | "rejected";
  if (!["verified", "rejected"].includes(status)) return;
  const note = status === "rejected" ? str(form, "note", 300) || "License couldn't be confirmed. Check the number and expiration." : null;
  const [row] = await db.update(proCredentials).set({ status, reviewNote: note }).where(eq(proCredentials.id, id)).returning();
  if (row) await logActivity({ actorUserId: user.id, action: `license.${status}`, targetType: "credential", targetId: row.licenseNumber, before: "pending", after: status });
  revalidatePath("/admin", "layout");
}

// ---------- Marketplace catalog ----------
export async function addCategory(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const name = str(form, "name", 40);
  if (!name) return { error: "Enter a category name." };
  const licenseLabel = str(form, "licenseLabel", 120) || null;
  const [row] = await db.insert(categories).values({ name, licenseRequired: !!licenseLabel, licenseLabel, sort: 100 }).onConflictDoNothing().returning();
  if (!row) return { error: "That category already exists." };
  await logActivity({ actorUserId: user.id, action: "category.added", targetType: "category", targetId: name, after: { licenseLabel } });
  revalidatePath("/admin/marketplace");
  return { ok: `${name} added.` };
}

export async function updateCategory(form: FormData) {
  const { user } = await requireAdmin({ owner: true });
  const id = Number(form.get("id"));
  const cat = await db.query.categories.findFirst({ where: eq(categories.id, id) });
  if (!cat) return;
  const field = str(form, "field", 20);
  const patch = field === "license" ? { licenseRequired: !cat.licenseRequired } : field === "active" ? { active: !cat.active } : null;
  if (!patch) return;
  await db.update(categories).set(patch).where(eq(categories.id, id));
  await logActivity({ actorUserId: user.id, action: `category.${field}`, targetType: "category", targetId: cat.name, before: field === "license" ? cat.licenseRequired : cat.active, after: Object.values(patch)[0] });
  revalidatePath("/admin/marketplace");
}

export async function addCatalogService(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const categoryId = Number(form.get("categoryId"));
  const name = str(form, "name", 60);
  if (!categoryId || !name) return { error: "Choose a category and enter a service name." };
  const [row] = await db.insert(catalogServices).values({ categoryId, name, sort: 100 }).onConflictDoNothing().returning();
  if (!row) return { error: "That service is already listed." };
  await logActivity({ actorUserId: user.id, action: "service.added", targetType: "catalog_service", targetId: name });
  revalidatePath("/admin/marketplace");
  return { ok: `${name} added.` };
}

// ---------- Invite emails ----------
export async function emailInvite(form: FormData) {
  const { user } = await requireAdmin();
  const id = str(form, "id", 40);
  const inv = await db
    .select({ i: invitations, city: cities.name })
    .from(invitations)
    .innerJoin(cities, eq(cities.id, invitations.cityId))
    .where(and(eq(invitations.id, id), eq(invitations.status, "invited")))
    .limit(1);
  const hit = inv[0];
  if (!hit || !hit.i.contact.includes("@") || !emailEnabled()) return;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const res = await sendInviteEmail({
    to: hit.i.contact,
    name: hit.i.name,
    city: hit.city,
    code: hit.i.code,
    link: `${origin}/pro/invite/${hit.i.code}`,
    expires: hit.i.expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }),
  });
  await logActivity({ actorUserId: user.id, action: res.sent ? "invite.emailed" : "invite.email_failed", targetType: "invitation", targetId: hit.i.code, after: res.sent ? hit.i.contact : res.reason });
  revalidatePath("/admin/founding");
}
