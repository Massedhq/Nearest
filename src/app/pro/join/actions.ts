"use server";
import { redirect } from "next/navigation";
import { requirePro } from "@/lib/pro";
import { origin } from "@/lib/stripe";
import type { FormState } from "@/components/ActionForm";

/** Retired: joining is free now (see enrollPro). Kept only so any old open tab lands on the Join page. */
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

/** Join Nearest with no payment: claim the spot and accept the Professional Terms (membership activates at the first booking). */
export async function enrollPro(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requirePro({ allowUnpaid: true });
  if (profile.entryPaidAt) redirect("/pro/home");
  const type = String(form.get("type") ?? "");
  const { allowedEntries, ENTRY } = await import("@/lib/entry");
  const { allowed, reason } = await allowedEntries(profile);
  if (!allowed.includes(type as (typeof allowed)[number])) {
    return { error: reason === "paused" ? "New professional enrollment is paused right now." : reason === "slot" ? "Choose your city and main category first." : reason === "full" ? "Your city and category is full right now." : "That option isn't available right now." };
  }
  const { PRO_TERMS_VERSION } = await import("@/lib/pro-terms");
  if (form.get("acceptTerms") !== "on" || String(form.get("termsVersion")) !== PRO_TERMS_VERSION) return { error: "Read and accept the Professional Terms to continue." };
  if (form.get("inviteReward") !== "on") return { error: "Please agree to honor the $5 student invite reward." };
  const { headers } = await import("next/headers");
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64) || null;
  const { db, professionalProfiles } = await import("@/db");
  const { eq, and, isNull } = await import("drizzle-orm");
  const t = type as keyof typeof ENTRY;
  const [row] = await db.update(professionalProfiles).set({
    entryType: t, monthlyRateCents: ENTRY[t].cents, entryPaidAt: new Date(), // "joined" — no charge; membership activates at the first booking
    cohort: t === "FIRST_IN" ? "FOUNDING" : "SECOND", entryHoldUntil: null,
    proTermsVersion: PRO_TERMS_VERSION, proTermsAcceptedAt: new Date(), proTermsIp: ip,
  }).where(and(eq(professionalProfiles.userId, user.id), isNull(professionalProfiles.entryPaidAt))).returning();
  if (row) {
    const { logActivity } = await import("@/lib/log");
    await logActivity({ actorUserId: user.id, action: "pro.enrolled", targetType: "professional", targetId: user.id, after: { entryType: t, termsVersion: PRO_TERMS_VERSION, ip } });
    try { await (await import("@/lib/outreach")).checkCapacity(row.slotCityId, row.slotCategoryId); } catch (e) { console.error(e); }
  }
  redirect("/pro/home");
}
