import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, professionalProfiles, categories, cities, proWaitlist } from "@/db";
import { getSettings } from "./settings";
import { isOwnerBusiness, isManagedEntry } from "./entry";

type Profile = typeof professionalProfiles.$inferSelect;

/**
 * Spots per city, per category:
 *   spots 1–5  (growth.target_per_category) → First In, $11
 *   spots 6–10 (growth.cap_per_category)    → next entry ($16 with a student, or $21)
 *   after 10                                → full: waitlist
 * Owners, Ambassador / pay-from-bookings accounts, and anyone joining with an invitation code are exempt.
 */
export async function slotLimits() {
  const s = await getSettings();
  const firstIn = Math.max(0, Number(s["growth.target_per_category"] ?? 5));
  const cap = Math.max(firstIn, Number(s["growth.cap_per_category"] ?? 10));
  return { firstIn, cap };
}

export async function isCapExempt(p: Profile) {
  return Boolean(p.invitationId) || isManagedEntry(p.entryType) || (await isOwnerBusiness(p.userId));
}

/**
 * Professionals holding a spot in this city + category: everyone who has joined (paid, Nearest-managed, owner)
 * or is mid-payment right now, counted by the slot they joined under OR by their actual city and services.
 */
export async function slotCount(cityId: number, categoryId: number, excludeUserId?: string) {
  const r = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from ${professionalProfiles} p
    where (${excludeUserId ?? null}::uuid is null or p.user_id <> ${excludeUserId ?? null}::uuid)
      and (p.entry_paid_at is not null or p.subscription_status in ('active','trialing','past_due') or p.entry_hold_until > now()
           or exists (select 1 from admin_members a where a.user_id = p.user_id and a.role = 'OWNER' and a.active))
      and ((p.slot_city_id = ${cityId} and p.slot_category_id = ${categoryId})
           or (p.city_id = ${cityId} and exists (select 1 from pro_services s where s.user_id = p.user_id and s.active and s.category_id = ${categoryId})))`);
  return r.rows[0]?.n ?? 0;
}

export type SlotTier = "first_in" | "next" | "full";

/** Where this pro's city + category stands right now. */
export async function slotStatus(p: Profile) {
  if (!p.slotCityId || !p.slotCategoryId) return null;
  const [{ firstIn, cap }, city, cat, taken] = await Promise.all([
    slotLimits(),
    db.query.cities.findFirst({ where: eq(cities.id, p.slotCityId) }),
    db.query.categories.findFirst({ where: eq(categories.id, p.slotCategoryId) }),
    slotCount(p.slotCityId, p.slotCategoryId, p.userId),
  ]);
  const tier: SlotTier = taken < firstIn ? "first_in" : taken < cap ? "next" : "full";
  return { cityId: p.slotCityId, categoryId: p.slotCategoryId, city: city?.name ?? "your city", category: cat?.name ?? "this category", taken, firstIn, cap, tier, spotNumber: taken + 1 };
}

/**
 * Would this pro go over the limit by offering `categoryId` in `cityId`? (Used when they change services or city
 * during setup, so nobody joins as one thing and switches into a full category.) Categories they already
 * offer in that city are never blocked.
 */
export async function wouldOverfill(p: Profile, cityId: number | null, categoryIds: number[]) {
  if (!cityId || (await isCapExempt(p))) return null;
  const { cap } = await slotLimits();
  const mine = new Set(
    (await db.execute<{ c: number }>(sql`select distinct category_id as c from pro_services where user_id = ${p.userId} and active`)).rows.map((r) => r.c),
  );
  if (p.cityId === cityId) { /* existing categories in their current city are theirs */ } else mine.clear();
  if (p.slotCityId === cityId && p.slotCategoryId) mine.add(p.slotCategoryId);
  for (const c of [...new Set(categoryIds)]) {
    if (mine.has(c)) continue;
    if ((await slotCount(cityId, c, p.userId)) >= cap) {
      const [cat, city] = await Promise.all([db.query.categories.findFirst({ where: eq(categories.id, c) }), db.query.cities.findFirst({ where: eq(cities.id, cityId) })]);
      return `${cat?.name ?? "That category"} in ${city?.name ?? "this city"} is full right now (${cap} professionals). Remove those services, or join the waitlist from the Join page.`;
    }
  }
  return null;
}

export async function joinWaitlist(userId: string, cityId: number, categoryId: number) {
  await db.insert(proWaitlist).values({ userId, cityId, categoryId }).onConflictDoNothing();
}

export async function onWaitlist(userId: string, cityId: number, categoryId: number) {
  return Boolean(await db.query.proWaitlist.findFirst({ where: and(eq(proWaitlist.userId, userId), eq(proWaitlist.cityId, cityId), eq(proWaitlist.categoryId, categoryId)) }));
}
