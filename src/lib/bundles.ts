import "server-only";
import { and, asc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { db, bundles, bundleItems, bookings, categories, proServices, professionalProfiles, cities, reviews } from "@/db";
import { liveProWhere, type Area } from "./search";
import { openSlots } from "./availability";
import { chicagoNow } from "./time";
import { MAX_PRICE_CENTS } from "./pricing";

export const BUNDLE_DAYS = 7; // the week she needs it done
export const BUNDLE_KEEP_DAYS = 14; // unbooked bundles are cleared after this

export type Bundle = typeof bundles.$inferSelect;
export type Candidate = {
  proId: string; businessName: string; photoUrl: string | null; city: string | null; rating: number | null; reviews: number;
  serviceId: string; serviceName: string; priceCents: number; durationMin: number; firstOpenDay: string | null;
};

/** The days in a bundle's week that can still be booked (never before tomorrow). */
export function bundleDays(b: Pick<Bundle, "startDate" | "endDate">) {
  const tomorrow = new Date(`${chicagoNow().date}T12:00:00Z`).getTime() + 86400000;
  const out: string[] = [];
  for (let t = new Date(`${b.startDate}T12:00:00Z`).getTime(); t <= new Date(`${b.endDate}T12:00:00Z`).getTime(); t += 86400000) {
    if (t >= tomorrow) out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Bundles that were never booked are cleared after 14 days (the row stays as "expired" so usage can be counted). */
export async function expireBundles() {
  const old = await db.select({ id: bundles.id }).from(bundles).where(and(inArray(bundles.status, ["building", "ready"]), lt(bundles.expiresAt, new Date())));
  if (!old.length) return 0;
  const ids = old.map((o) => o.id);
  await db.delete(bundleItems).where(and(inArray(bundleItems.bundleId, ids), sql`${bundleItems.bookingId} is null`));
  await db.update(bundles).set({ status: "expired" }).where(inArray(bundles.id, ids));
  return ids.length;
}

/** Live professionals in the student's area offering this category — each with their lowest-priced service in it. */
export async function categoryCandidates(area: Area, categoryId: number, adult: boolean): Promise<Omit<Candidate, "firstOpenDay">[]> {
  const rows = await db
    .select({
      proId: professionalProfiles.userId, businessName: professionalProfiles.businessName, photoUrl: professionalProfiles.photoUrl, city: cities.name,
      serviceId: proServices.id, serviceName: proServices.name, priceCents: proServices.priceCents, durationMin: proServices.durationMin,
      rating: sql<number | null>`(select avg(${reviews.rating})::float from ${reviews} where ${reviews.proId} = ${professionalProfiles.userId} and not ${reviews.hidden})`,
      reviews: sql<number>`(select count(*)::int from ${reviews} where ${reviews.proId} = ${professionalProfiles.userId} and not ${reviews.hidden})`,
    })
    .from(proServices)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, proServices.userId))
    .leftJoin(cities, eq(cities.id, professionalProfiles.cityId))
    .where(and(
      eq(proServices.categoryId, categoryId), eq(proServices.active, true), sql`${proServices.priceCents} <= ${MAX_PRICE_CENTS}`,
      ...(adult ? [] : [eq(proServices.adultsOnly, false)]),
      ...liveProWhere(area, undefined),
    ))
    .orderBy(asc(proServices.priceCents));
  // One row per professional: their lowest price in this category.
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.proId) ? false : (seen.add(r.proId), true))).map((r) => ({ ...r, businessName: r.businessName ?? "Professional" }));
}

/** First day in the bundle's week this professional has an opening for the service, or null. */
export async function firstOpenDay(proId: string, durationMin: number, days: string[]) {
  for (const d of days) if ((await openSlots(proId, durationMin, d)).length) return d;
  return null;
}

/**
 * How much of the budget this category can use right now: the budget, minus what's already saved,
 * minus the lowest price available in every other category still to fill (so one pick can't use up everything).
 */
export function categoryCap(budgetCents: number, categoryId: number, saved: { categoryId: number; priceCents: number }[], minByCategory: Map<number, number>, categoryIds: number[]) {
  const savedOther = saved.filter((s) => s.categoryId !== categoryId).reduce((t, s) => t + s.priceCents, 0);
  const savedCats = new Set(saved.map((s) => s.categoryId));
  const reserve = categoryIds.filter((c) => c !== categoryId && !savedCats.has(c)).reduce((t, c) => t + (minByCategory.get(c) ?? 0), 0);
  return budgetCents - savedOther - reserve;
}

export async function loadBundle(id: string, studentId: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const b = await db.query.bundles.findFirst({ where: and(eq(bundles.id, id), eq(bundles.studentId, studentId)) });
  if (!b) return null;
  const items = await db.select({ item: bundleItems, booking: bookings }).from(bundleItems).leftJoin(bookings, eq(bookings.id, bundleItems.bookingId)).where(eq(bundleItems.bundleId, b.id));
  const cats = await db.select({ id: categories.id, name: categories.name }).from(categories).where(inArray(categories.id, b.categoryIds));
  const order = b.categoryIds.map((cid) => cats.find((c) => c.id === cid)).filter(Boolean) as { id: number; name: string }[];
  return { bundle: b, items, cats: order };
}

/** A saved pro counts as booked only while their booking is active. */
export const isBooked = (bk: typeof bookings.$inferSelect | null) => Boolean(bk && ["pending_payment", "confirmed", "completed"].includes(bk.status));

/** After a bundle booking is confirmed: link it, tell the pro, and mark the bundle booked when every pro is booked. */
export async function onBundleBookingConfirmed(b: typeof bookings.$inferSelect) {
  if (!b.bundleId) return;
  const bundle = await db.query.bundles.findFirst({ where: eq(bundles.id, b.bundleId) });
  if (!bundle) return;
  await db.update(bundleItems).set({ bookingId: b.id }).where(and(eq(bundleItems.bundleId, bundle.id), eq(bundleItems.proId, b.proId)));
  try {
    const { inbox } = await import("./inbox");
    await inbox(b.proId, { kind: "bundle", title: "Part of a Bundle Me booking", body: `${b.serviceName} was booked as part of a student's Bundle Me booking — several services for the same week.`, href: `/pro/appointments/${b.id}` });
  } catch (e) { console.error(e); }
  const items = await db.select({ booking: bookings }).from(bundleItems).leftJoin(bookings, eq(bookings.id, bundleItems.bookingId)).where(eq(bundleItems.bundleId, bundle.id));
  if (items.length === bundle.categoryIds.length && items.every((i) => i.booking && ["confirmed", "completed"].includes(i.booking.status))) {
    await db.update(bundles).set({ status: "booked", completedAt: new Date() }).where(and(eq(bundles.id, bundle.id), ne(bundles.status, "booked")));
  }
}

/** A saved bundle pro the student is booking now: checks ownership, the service, and that the bundle is still active. */
export async function bundleItemFor(itemId: string, studentId: string, serviceId: string) {
  if (!/^[0-9a-f-]{36}$/.test(itemId)) return null;
  const [row] = await db.select({ item: bundleItems, bundle: bundles }).from(bundleItems).innerJoin(bundles, eq(bundles.id, bundleItems.bundleId))
    .where(and(eq(bundleItems.id, itemId), eq(bundles.studentId, studentId), eq(bundleItems.serviceId, serviceId)));
  if (!row || !["ready", "building", "booked"].includes(row.bundle.status)) return null;
  return { item: row.item, bundle: row.bundle, days: bundleDays(row.bundle) };
}
