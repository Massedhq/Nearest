"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gt, inArray } from "drizzle-orm";
import {
  db, professionalProfiles, proServices, proHours, proBlocks, proOpenings, portfolioItems, proCredentials, categories, modelCalls, cities, cityCounties,
} from "@/db";
import { requirePro, setupSteps, nextStep, setupComplete } from "@/lib/pro";
import { getSettings } from "@/lib/settings";
import { chicagoNow, chicagoToUtc, toMinutes } from "@/lib/time";
import { geocode } from "@/lib/geo";
import type { FormState } from "@/components/ActionForm";

const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const isEdit = (f: FormData) => f.get("edit") === "1";

async function done(userId: string, key: string, form: FormData): Promise<FormState> {
  revalidatePath("/pro", "layout");
  if (isEdit(form)) return { ok: "Saved." };
  redirect(nextStep(await setupSteps(userId), key));
}

function blobUrlOk(url: string, userId: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com") && u.pathname.startsWith(`/pros/${userId}/`);
  } catch {
    return false;
  }
}

// ---------- Profile ----------
export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePro();
  const businessName = str(form, "businessName", 80);
  const bio = str(form, "bio", 1200);
  const yearsRaw = str(form, "years", 3);
  const years = yearsRaw ? Number(yearsRaw) : null;
  const instagram = str(form, "instagram", 60).replace(/^@/, "") || null;
  const tiktok = str(form, "tiktok", 60).replace(/^@/, "") || null;
  const website = str(form, "website", 200) || null;
  if (!businessName) return { error: "Add your business or professional name." };
  if (!bio) return { error: "Tell customers a little about your work." };
  if (years !== null && (!Number.isInteger(years) || years < 0 || years > 70)) return { error: "Years of experience should be a whole number." };
  if (website && !/^https?:\/\//i.test(website)) return { error: "Website should start with https://" };
  await db
    .update(professionalProfiles)
    .set({ businessName, bio, yearsExperience: years, instagram, tiktok, website, showInstagram: form.get("showInstagram") === "on" })
    .where(eq(professionalProfiles.userId, user.id));
  return done(user.id, "profile", form);
}

export async function saveAvatar(urls: string[]): Promise<{ error?: string }> {
  const { user } = await requirePro();
  const url = urls[0];
  if (!url || !blobUrlOk(url, user.id)) return { error: "Upload didn't complete. Try again." };
  await db.update(professionalProfiles).set({ photoUrl: url }).where(eq(professionalProfiles.userId, user.id));
  revalidatePath("/pro", "layout");
  return {};
}

// ---------- Services ----------
type Row = { categoryId: number; name: string; price: string; duration: string };

export async function saveServices(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePro();
  let rows: Row[];
  try {
    rows = JSON.parse(String(form.get("payload") ?? "[]"));
  } catch {
    return { error: "Something went wrong reading your services. Try again." };
  }
  const cleaned = rows.filter((r) => r.name.trim() || r.price.trim());
  if (!cleaned.length) return { error: "Add at least one service with a price." };
  const validCats = new Set((await db.select({ id: categories.id }).from(categories).where(eq(categories.active, true))).map((c) => c.id));
  const values = [];
  for (const [i, r] of cleaned.entries()) {
    const name = r.name.trim().slice(0, 80);
    const price = Number(String(r.price).replace(/[$,\s]/g, ""));
    const duration = Number(r.duration);
    if (!name) return { error: "Every service needs a name." };
    if (!validCats.has(Number(r.categoryId))) return { error: "Pick a category for every service." };
    if (!Number.isFinite(price) || price <= 0 || price > 2000) return { error: `Enter a price for ${name}.` };
    if (!Number.isInteger(duration) || duration < 10 || duration > 600) return { error: `Enter ${name}'s length in minutes (10–600).` };
    values.push({ userId: user.id, categoryId: Number(r.categoryId), name, priceCents: Math.round(price * 100), durationMin: duration, sort: i });
  }
  // Replace the whole menu. (Later phases keep old rows once bookings reference them.)
  await db.delete(proServices).where(eq(proServices.userId, user.id));
  await db.insert(proServices).values(values);
  return done(user.id, "services", form);
}

