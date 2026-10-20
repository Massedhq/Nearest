import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, professionalProfiles, categories, cities, proWaitlist, slotOpenings } from "@/db";
import { getSettings } from "./settings";
import { isOwnerBusiness, isManagedEntry } from "./entry";

type Profile = typeof professionalProfiles.$inferSelect;

/**
 * Enrollment capacity — per city, per service category, the same in every state:
 *   spots 1–5   open when the category opens (growth.target_per_category = the size of one opening).
 *   then        enrollment CLOSES for that category in that city (waitlist).
 *   spots 6–10  only after an owner authorizes the one additional opening for that city + category (slot_openings).
 * Never automatic, and never more than 10 (HARD_MAX) — no setting can raise it.
 * Owners, Ambassador / pay-from-bookings accounts, and anyone joining with an invitation code are exempt.
 */
export const HARD_MAX_PER_CATEGORY = 10;

export async function slotLimits() {
  const s = await getSettings();
  const firstIn = Math.min(HARD_MAX_PER_CATEGORY, Math.max(1, Number(s["growth.target_per_category"] ?? 5)));
  const cap = Math.min(HARD_MAX_PER_CATEGORY, Math.max(firstIn, Number(s["growth.cap_per_category"] ?? 10)));
  return { firstIn, cap }; // firstIn = one opening; cap = the most a city + category can ever reach (with the second opening)
}

/** Has an owner authorized the second opening for this city + category? */
export async function secondOpening(cityId: number, categoryId: number) {
  return (await db.query.slotOpenings.findFirst({ where: and(eq(slotOpenings.cityId, cityId), eq(slotOpenings.categoryId, categoryId)) })) ?? null;
}

/** Spots currently open to enroll in this city + category: 5, or 10 once the second opening is authorized. */
export async function categoryCap(cityId: number, categoryId: number) {
  const { firstIn, cap } = await slotLimits();
  return (await secondOpening(cityId, categoryId)) ? cap : firstIn;
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
      and p.placement_released_at is null
      and (p.entry_paid_at is not null or p.subscription_status in ('active','trialing','past_due') or p.entry_hold_until > now()
           or (p.review_status = 'approved' and p.searchable) -- live on Nearest always holds a spot
           or exists (select 1 from admin_members a where a.user_id = p.user_id and a.role = 'OWNER' and a.active))
      and ((p.slot_city_id = ${cityId} and p.slot_category_id = ${categoryId})
           or (p.city_id = ${cityId} and exists (select 1 from pro_services s where s.user_id = p.user_id and s.active and s.category_id = ${categoryId})))`);
  return r.rows[0]?.n ?? 0;
}

export type SlotTier = "first_in" | "next" | "full";

/** Where this pro's city + category stands right now. */
export async function slotStatus(p: Profile) {
  if (!p.slotCityId || !p.slotCategoryId) return null;
  const [{ firstIn }, cap, city, cat, taken] = await Promise.all([
    slotLimits(),
    categoryCap(p.slotCityId, p.slotCategoryId),
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
  // Skipped the waitlist (joined the next 750): their own full city + category is theirs to list in.
  if (p.slotBypass && p.slotCityId === cityId && p.slotCategoryId) categoryIds = categoryIds.filter((c) => c !== p.slotCategoryId);
  const mine = new Set(
    (await db.execute<{ c: number }>(sql`select distinct category_id as c from pro_services where user_id = ${p.userId} and active`)).rows.map((r) => r.c),
  );
  if (p.cityId === cityId) { /* existing categories in their current city are theirs */ } else mine.clear();
  if (p.slotCityId === cityId && p.slotCategoryId) mine.add(p.slotCategoryId);
  for (const c of [...new Set(categoryIds)]) {
    if (mine.has(c)) continue;
    const cap = await categoryCap(cityId, c);
    if ((await slotCount(cityId, c, p.userId)) >= cap) {
      const [cat, city] = await Promise.all([db.query.categories.findFirst({ where: eq(categories.id, c) }), db.query.cities.findFirst({ where: eq(cities.id, cityId) })]);
      return `${cat?.name ?? "That category"} in ${city?.name ?? "this city"} is closed right now — all ${cap} spots are taken. Remove those services, or join the waitlist from the Join page.`;
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

/**
 * Owner action: authorize the one additional opening (5 more spots, 10 total) for a city + category. Only once —
 * a second call changes nothing. Professionals on that waitlist are told a spot opened.
 */
export async function authorizeSecondOpening(cityId: number, categoryId: number, actorId: string, note?: string) {
  const { firstIn, cap } = await slotLimits();
  if (cap <= firstIn) return { error: "There's no additional opening to authorize." };
  const [row] = await db.insert(slotOpenings).values({ cityId, categoryId, authorizedBy: actorId, note: note || null }).onConflictDoNothing().returning();
  if (!row) return { error: "The additional opening was already authorized for this city and category." };
  const [city, cat] = await Promise.all([db.query.cities.findFirst({ where: eq(cities.id, cityId) }), db.query.categories.findFirst({ where: eq(categories.id, categoryId) })]);
  const { logActivity } = await import("./log");
  await logActivity({ actorUserId: actorId, action: "capacity.second_opening", targetType: "city_category", targetId: `${city?.name ?? cityId} · ${cat?.name ?? categoryId}`, before: firstIn, after: cap });
  // Tell the waitlist (first come, first served — the spots aren't held for them).
  const { users } = await import("@/db");
  const waiting = await db.select({ u: users }).from(proWaitlist).innerJoin(users, eq(users.id, proWaitlist.userId)).where(and(eq(proWaitlist.cityId, cityId), eq(proWaitlist.categoryId, categoryId)));
  const base = process.env.APP_URL || "https://www.usenearest.com";
  for (const w of waiting) {
    try {
      const { inbox } = await import("./inbox");
      await inbox(w.u.id, { kind: "spot_opened", title: "Spots opened in your city", body: `${cat?.name} in ${city?.name} has new spots. First come, first served — open Join to claim one.`, href: "/pro/join" });
      if (w.u.email) await (await import("./email")).sendSpotOpenedEmail({ to: w.u.email, first: w.u.firstName ?? "Hi", city: city?.name ?? "your city", category: cat?.name ?? "your category", link: `${base}/pro/join` });
    } catch (e) { console.error("second opening notice", e); }
  }
  return { ok: true as const, notified: waiting.length };
}
