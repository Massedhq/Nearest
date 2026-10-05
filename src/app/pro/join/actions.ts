"use server";
import { redirect } from "next/navigation";
import { requirePro } from "@/lib/pro";
import type { FormState } from "@/components/ActionForm";

/** Retired: joining is free — pros accept the Professional Terms when they submit their profile. Old open tabs land back here. */
export async function payEntry(): Promise<FormState> {
  redirect("/pro/join");
}

/** Join step 1: where they work (ZIP → city) and their main category — decides First In / next entry / waitlist. */
export async function saveSlot(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requirePro({ allowUnpaid: true });
  if (profile.entryPaidAt) return { error: "You've already joined Nearest." };
  // Once a full city + category is shown, it can't be swapped for another one — the waitlist is the only path.
  if (profile.slotCityId && profile.slotCategoryId) {
    const { slotStatus } = await import("@/lib/slots");
    if ((await slotStatus(profile))?.tier === "full") return { error: "Your city and category is full. Join the waitlist and we'll invite you when a spot opens." };
  }
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
  if (!z.county) return { error: "We couldn't confirm that ZIP code right now. Try again in a minute — if it keeps happening, email support@usenearest.com." };
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
  // A full city + category is final — no switching to a different ZIP or category to get around it.
  const { slotStatus } = await import("@/lib/slots");
  if ((await slotStatus(profile))?.tier === "full") redirect("/pro/join");
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

