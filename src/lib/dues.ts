import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, membershipDues, professionalProfiles } from "@/db";
import { chicagoNow } from "./time";

type Pro = typeof professionalProfiles.$inferSelect;

/** Chicago month key, e.g. "2026-10". */
export const duesMonth = () => chicagoNow().date.slice(0, 7);

export const isBookingPaid = (p: Pick<Pro, "entryType"> | null | undefined) => p?.entryType === "BOOKING_PAID";

/** What's been collected this month and what's left, for a pay-from-bookings professional. */
export async function duesStatus(p: Pro) {
  const rate = p.monthlyRateCents ?? 1500;
  const [row] = await db.select({ n: sql<number>`coalesce(sum(${membershipDues.amountCents}), 0)::int` }).from(membershipDues)
    .where(and(eq(membershipDues.proId, p.userId), eq(membershipDues.month, duesMonth())));
  return { rate, collected: Math.min(row.n, rate), left: Math.max(0, rate - row.n) };
}

/**
 * Before money from a booking goes to a pay-from-bookings professional, Nearest keeps whatever is still
 * owed for this month's membership (never more than the payout, never more than the monthly rate).
 * Returns the amount kept. Safe to call twice for the same booking — it only ever collects once.
 * A month with no bookings costs nothing; nothing carries over.
 */
export async function collectDues(p: Pro | null | undefined, bookingId: string, payoutCents: number): Promise<number> {
  if (!p || !isBookingPaid(p) || payoutCents <= 0) return 0;
  const earlier = await db.query.membershipDues.findFirst({ where: eq(membershipDues.bookingId, bookingId) });
  if (earlier) return earlier.amountCents;
  const { left } = await duesStatus(p);
  const take = Math.min(left, payoutCents);
  if (take <= 0) return 0;
  const [row] = await db.insert(membershipDues).values({ proId: p.userId, month: duesMonth(), bookingId, amountCents: take }).onConflictDoNothing().returning();
  if (row) return row.amountCents;
  const again = await db.query.membershipDues.findFirst({ where: eq(membershipDues.bookingId, bookingId) });
  return again?.amountCents ?? 0;
}