// ---------- Credentials ----------
export async function saveCredentials(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePro();
  const ids = form.getAll("categoryId").map(Number);
  if (!ids.length) return done(user.id, "credentials", form);
  for (const id of ids) {
    const licenseType = str(form, `type_${id}`, 120);
    const licenseNumber = str(form, `number_${id}`, 40);
    const issuingState = str(form, `state_${id}`, 30) || "Texas";
    const expires = str(form, `expires_${id}`, 10);
    if (!licenseType || !licenseNumber) return { error: "Enter the license type and number for each category." };
    if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) return { error: "Use the date picker for the expiration." };
    await db
      .insert(proCredentials)
      .values({ userId: user.id, categoryId: id, licenseType, licenseNumber, issuingState, expiresOn: expires || null })
      .onConflictDoUpdate({
        target: [proCredentials.userId, proCredentials.categoryId],
        set: { licenseType, licenseNumber, issuingState, expiresOn: expires || null, status: "pending", reviewNote: null },
      });
  }
  return done(user.id, "credentials", form);
}

// ---------- Location ----------
export async function saveLocation(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePro();
  const cityId = Number(form.get("cityId"));
  const zip = str(form, "zip", 10);
  const addressLine = str(form, "address", 160);
  const mode = str(form, "mode", 20) as "come_to_me" | "travel" | "both";
  const radius = Number(form.get("radius") || 0);
  if (!cityId) return { error: "Choose your city." };
  if (!/^\d{5}$/.test(zip)) return { error: "Enter a 5-digit ZIP code." };
  if (!["come_to_me", "travel", "both"].includes(mode)) return { error: "Choose how you provide services." };
  if (mode !== "travel" && !addressLine) return { error: "Add the address where customers come to you. It stays private." };
  if (mode !== "come_to_me" && !(radius > 0 && radius <= 50)) return { error: "Choose how far you'll travel." };
  const link = await db.query.cityCounties.findFirst({ where: eq(cityCounties.cityId, cityId) });
  const city = await db.query.cities.findFirst({ where: eq(cities.id, cityId) });
  if (!city) return { error: "Choose your city." };
  const point = addressLine ? await geocode(addressLine, city.name, zip) : null;
  await db
    .update(professionalProfiles)
    .set({ cityId, countyId: link?.countyId ?? null, zip, addressLine: addressLine || null, lat: point?.lat ?? null, lng: point?.lng ?? null, serviceMode: mode, travelRadiusMi: mode === "come_to_me" ? null : radius })
    .where(eq(professionalProfiles.userId, user.id));
  if (addressLine && !point && isEdit(form)) return { ok: "Saved. We couldn't map this address — double-check the street and ZIP so check-in works." };
  return done(user.id, "location", form);
}

// ---------- Hours ----------
export async function saveHours(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePro();
  const rows: { userId: string; kind: "regular" | "after_school"; weekday: number; startTime: string; endTime: string }[] = [];
  for (const kind of ["regular", "after_school"] as const) {
    for (let d = 0; d < 7; d++) {
      if (form.get(`${kind}_${d}_on`) !== "on") continue;
      const s = str(form, `${kind}_${d}_start`, 5);
      const e = str(form, `${kind}_${d}_end`, 5);
      if (!/^\d{2}:\d{2}$/.test(s) || !/^\d{2}:\d{2}$/.test(e) || toMinutes(e) <= toMinutes(s)) {
        return { error: "Each open day needs an end time after its start time." };
      }
      rows.push({ userId: user.id, kind, weekday: d, startTime: s, endTime: e });
    }
  }
  if (!rows.some((r) => r.kind === "regular")) return { error: "Open at least one day in your regular hours." };
  const afterSchool = rows.some((r) => r.kind === "after_school");
  await db.delete(proHours).where(eq(proHours.userId, user.id));
  await db.insert(proHours).values(rows);
  await db.update(professionalProfiles).set({ acceptsAfterSchool: afterSchool }).where(eq(professionalProfiles.userId, user.id));
  return done(user.id, "hours", form);
}

