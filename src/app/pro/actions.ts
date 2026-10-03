"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import {
  studentIdDocs,
  db, professionalProfiles, proServices, proHours, proBlocks, proOpenings, portfolioItems, proCredentials, categories, modelCalls, cities, cityCounties, bookings,
} from "@/db";
import { requirePro, setupSteps, nextStep, setupComplete } from "@/lib/pro";
import { getSettings } from "@/lib/settings";
import { chicagoNow, chicagoToUtc, toMinutes } from "@/lib/time";
import { geocode } from "@/lib/geo";
import { instagramHandle, tiktokHandle } from "@/lib/social";
import { slugify, validSlug } from "@/lib/connections";
import { MAX_PRICE_DOLLARS } from "@/lib/pricing";
import type { FormState } from "@/components/ActionForm";
import { MAX_PHOTOS, MAX_VIDEOS, MAX_VIDEO_SECONDS } from "@/lib/portfolio-limits";
import { proReadiness } from "@/lib/live-check";

const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const isEdit = (f: FormData) => f.get("edit") === "1";

async function done(userId: string, key: string, form: FormData): Promise<FormState> {
  revalidatePath("/pro", "layout");
  if (form.get("later") === "1") redirect("/pro/home?setup=saved"); // saved — finish the rest later
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
  const igRaw = str(form, "instagram", 200), ttRaw = str(form, "tiktok", 200);
  const slugRaw = str(form, "slug", 40).toLowerCase().replace(/^pro-/, "");
  if (slugRaw) {
    const slug = slugify(slugRaw);
    if (!validSlug(slug)) return { error: "Booking link: use 3–30 letters, numbers or dashes." };
    const taken = await db.query.professionalProfiles.findFirst({ where: and(eq(professionalProfiles.slug, slug), sql`${professionalProfiles.userId} <> ${user.id}`) });
    if (taken) return { error: `usenearest.com/pro-${slug} is taken. Try another.` };
    await db.update(professionalProfiles).set({ slug }).where(eq(professionalProfiles.userId, user.id));
  }
  const instagram = instagramHandle(igRaw);
  const tiktok = tiktokHandle(ttRaw);
  if (igRaw && !instagram) return { error: "Instagram: enter your @handle or paste your profile link (not a post)." };
  if (ttRaw && !tiktok) return { error: "TikTok: enter your @handle or paste your profile link." };
  if (!businessName) return { error: "Add your business or professional name." };
  if (!bio) return { error: "Tell customers a little about your work." };
  if (years !== null && (!Number.isInteger(years) || years < 0 || years > 70)) return { error: "Years of experience should be a whole number." };
  await db
    .update(professionalProfiles)
    .set({ businessName, bio, yearsExperience: years, instagram, tiktok, website: null, showInstagram: form.get("showInstagram") === "on" })
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
type Row = { categoryId: number; name: string; price: string; duration: string; adultsOnly?: boolean };

export async function saveServices(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requirePro();
  let rows: Row[];
  try {
    rows = JSON.parse(String(form.get("payload") ?? "[]"));
  } catch {
    return { error: "Something went wrong reading your services. Try again." };
  }
  if (form.get("later") === "1") {
    // Save & finish later: keep exactly what they typed, even half-finished rows, and come back to it.
    await db.update(professionalProfiles).set({ servicesDraft: rows.slice(0, 200) }).where(eq(professionalProfiles.userId, user.id));
    revalidatePath("/pro", "layout");
    redirect("/pro/home?setup=saved");
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
    if (!Number.isFinite(price) || price <= 0) return { error: `Enter a price for ${name}.` };
    if (price > MAX_PRICE_DOLLARS) return { error: `Student prices can't be more than $${MAX_PRICE_DOLLARS} — ${name} is set to $${price}.` };
    if (!Number.isInteger(duration) || duration < 10 || duration > 600) return { error: `Enter ${name}'s length in minutes (10–600).` };
    values.push({ userId: user.id, categoryId: Number(r.categoryId), name, priceCents: Math.round(price * 100), durationMin: duration, sort: i, adultsOnly: Boolean(r.adultsOnly) });
  }
  // Spots are limited per city, per category — nobody can add a category that's full where they work.
  const full = await (await import("@/lib/slots")).wouldOverfill(profile, profile.cityId ?? profile.slotCityId, values.map((v) => v.categoryId));
  if (full) return { error: full };
  // Remember which service each portfolio photo was tagged with (by name) so editing the menu keeps "Book this look".
  const tagged = await db.select({ photoId: portfolioItems.id, name: proServices.name }).from(portfolioItems)
    .innerJoin(proServices, eq(proServices.id, portfolioItems.serviceId)).where(eq(portfolioItems.userId, user.id));
  // Replace the whole menu. (Later phases keep old rows once bookings reference them.)
  await db.delete(proServices).where(eq(proServices.userId, user.id));
  const inserted = await db.insert(proServices).values(values).returning();
  for (const t of tagged) {
    const same = inserted.find((x) => x.name.trim().toLowerCase() === t.name.trim().toLowerCase());
    if (same) await db.update(portfolioItems).set({ serviceId: same.id }).where(eq(portfolioItems.id, t.photoId));
  }
  await db.update(professionalProfiles).set({ servicesDraft: null }).where(eq(professionalProfiles.userId, user.id));
  return done(user.id, "services", form);
}

// ---------- Credentials ----------
export async function saveCredentials(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePro();
  const ids = form.getAll("categoryId").map(Number);
  if (!ids.length) return done(user.id, "credentials", form);
  for (const id of ids) {
    if (str(form, `mode_${id}`, 10) === "diploma") {
      // Recent graduate, license pending: school + graduation date + diploma photo and/or number.
      const schoolName = str(form, `school_${id}`, 120);
      const completed = str(form, `completed_${id}`, 10);
      const number = str(form, `dipnum_${id}`, 40);
      const photo = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(form.get(`diploma_${id}`) ?? ""));
      const hadPhoto = await db.query.studentIdDocs.findFirst({ where: and(eq(studentIdDocs.userId, user.id), eq(studentIdDocs.kind, `diploma_${id}`)) });
      if (!schoolName || !/^\d{4}-\d{2}-\d{2}$/.test(completed)) return { error: "Enter your school and graduation date." };
      if (!photo && !number && !hadPhoto) return { error: "Add a photo of your diploma or certificate, or its number." };
      if (photo && photo[1].length > 1_400_000) return { error: "That photo is too large. Try again." };
      if (photo) {
        await db.insert(studentIdDocs).values({ userId: user.id, kind: `diploma_${id}`, mime: "image/jpeg", dataB64: photo[1] })
          .onConflictDoUpdate({ target: [studentIdDocs.userId, studentIdDocs.kind], set: { dataB64: photo[1], createdAt: new Date() } });
      }
      const licenseType = "Recent graduate — license pending";
      await db.insert(proCredentials)
        .values({ userId: user.id, categoryId: id, kind: "diploma", licenseType, licenseNumber: number, schoolName, completedOn: completed, issuingState: "Texas" })
        .onConflictDoUpdate({
          target: [proCredentials.userId, proCredentials.categoryId],
          set: { kind: "diploma", licenseType, licenseNumber: number, schoolName, completedOn: completed, expiresOn: null, status: "pending", reviewNote: null },
        });
      continue;
    }
    const licenseType = str(form, `type_${id}`, 120);
    const licenseNumber = str(form, `number_${id}`, 40);
    const issuingState = str(form, `state_${id}`, 30) || "Texas";
    const expires = str(form, `expires_${id}`, 10);
    if (!licenseType || !licenseNumber) return { error: "Enter the license type and number for each category." };
    if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) return { error: "Use the date picker for the expiration." };
    await db
      .insert(proCredentials)
      .values({ userId: user.id, categoryId: id, kind: "license", licenseType, licenseNumber, issuingState, expiresOn: expires || null })
      .onConflictDoUpdate({
        target: [proCredentials.userId, proCredentials.categoryId],
        set: { kind: "license", licenseType, licenseNumber, issuingState, expiresOn: expires || null, schoolName: null, completedOn: null, status: "pending", reviewNote: null },
      });
  }
  return done(user.id, "credentials", form);
}

