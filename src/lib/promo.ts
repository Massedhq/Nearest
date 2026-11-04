import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, bookings, credits, nearestCards, nearestCardBatches, professionalProfiles } from "@/db";

/**
 * Promotional value on Nearest (2026-11-04, owner rule): Nearest Cards (discount and free) and promotional credit (the
 * launch campaign reward). Credit only — no cash value.
 *  - Honored by the professional: it comes out of that booking's payout (Professional Terms, version PROMO_TERMS_VERSION).
 *  - Covers the SERVICE only. The student always pays the booking fee and the deposit; travel fees aren't covered.
 *  - Usable only with professionals who accepted the Terms that include it (owners' own businesses always).
 *  - A Free Card is only for the professional's chosen free service, and each professional gives ONE free service, ever.
 * Ordinary credit (from cancellations) is the student's own money and still pays the professional normally.
 */
export const PROMO_TERMS_VERSION = "2026-11-04";

type Pro = typeof professionalProfiles.$inferSelect;

/** Does this professional honor Nearest Cards and promotional credit? */
export async function honorsPromos(p: Pro | null | undefined) {
  if (!p) return false;
  if ((p.proTermsVersion ?? "") >= PROMO_TERMS_VERSION) return true;
  return (await import("./entry")).isOwnerBusiness(p.userId);
}

/** The student's promotional credit balance (not counting Nearest Cards, which are chosen per booking). */
export async function promoBalance(studentId: string) {
  const [r] = await db.select({ n: sql<number>`coalesce(sum(${credits.amountCents}),0)::int` }).from(credits).where(and(eq(credits.studentId, studentId), eq(credits.promo, true)));
  return Math.max(0, r.n);
}

/** The most promotional value a booking can use: the service only — never the booking fee, deposit or travel fee. Model Calls: none. */
export function promoCap(b: { priceCents: number; serviceFeeCents?: number | null; depositCents?: number | null; travelFeeCents?: number | null; inviteDiscountCents?: number | null; modelCallId?: string | null }) {
  if (b.modelCallId) return 0;
  return Math.max(0, b.priceCents - (b.travelFeeCents ?? 0) - (b.serviceFeeCents ?? 0) - (b.depositCents ?? 0) - (b.inviteDiscountCents ?? 0));
}

/** Has this professional already given their one free service (a Free Card booking that was paid and not cancelled)? */
export async function freeServiceGiven(proId: string, exceptBookingId?: string) {
  const rows = await db.select({ id: bookings.id }).from(bookings)
    .innerJoin(nearestCards, eq(nearestCards.id, bookings.cardId))
    .innerJoin(nearestCardBatches, eq(nearestCardBatches.id, nearestCards.batchId))
    .where(and(eq(bookings.proId, proId), eq(nearestCardBatches.kind, "free"), inArray(bookings.status, ["confirmed", "completed"]), sql`${bookings.paidAt} is not null`,
      ...(exceptBookingId ? [sql`${bookings.id} <> ${exceptBookingId}`] : [])))
    .limit(1);
  return rows.length > 0;
}

/**
 * Why a card can't be used on this booking (null = it can). Checks the professional takes cards, and for a Free Card:
 * they agreed to a free service, this is that service, and they haven't given it yet.
 */
export async function cardProblem(cardId: string, proId: string, serviceId: string | null | undefined, opts: { modelCall?: boolean; bookingId?: string } = {}) {
  if (opts.modelCall) return "Nearest Cards can't be used on Model Calls.";
  const pro = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, proId) });
  if (!(await honorsPromos(pro))) return "This professional doesn't take Nearest Cards yet.";
  const row = (await db.select({ kind: nearestCardBatches.kind }).from(nearestCards).innerJoin(nearestCardBatches, eq(nearestCardBatches.id, nearestCards.batchId)).where(eq(nearestCards.id, cardId)).limit(1))[0];
  if (!row) return "That card isn't on your account.";
  if (row.kind !== "free") return null;
  const offer = await (await import("./campaign-pro")).proOffer(proId);
  if (pro?.campaignChoice !== "agreed" || !offer || !offer.active) return "This professional isn't offering a free service right now.";
  if (!serviceId || offer.serviceId !== serviceId) return "A Free Card works only on this professional's free service.";
  if (await freeServiceGiven(proId, opts.bookingId)) return "This professional has already given their free service.";
  return null;
}