// ---------- Communication ----------
export async function saveCommunication(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePro();
  const languages = form.getAll("languages").map(String).filter(Boolean).slice(0, 10);
  const other = str(form, "otherLanguage", 40);
  if (other) languages.push(other);
  const asl = str(form, "asl", 20) as "none" | "basic" | "conversational" | "fluent";
  if (!["none", "basic", "conversational", "fluent"].includes(asl)) return { error: "Choose your ASL level (or None)." };
  if (asl !== "none" && !languages.includes("ASL")) languages.push("ASL");
  if (!languages.length) return { error: "Choose at least one way you communicate." };
  await db
    .update(professionalProfiles)
    .set({ languages, aslLevel: asl, textCommunication: form.get("text") === "on" })
    .where(eq(professionalProfiles.userId, user.id));
  return done(user.id, "communication", form);
}

// ---------- Portfolio ----------
export async function addPortfolio(urls: string[]): Promise<{ error?: string }> {
  const { user } = await requirePro();
  const ok = urls.filter((u) => blobUrlOk(u, user.id)).slice(0, 30);
  if (!ok.length) return { error: "Upload didn't complete. Try again." };
  await db.insert(portfolioItems).values(ok.map((url, i) => ({ userId: user.id, url, sort: Date.now() % 1_000_000 + i })));
  revalidatePath("/pro", "layout");
  return {};
}

export async function removePortfolio(form: FormData) {
  const { user } = await requirePro();
  await db.delete(portfolioItems).where(and(eq(portfolioItems.id, String(form.get("id"))), eq(portfolioItems.userId, user.id)));
  revalidatePath("/pro", "layout");
}

export async function toggleFeatured(form: FormData) {
  const { user } = await requirePro();
  const id = String(form.get("id"));
  const item = await db.query.portfolioItems.findFirst({ where: and(eq(portfolioItems.id, id), eq(portfolioItems.userId, user.id)) });
  if (!item) return;
  if (!item.featured) {
    const featured = await db.select({ id: portfolioItems.id }).from(portfolioItems).where(and(eq(portfolioItems.userId, user.id), eq(portfolioItems.featured, true)));
    if (featured.length >= 3) return;
  }
  await db.update(portfolioItems).set({ featured: !item.featured }).where(eq(portfolioItems.id, id));
  revalidatePath("/pro", "layout");
}

export async function finishPortfolio(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePro();
  return done(user.id, "portfolio", form);
}

// ---------- Submit for review ----------
export async function submitForReview(_: FormState, form: FormData): Promise<FormState> {
  void form;
  const { user, profile } = await requirePro();
  if (profile.reviewStatus === "approved") return { ok: "You're already approved." };
  if (!setupComplete(await setupSteps(user.id))) return { error: "Finish the remaining setup steps first." };
  await db
    .update(professionalProfiles)
    .set({ reviewStatus: "submitted", submittedAt: new Date(), reviewNote: null })
    .where(eq(professionalProfiles.userId, user.id));
  revalidatePath("/pro", "layout");
  redirect("/pro/home");
}

// ---------- Available Today ----------
export async function saveOpenings(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requirePro();
  if (profile.reviewStatus !== "approved") return { error: "Openings go live after your profile is approved." };
  if (profile.vacationMode) return { error: "Turn off vacation mode to post openings." };
  const s = await getSettings();
  const now = chicagoNow();
  const cutoff = toMinutes(String(s["booking.same_day_cutoff"]));
  if (now.minutes >= cutoff) return { error: "Same-day booking is closed for today. You can post openings again tomorrow morning." };
  const minStart = now.minutes + Number(s["booking.same_day_min_notice_hours"]) * 60;
  const times = form.getAll("slot").map(String).filter((t) => /^\d{2}:\d{2}$/.test(t));
  const bad = times.find((t) => toMinutes(t) < minStart);
  if (bad) return { error: "Some times are too soon. Same-day openings must start at least 4 hours from now." };
  await db.delete(proOpenings).where(and(eq(proOpenings.userId, user.id), eq(proOpenings.day, now.date)));
  if (times.length) await db.insert(proOpenings).values(times.map((t) => ({ userId: user.id, day: now.date, startTime: t })));
  revalidatePath("/pro", "layout");
  return { ok: times.length ? `Published ${times.length} opening${times.length === 1 ? "" : "s"} for today.` : "Openings cleared for today." };
}