// ---------- Location ----------
export async function saveLocation(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requirePro();
  const cityId = Number(form.get("cityId"));
  const zip = str(form, "zip", 10);
  const addressLine = str(form, "address", 160);
  const addressUnit = str(form, "unit", 40) || null;
  const mode = str(form, "mode", 20) as "come_to_me" | "travel" | "both";
  const radius = Number(form.get("radius") || 0);
  if (!cityId) return { error: "Choose your city." };
  if (!/^\d{5}$/.test(zip)) return { error: "Enter a 5-digit ZIP code." };
  if (!["come_to_me", "travel", "both"].includes(mode)) return { error: "Choose how you provide services." };
  if (mode !== "travel" && !addressLine) return { error: "Add the address where customers come to you. It stays private." };
  if (mode !== "come_to_me" && !(radius > 0 && radius <= 50)) return { error: "Choose how far you'll travel." };
  const feeRaw = str(form, "travelFee", 8).replace(/[$,\s]/g, "");
  const travelFee = mode === "come_to_me" ? null : Number(feeRaw || "35");
  if (travelFee !== null && (!Number.isFinite(travelFee) || travelFee < 35 || travelFee > 55)) return { error: "Travel fee must be between $35 and $55." };
  const link = await db.query.cityCounties.findFirst({ where: eq(cityCounties.cityId, cityId) });
  const city = await db.query.cities.findFirst({ where: eq(cities.id, cityId) });
  if (!city) return { error: "Choose your city." };
  // Moving to a different city: every category they offer (and the one they joined under) must have room there.
  if (cityId !== profile.cityId) {
    const mine = await db.select({ c: proServices.categoryId }).from(proServices).where(and(eq(proServices.userId, user.id), eq(proServices.active, true)));
    const cats = [...mine.map((m) => m.c), ...(profile.slotCategoryId ? [profile.slotCategoryId] : [])];
    const full = await (await import("@/lib/slots")).wouldOverfill({ ...profile, cityId: null, slotCityId: null }, cityId, cats);
    if (full) {
      // Active members who move can ask for a transfer instead of being blocked — an owner approves it.
      const active = ["active", "trialing", "past_due"].includes(profile.subscriptionStatus ?? "") || Boolean(profile.cardSavedAt);
      if (!active || !profile.cityId) return { error: full };
      const point = addressLine ? await geocode(addressLine, city.name, zip, city.state) : null;
      const payload = { cityId, countyId: link?.countyId ?? null, zip, addressLine: addressLine || null, addressUnit, lat: point?.lat ?? null, lng: point?.lng ?? null, serviceMode: mode, travelFeeCents: travelFee === null ? null : Math.round(travelFee * 100), travelRadiusMi: mode === "come_to_me" ? null : radius };
      const { proTransfers } = await import("@/db");
      await db.update(proTransfers).set({ status: "cancelled" }).where(and(eq(proTransfers.userId, user.id), eq(proTransfers.status, "pending")));
      await db.insert(proTransfers).values({ userId: user.id, fromCityId: profile.cityId, toCityId: cityId, payload, note: str(form, "transferNote", 300) || null });
      revalidatePath("/pro", "layout");
      return { ok: `${city.name} is full in your category, so we sent Nearest a transfer request. You'll stay listed where you are until it's approved — we'll let you know.` };
    }
  }
  const point = addressLine ? await geocode(addressLine, city.name, zip, city.state) : null;
  await db
    .update(professionalProfiles)
    .set({ cityId, ...(profile.slotCityId ? { slotCityId: cityId } : {}), countyId: link?.countyId ?? null, zip, addressLine: addressLine || null, addressUnit, lat: point?.lat ?? null, lng: point?.lng ?? null, serviceMode: mode, travelFeeCents: travelFee === null ? null : Math.round(travelFee * 100), travelRadiusMi: mode === "come_to_me" ? null : radius })
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
const MAX_PORTFOLIO = MAX_PHOTOS; // also shown on the Portfolio screen

export async function addPortfolio(urls: string[]): Promise<{ error?: string }> {
  const { user } = await requirePro();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(portfolioItems).where(and(eq(portfolioItems.userId, user.id), eq(portfolioItems.kind, "image")));
  const room = MAX_PORTFOLIO - n;
  if (room <= 0) return { error: `You can show up to ${MAX_PORTFOLIO} photos. Remove one to add another.` };
  const valid = urls.filter((u) => blobUrlOk(u, user.id));
  if (!valid.length) return { error: "Upload didn't complete. Try again." };
  const ok = valid.slice(0, room);
  await db.insert(portfolioItems).values(ok.map((url, i) => ({ userId: user.id, url, sort: Date.now() % 1_000_000 + i })));
  revalidatePath("/pro", "layout");
  revalidatePath(`/p/${user.id}`);
  if (valid.length > room) return { error: `Added ${ok.length}. You can show up to ${MAX_PORTFOLIO} photos, so ${valid.length - room} weren't added.` };
  return {};
}

/** Add a portfolio video. Its length is read from the file itself on the server — over 15 seconds is deleted and refused. */
export async function addPortfolioVideo(url: string): Promise<{ error?: string }> {
  const { user } = await requirePro();
  if (!url || !blobUrlOk(url, user.id) || !new URL(url).pathname.startsWith(`/pros/${user.id}/portfolio-video/`)) return { error: "Upload didn't complete. Try again." };
  const discard = async () => { try { const { del } = await import("@vercel/blob"); await del(url); } catch (e) { console.error(e); } };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(portfolioItems).where(and(eq(portfolioItems.userId, user.id), eq(portfolioItems.kind, "video")));
  if (n >= MAX_VIDEOS) { await discard(); return { error: `You can show up to ${MAX_VIDEOS} videos. Remove one to add another.` }; }
  const { videoSeconds } = await import("@/lib/video-length");
  const secs = await videoSeconds(url);
  if (secs === null) { await discard(); return { error: "We couldn't read this video. Try an MP4 or a video straight from your phone's camera." }; }
  if (secs > MAX_VIDEO_SECONDS + 0.5) { await discard(); return { error: `This video is ${Math.round(secs)} seconds. Videos can be up to ${MAX_VIDEO_SECONDS} seconds — trim it and try again.` }; }
  await db.insert(portfolioItems).values({ userId: user.id, url, kind: "video", durationSec: Math.round(secs * 10) / 10, sort: Date.now() % 1_000_000 });
  revalidatePath("/pro", "layout");
  revalidatePath(`/p/${user.id}`);
  return {};
}

/** Tag a photo with the service it shows (or clear it) — used for "Book this look". */
export async function setPortfolioService(form: FormData) {
  const { user } = await requirePro();
  const id = String(form.get("id"));
  const serviceId = String(form.get("serviceId") ?? "") || null;
  if (serviceId) {
    const svc = await db.query.proServices.findFirst({ where: and(eq(proServices.id, serviceId), eq(proServices.userId, user.id)) });
    if (!svc) return;
  }
  await db.update(portfolioItems).set({ serviceId }).where(and(eq(portfolioItems.id, id), eq(portfolioItems.userId, user.id)));
  revalidatePath("/pro", "layout");
  revalidatePath(`/p/${user.id}`);
}

export async function removePortfolio(form: FormData) {
  const { user } = await requirePro();
  const [gone] = await db.delete(portfolioItems).where(and(eq(portfolioItems.id, String(form.get("id"))), eq(portfolioItems.userId, user.id))).returning();
  // Videos are large: delete the file too (photos can be shared with client photos, so they stay).
  if (gone?.kind === "video") { try { const { del } = await import("@vercel/blob"); await del(gone.url); } catch (e) { console.error(e); } }
  revalidatePath("/pro", "layout");
  revalidatePath(`/p/${user.id}`);
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
  const flexible = form.get("flexible") === "on";
  let startsAt: Date;
  if (flexible) {
    // Open time: models pick from your availability until this date (end of day); default 30 days.
    const until = str(form, "openUntil", 10);
    const end = /^\d{4}-\d{2}-\d{2}$/.test(until) ? until : new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
    startsAt = chicagoToUtc(end, "23:59");
    if (startsAt.getTime() < Date.now()) return { error: "Choose an open-until date in the future." };
  } else {
    const day = str(form, "day", 10);
    const time = str(form, "time", 5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Choose a date and time, or turn on Open time." };
    startsAt = chicagoToUtc(day, time);
    if (startsAt.getTime() < Date.now() + 60 * 60 * 1000) return { error: "Pick a time at least an hour from now." };
  }
  const photoRaw = str(form, "photoUrl", 500);
  const photoUrl = photoRaw && blobUrlOk(photoRaw, user.id) ? photoRaw : null;
  const price = Number(str(form, "price", 10).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(price) || price < 0) return { error: "Enter the model price (0 for free)." };
  if (price > MAX_PRICE_DOLLARS) return { error: `Student prices can't be more than $${MAX_PRICE_DOLLARS}.` };
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
    about: str(form, "about", 2000) || null,
    flexible,
    photoUrl,
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

/** Remove a cancelled or finished Model Call from your list. Past appointments made through it are kept. */
export async function deleteModelCall(form: FormData) {
  const { user } = await requirePro();
  const id = String(form.get("id"));
  const call = await db.query.modelCalls.findFirst({ where: and(eq(modelCalls.id, id), eq(modelCalls.userId, user.id)) });
  if (!call) return;
  const done = call.status === "cancelled" || call.startsAt.getTime() < Date.now();
  if (!done) return; // open calls are cancelled first
  const upcoming = await db.query.bookings.findFirst({ where: and(eq(bookings.modelCallId, id), inArray(bookings.status, ["confirmed", "pending_payment"]), gt(bookings.startsAt, new Date())) });
  if (upcoming) return;
  await db.update(bookings).set({ modelCallId: null }).where(eq(bookings.modelCallId, id));
  await db.delete(modelCalls).where(eq(modelCalls.id, id));
  revalidatePath("/pro", "layout");
}

// ---------- Go live ----------
/** The professional's own switch: Go live (show in search) or Go offline. Payouts are never required. */
export async function setGoLive(form: FormData) {
  const { user, profile } = await requirePro();
  const on = form.get("on") === "1";
  if (on && (await proReadiness(profile)).length > 0) return; // the card lists what's left instead
  await db.update(professionalProfiles).set({ searchable: on }).where(eq(professionalProfiles.userId, user.id));
  revalidatePath("/pro", "layout");
  revalidatePath("/home");
}
