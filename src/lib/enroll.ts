import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, proServices, professionalProfiles } from "@/db";
import { allowedEntries, ENTRY, type PaidEntryType } from "./entry";

type Profile = typeof professionalProfiles.$inferSelect;

/** The category with the most active services — the one their city spot is counted under. */
export async function mainCategory(userId: string) {
  const [row] = await db.select({ c: proServices.categoryId, n: sql<number>`count(*)::int` }).from(proServices)
    .where(and(eq(proServices.userId, userId), eq(proServices.active, true))).groupBy(proServices.categoryId).orderBy(sql`count(*) desc`).limit(1);
  return row?.c ?? null;
}

/**
 * What this professional's membership will be, from where they work and their main category — shown at the bottom of
 * the Professional Terms on the last setup step. Same rules as before: First In spots, then $17 in DFW, $20 elsewhere.
 */
export async function enrollmentQuote(p: Profile): Promise<
  | { ok: true; type: PaidEntryType; cents: number; label: string; cityId: number | null; categoryId: number | null }
  | { ok: false; reason: string }
> {
  const categoryId = p.slotCategoryId ?? (await mainCategory(p.userId));
  const cityId = p.cityId ?? p.slotCityId;
  if (!cityId || !categoryId) return { ok: false, reason: "Add your location and at least one service first." };
  const { allowed, reason } = await allowedEntries({ ...p, slotCityId: cityId, slotCategoryId: categoryId });
  if (!allowed.length) {
    return { ok: false, reason: reason === "paused" ? "New professional enrollment is paused right now — we'll let you know when it opens."
      : reason === "full" || reason === "next_full" ? "Your city is full for your main service right now. Join the waitlist and we'll tell you as soon as a spot opens."
      : "Enrollment isn't available for your area right now." };
  }
  const type = allowed[0];
  return { ok: true, type, cents: ENTRY[type].cents, label: type === "FIRST_IN" ? "First In" : type === "DFW_NEXT" ? "DFW membership" : "Market rate", cityId, categoryId };
}
