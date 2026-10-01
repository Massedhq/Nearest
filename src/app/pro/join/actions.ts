"use server";
import { redirect } from "next/navigation";
import { requirePro } from "@/lib/pro";
import { origin } from "@/lib/stripe";
import { startEntryCheckout, isEntryType, isManagedEntry } from "@/lib/entry";
import type { FormState } from "@/components/ActionForm";

export async function payEntry(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePro({ allowUnpaid: true });
  const type = String(form.get("type"));
  // Free and pay-from-bookings accounts come only from the main owner's invitations — never from this page.
  if (!isEntryType(type) || isManagedEntry(type)) return { error: "Choose an option." };
  let student;
  if (type === "PRO_STUDENT") {
    const firstName = String(form.get("studentFirst") ?? "").trim().slice(0, 60);
    const lastName = String(form.get("studentLast") ?? "").trim().slice(0, 60);
    const email = String(form.get("studentEmail") ?? "").trim().slice(0, 120);
    const school = String(form.get("studentSchool") ?? "").trim().slice(0, 120) || null;
    if (!firstName || !lastName) return { error: "Enter your student's first and last name." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter your student's email." };
    if (email.toLowerCase() === (user.email ?? "").toLowerCase()) return { error: "The student needs their own email address." };
    student = { firstName, lastName, email, school };
  }
  const res = await startEntryCheckout(user, { type, student }, await origin());
  if ("error" in res) return { error: res.error };
  redirect(res.url);
}

/** Join step 1: where they work (ZIP → city) and their main category — decides First In / next entry / waitlist. */
export async function saveSlot(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requirePro({ allowUnpaid: true });
  if (profile.entryPaidAt) return { error: "You've already joined Nearest." };
  const zip = String(form.get("zip") ?? "").trim();
  const categoryId = Number(form.get("categoryId"));
  if (!/^\d{5}$/.test(zip)) return { error: "Enter your 5-digit ZIP code." };
  const { db, categories, professionalProfiles } = await import("@/db");
  const { eq, and } = await import("drizzle-orm");
  const cat = categoryId ? await db.query.categories.findFirst({ where: and(eq(categories.id, categoryId), eq(categories.active, true)) }) : null;
  if (!cat || cat.name === "Other") return { error: "Choose the category for your main service." };
  const { lookupZip, findOrCreateCounty, findOrCreateCity } = await import("@/lib/places");
  const z = await lookupZip(zip);
  if ("error" in z) return { error: z.error };
  if (!z.county) return { error: "We couldn't find the county for that ZIP code. Try another ZIP." };
  const county = await findOrCreateCounty(z.state, z.county);
  const { city } = await findOrCreateCity(z.state, z.city, county.id);
  await db.update(professionalProfiles).set({ slotCityId: city.id, slotCategoryId: cat.id }).where(eq(professionalProfiles.userId, user.id));
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/pro/join");
  return { ok: "Saved." };
}

export async function clearSlot() {
  const { user, profile } = await requirePro({ allowUnpaid: true });
  if (profile.entryPaidAt) return;
  const { db, professionalProfiles } = await import("@/db");
  const { eq } = await import("drizzle-orm");
  await db.update(professionalProfiles).set({ slotCityId: null, slotCategoryId: null }).where(eq(professionalProfiles.userId, user.id));
  redirect("/pro/join");
}

export async function joinSlotWaitlist() {
  const { user, profile } = await requirePro({ allowUnpaid: true });
  if (profile.slotCityId && profile.slotCategoryId) {
    const { joinWaitlist } = await import("@/lib/slots");
    await joinWaitlist(user.id, profile.slotCityId, profile.slotCategoryId);
  }
  redirect("/pro/join?waitlist=1");
}