// ---------- Model calls ----------
export async function createModelCall(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requirePro();
  if (profile.reviewStatus !== "approved") return { error: "You can publish model calls once your profile is approved." };
  const serviceId = str(form, "serviceId", 40);
  const service = serviceId ? await db.query.proServices.findFirst({ where: and(eq(proServices.id, serviceId), eq(proServices.userId, user.id)) }) : null;
  if (!service) return { error: "Choose one of your services." };
  const day = str(form, "day", 10);
  const time = str(form, "time", 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Choose a date and time." };
  const startsAt = chicagoToUtc(day, time);
  if (startsAt.getTime() < Date.now() + 60 * 60 * 1000) return { error: "Pick a time at least an hour from now." };
  const price = Number(str(form, "price", 10).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(price) || price < 0 || price > 1000) return { error: "Enter the model price (0 for free)." };
  const spots = Number(str(form, "spots", 3));
  if (!Number.isInteger(spots) || spots < 1 || spots > 20) return { error: "Spots should be between 1 and 20." };
  const duration = Number(str(form, "duration", 4)) || service.durationMin;
  const requirements = form.getAll("requirements").map(String).filter(Boolean).slice(0, 10);
  const extra = str(form, "otherRequirement", 120);
  if (extra) requirements.push(extra);
  await db.insert(modelCalls).values({
    userId: user.id,
    categoryId: service.categoryId,
    serviceName: service.name,
    startsAt,
    durationMin: duration,
    priceCents: Math.round(price * 100),
    spots,
    requirements,
    about: str(form, "about", 1000) || null,
  });
  revalidatePath("/pro", "layout");
  redirect("/pro/model-calls");
}

export async function cancelModelCall(form: FormData) {
  const { user } = await requirePro();
  await db
    .update(modelCalls)
    .set({ status: "cancelled" })
    .where(and(eq(modelCalls.id, String(form.get("id"))), eq(modelCalls.userId, user.id), inArray(modelCalls.status, ["open", "full"])));
  revalidatePath("/pro", "layout");
}

// ---------- Calendar ----------
export async function addBlock(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePro();
  const day = str(form, "day", 10);
  const start = str(form, "start", 5);
  const end = str(form, "end", 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return { error: "Choose a date, start and end time." };
  if (toMinutes(end) <= toMinutes(start)) return { error: "End time must be after the start time." };
  await db.insert(proBlocks).values({ userId: user.id, startsAt: chicagoToUtc(day, start), endsAt: chicagoToUtc(day, end), reason: str(form, "reason", 80) || null });
  revalidatePath("/pro/calendar");
  return { ok: "Time blocked." };
}

export async function removeBlock(form: FormData) {
  const { user } = await requirePro();
  await db.delete(proBlocks).where(and(eq(proBlocks.id, String(form.get("id"))), eq(proBlocks.userId, user.id)));
  revalidatePath("/pro/calendar");
}

export async function toggleVacation() {
  const { user, profile } = await requirePro();
  await db.update(professionalProfiles).set({ vacationMode: !profile.vacationMode }).where(eq(professionalProfiles.userId, user.id));
  if (!profile.vacationMode) {
    // Going on vacation clears any openings still posted for today or later.
    await db.delete(proOpenings).where(and(eq(proOpenings.userId, user.id), gt(proOpenings.day, "1900-01-01")));
  }
  revalidatePath("/pro", "layout");
}
