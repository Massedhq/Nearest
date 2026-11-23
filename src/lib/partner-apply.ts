import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, bookings, partnerApplications } from "@/db";
import { getSettings } from "./settings";
import { normEmail } from "./partners";

/**
 * Applying to be a Nearest Partner from the pro app (2026-11-22, owner): a professional can apply once they have
 * partner.apply_min_bookings (100) COMPLETED bookings on Nearest. The main owner still approves every request
 * (Admin → Partner pages → Applications); approval works through the normal partner_applications row matched by email.
 */
export async function partnerApplyStatus(userId: string, email: string | null) {
  const [s, [{ n }]] = await Promise.all([
    getSettings(),
    db.select({ n: sql<number>`count(*)::int` }).from(bookings).where(and(eq(bookings.proId, userId), eq(bookings.status, "completed"))),
  ]);
  const min = Math.max(0, Number(s["partner.apply_min_bookings"] ?? 100));
  const last = email ? (await db.select().from(partnerApplications).where(eq(partnerApplications.email, normEmail(email))).orderBy(desc(partnerApplications.createdAt)).limit(1))[0] ?? null : null;
  return { completed: n, min, eligible: n >= min, pending: last?.status === "new", declined: last?.status === "declined" ? last : null };
}
