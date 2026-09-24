import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, bookings, credits, studentProfiles, professionalProfiles, reviews, portfolioItems, incidents } from "@/db";
import { getSettings } from "./settings";
import { chicagoNow, TZ } from "./time";
import { distanceFt, withinRadius } from "./geo";
import { bookingCode, releasePayment } from "./bookings";
import { stripe } from "./stripe";
import { checkNoShowLimit } from "./enforcement";

type Booking = typeof bookings.$inferSelect;

const chicagoDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** The address unlocks at 12:00 AM (Chicago) on the appointment day. */
export const addressUnlocked = (b: Booking) => chicagoDate(b.startsAt) <= chicagoNow().date;

/** Check-in opens 60 minutes before the start and closes when the appointment ends. */
export const checkinOpen = (b: Booking) => b.status === "confirmed" && Date.now() >= b.startsAt.getTime() - 60 * 60000 && Date.now() <= b.endsAt.getTime();

/** Finish steps unlock when the pro taps Finish, or once the scheduled end time passes. */
export const finishOpen = (b: Booking) => b.status === "confirmed" && (Boolean(b.finishedAt) || Date.now() >= b.endsAt.getTime());

export async function noShowAllowedAt(b: Booking) {
  const s = await getSettings();
  return new Date(b.startsAt.getTime() + Number(s["appt.grace_minutes"]) * 60000);
}

export async function checkIn(b: Booking, pos: { lat: number; lng: number; accuracyM: number }) {
  if (!checkinOpen(b)) return { error: "Check-in opens 60 minutes before your appointment." };
  if (b.checkedInAt) return { ok: "You're already checked in." };
  const s = await getSettings();
  const radius = Number(s["appt.checkin_radius_ft"]);
  const acc = Math.round(pos.accuracyM * 3.281);
  let dist: number | null = null;
  if (b.lat != null && b.lng != null) {
    dist = distanceFt({ lat: b.lat, lng: b.lng }, pos);
    if (!withinRadius(dist, acc, radius)) {
      return { error: `You look about ${dist.toLocaleString()} ft away. Check in when you're at the appointment location (within ${radius} ft).` };
    }
  }
  await db.update(bookings).set({ checkedInAt: new Date(), checkinDistanceFt: dist, checkinAccuracyFt: acc }).where(eq(bookings.id, b.id));
  return { ok: dist == null ? "Checked in. (We couldn't map this address, so location wasn't compared.)" : "Checked in — location confirmed." };
}

export async function startService(b: Booking) {
  if (b.status !== "confirmed" || b.startedAt) return;
  await db.update(bookings).set({ startedAt: new Date() }).where(eq(bookings.id, b.id));
}

export async function finishService(b: Booking) {
  if (b.status !== "confirmed" || b.finishedAt) return;
  await db.update(bookings).set({ finishedAt: new Date(), startedAt: b.startedAt ?? new Date() }).where(eq(bookings.id, b.id));
}

/** Pro marks a no-show after the grace period when the student never checked in: deposit goes to the pro, the rest becomes credit with that pro. */
export async function markNoShow(b: Booking) {
  if (b.status !== "confirmed" || b.checkedInAt) return { error: "This appointment can't be marked a no-show." };
  if (Date.now() < (await noShowAllowedAt(b)).getTime()) return { error: "You can mark a no-show once the grace period has passed." };
  const [done] = await db.update(bookings).set({ status: "no_show", noShowAt: new Date() }).where(and(eq(bookings.id, b.id), eq(bookings.status, "confirmed"))).returning();
  if (!done) return { error: "This appointment was already changed." };
  const forfeit = Math.min(b.depositCents, b.chargedCents + b.creditProCents);
  const back = [];
  if (b.chargedCents + b.creditProCents - forfeit > 0) back.push({ studentId: b.studentId, proId: b.proId, amountCents: b.chargedCents + b.creditProCents - forfeit, reason: `No-show ${bookingCode(b.number)}`, bookingId: b.id });
  if (b.creditGeneralCents > 0) back.push({ studentId: b.studentId, proId: null, amountCents: b.creditGeneralCents, reason: `No-show ${bookingCode(b.number)}`, bookingId: b.id });
  if (back.length) await db.insert(credits).values(back);
  await db.update(studentProfiles).set({ noShowCount: sql`${studentProfiles.noShowCount} + 1` }).where(eq(studentProfiles.userId, b.studentId));
  await checkNoShowLimit(b.studentId);
  const pro = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, b.proId) });
  if (forfeit > 0 && pro?.stripeAccountId && pro.payoutsEnabled) {
    try {
      const t = await stripe().transfers.create(
        { amount: forfeit, currency: "usd", destination: pro.stripeAccountId, transfer_group: b.id, ...(b.stripeChargeId ? { source_transaction: b.stripeChargeId } : {}), metadata: { bookingId: b.id, kind: "no_show_deposit" } },
        { idempotencyKey: `noshow-${b.id}` },
      );
      await db.update(bookings).set({ transferId: t.id }).where(eq(bookings.id, b.id));
    } catch (e) {
      console.error("No-show deposit transfer failed", b.id, e);
    }
  }
  return { ok: "Marked as a no-show. The deposit is yours; the rest became the student's credit with you." };
}

// ---------- Student finish steps ----------
export async function confirmService(b: Booking) {
  if (!finishOpen(b)) return;
  await db.update(bookings).set({ serviceConfirmedAt: b.serviceConfirmedAt ?? new Date() }).where(eq(bookings.id, b.id));
}

export async function savePhoto(b: Booking, url: string | null, allowPortfolio: boolean) {
  await db.update(bookings).set({ photoUrl: url, photoForPortfolio: url ? allowPortfolio : null }).where(eq(bookings.id, b.id));
  if (url && allowPortfolio) {
    await db.insert(portfolioItems).values({ userId: b.proId, url, source: "nearest", sort: Date.now() % 1_000_000 });
  }
}

export async function saveReview(b: Booking, rating: number, body: string | null) {
  await db.insert(reviews).values({ bookingId: b.id, studentId: b.studentId, proId: b.proId, rating, body }).onConflictDoNothing();
}

export async function finishAndRelease(b: Booking) {
  return releasePayment(b.id, b.studentId);
}

// ---------- Report a problem ----------
export const REASONS = [
  "Professional isn't here",
  "Professional says they can't perform my appointment",
  "Professional cancelled after I arrived",
  "Location or access problem",
  "Professional is refusing the confirmed service",
  "Other",
];

export async function reportProblem(b: Booking, reporterId: string, reason: string, details: string | null, pos: { lat: number; lng: number; accuracyM: number } | null) {
  if (!REASONS.includes(reason)) return { error: "Choose what happened." };
  const s = await getSettings();
  const radius = Number(s["appt.checkin_radius_ft"]);
  let dist: number | null = null;
  const acc = pos ? Math.round(pos.accuracyM * 3.281) : null;
  if (b.lat != null && b.lng != null) {
    if (!pos) return { error: "Turn on Location Services — problems must be reported from the appointment location." };
    dist = distanceFt({ lat: b.lat, lng: b.lng }, pos);
    if (!withinRadius(dist, acc!, radius)) return { error: `On-site verification required. You look about ${dist.toLocaleString()} ft away; submit this from the appointment location.` };
  }
  await db.insert(incidents).values({ bookingId: b.id, reporterId, reason, details, lat: pos?.lat ?? null, lng: pos?.lng ?? null, accuracyFt: acc, distanceFt: dist });
  return { ok: "Reported. Nearest will review it — your payment stays protected meanwhile." };
}
