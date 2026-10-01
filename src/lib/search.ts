import "server-only";
import { and, asc, desc, eq, gt, inArray, sql, type SQL } from "drizzle-orm";
import { db, catalogServices, professionalProfiles, proServices, proOpenings, portfolioItems, cities, modelCalls, reviews, fines, favorites } from "@/db";
import { chicagoNow } from "./time";

export type Filters = { q?: string; cat?: string; svc?: string; loc?: string; today?: string; after?: string; under?: string; asl?: string; area?: string; sort?: string };
export type Area = { cityId: number; countyId: number | null; market?: string | null } | null;

/** Only approved, searchable, not-on-vacation pros are ever returned to students. */
export function liveProWhere(area: Area, areaMode: string | undefined) {
  const w: SQL[] = [
    eq(professionalProfiles.reviewStatus, "approved"),
    eq(professionalProfiles.searchable, true),
    eq(professionalProfiles.vacationMode, false),
    // Live when membership is trialing/active and ID is verified. Payouts can come later — Nearest holds their money until then.
    sql`(${professionalProfiles.subscriptionStatus} in ('trialing', 'active') or exists (select 1 from admin_members a where a.user_id = ${professionalProfiles.userId} and a.role = 'OWNER' and a.active))`, // owners never pay
    eq(professionalProfiles.identityStatus, "verified"),
    // Not paused by Nearest, not suspended, and no fine past its due date.
    sql`${professionalProfiles.listingPausedAt} is null`,
    sql`${professionalProfiles.membershipPausedAt} is null`, // membership billing paused → not bookable
    sql`(${professionalProfiles.suspendedUntil} is null or ${professionalProfiles.suspendedUntil} < now())`,
    sql`not exists (select 1 from ${fines} f where f.pro_id = ${professionalProfiles.userId} and f.status = 'outstanding' and f.due_at < now())`,
  ];
  if (areaMode === "place") return w; // another city or ZIP — searchPros() applies the place filter
  if (area && areaMode === "city") w.push(eq(professionalProfiles.cityId, area.cityId));
  else if (area?.countyId && areaMode !== "all") w.push(eq(professionalProfiles.countyId, area.countyId));
  // "All" means everywhere in the student's own market (All DFW, All Austin…) — never another metro.
  else if (area?.market && areaMode === "all") w.push(sql`${professionalProfiles.countyId} in (select id from counties where market = ${area.market})`);
  return w;
}

/** Radius for a ZIP search, in miles. */
export const ZIP_RADIUS_MI = 25;

export type Place =
  | { kind: "zip"; label: string; lat: number; lng: number }
  | { kind: "city"; label: string; cityIds: number[] }
  | { kind: "none"; label: string };

const zipCache = new Map<string, { lat: number; lng: number; city: string } | null>();

/** "Another city or ZIP": a 5-digit ZIP becomes a point (pros within ZIP_RADIUS_MI); anything else is a city name. */
export async function resolvePlace(loc: string | undefined): Promise<Place | null> {
  const text = loc?.trim().slice(0, 60);
  if (!text) return null;
  if (/^\d{5}$/.test(text)) {
    if (!zipCache.has(text)) {
      const { lookupZip } = await import("./places");
      const z = await lookupZip(text);
      zipCache.set(text, "error" in z ? null : { lat: z.lat, lng: z.lng, city: z.city });
    }
    const z = zipCache.get(text);
    return z ? { kind: "zip", label: `${text} (${z.city})`, lat: z.lat, lng: z.lng } : { kind: "none", label: text };
  }
  const name = text.split(",")[0].trim();
  const found = await db.select({ id: cities.id, name: cities.name }).from(cities).where(sql`lower(${cities.name}) = lower(${name})`);
  return found.length ? { kind: "city", label: found[0].name, cityIds: found.map((c) => c.id) } : { kind: "none", label: name };
}

const milesFrom = (lat: number, lng: number) =>
  sql`(3958.8 * 2 * asin(sqrt(power(sin(radians(${professionalProfiles.lat} - ${lat}) / 2), 2) + cos(radians(${lat})) * cos(radians(${professionalProfiles.lat})) * power(sin(radians(${professionalProfiles.lng} - ${lng}) / 2), 2))))`;

export async function searchPros(f: Filters, area: Area, place?: Place | null) {
  const today = chicagoNow().date;
  const where = liveProWhere(area, f.area);
  if (f.area === "place" && place) {
    if (place.kind === "zip") where.push(sql`${professionalProfiles.lat} is not null and ${professionalProfiles.lng} is not null`, sql`${milesFrom(place.lat, place.lng)} <= ${ZIP_RADIUS_MI}`);
    else if (place.kind === "city") where.push(inArray(professionalProfiles.cityId, place.cityIds));
    else where.push(sql`false`); // unknown city or ZIP: show nothing, the page explains
  }
  const q = f.q?.trim().slice(0, 60);
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    where.push(sql`(${professionalProfiles.businessName} ilike ${like} or exists (select 1 from ${proServices} s where s.user_id = ${professionalProfiles.userId} and s.active and s.price_cents <= 15000 and s.name ilike ${like}))`);
  }
  if (f.cat && /^\d+$/.test(f.cat)) where.push(sql`exists (select 1 from ${proServices} s where s.user_id = ${professionalProfiles.userId} and s.active and s.price_cents <= 15000 and s.category_id = ${Number(f.cat)})`);
  if (f.cat && /^\d+$/.test(f.cat) && f.svc && /^\d+$/.test(f.svc)) {
    // Second dropdown: a suggested service inside the category. Matches pros whose service name contains it.
    const [c] = await db.select({ name: catalogServices.name }).from(catalogServices).where(and(eq(catalogServices.id, Number(f.svc)), eq(catalogServices.categoryId, Number(f.cat))));
    if (c) {
      // Pros word their services their own way ("Classic Full Set" for "Classic Set"), so match the key words.
      const FILLER = new Set(["full", "set", "and", "&", "the", "a"]);
      const words = c.name.toLowerCase().replace(/[%_]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !FILLER.has(w));
      const terms = (words.length ? words : [c.name.toLowerCase()]).map((w) => sql`s.name ilike ${`%${w}%`}`);
      where.push(sql`exists (select 1 from ${proServices} s where s.user_id = ${professionalProfiles.userId} and s.active and s.price_cents <= 15000 and s.category_id = ${Number(f.cat)} and ${sql.join(terms, sql` and `)})`);
    }
  }
  if (f.today) where.push(sql`exists (select 1 from ${proOpenings} o where o.user_id = ${professionalProfiles.userId} and o.day = ${today})`);
  if (f.after) where.push(eq(professionalProfiles.acceptsAfterSchool, true));
  if (f.under) where.push(sql`exists (select 1 from ${proServices} s where s.user_id = ${professionalProfiles.userId} and s.active and s.price_cents <= 15000 and s.price_cents <= 2500)`);
  if (f.asl) where.push(sql`${professionalProfiles.aslLevel} <> 'none'`);

  const rows = await db
    .select({
      userId: professionalProfiles.userId,
      businessName: professionalProfiles.businessName,
      photoUrl: professionalProfiles.photoUrl,
      aslLevel: professionalProfiles.aslLevel,
      serviceMode: professionalProfiles.serviceMode,
      lat: professionalProfiles.lat,
      lng: professionalProfiles.lng,
      city: cities.name,
      minPrice: sql<number | null>`(select min(price_cents) from ${proServices} s where s.user_id = ${professionalProfiles.userId} and s.active and s.price_cents <= 15000)`,
      firstService: sql<string | null>`(select name from ${proServices} s where s.user_id = ${professionalProfiles.userId} and s.active and s.price_cents <= 15000 order by s.sort limit 1)`,
      favCount: sql<number>`(select count(*)::int from ${favorites} fv where fv.pro_id = ${professionalProfiles.userId})`,
      rating: sql<number | null>`(select round(avg(r.rating)::numeric, 1)::float from ${reviews} r where r.pro_id = ${professionalProfiles.userId} and not r.hidden)`,
      reviewCount: sql<number>`(select count(*)::int from ${reviews} r where r.pro_id = ${professionalProfiles.userId} and not r.hidden)`,
      openings: sql<string[] | null>`(select array_agg(o.start_time order by o.start_time) from ${proOpenings} o where o.user_id = ${professionalProfiles.userId} and o.day = ${today})`,
    })
    .from(professionalProfiles)
    .leftJoin(cities, eq(cities.id, professionalProfiles.cityId))
    .where(and(...where))
    .orderBy(sql`(select count(*) from ${proOpenings} o where o.user_id = ${professionalProfiles.userId} and o.day = ${today}) desc`, desc(professionalProfiles.approvedAt))
    .limit(50);

  const photos = rows.length
    ? await db
        .select({ userId: portfolioItems.userId, url: portfolioItems.url })
        .from(portfolioItems)
        .where(and(inArray(portfolioItems.userId, rows.map((r) => r.userId)), eq(portfolioItems.kind, "image")))
        .orderBy(desc(portfolioItems.featured), asc(portfolioItems.sort))
    : [];
  return rows.map((r) => ({ ...r, photos: photos.filter((p) => p.userId === r.userId).slice(0, 3).map((p) => p.url) }));
}

/** How many Model Calls are open right now — "all" = every area the student can see (owners: everywhere). */
export async function countOpenModelCalls(area: Area) {
  const where = [...liveProWhere(area, "all"), sql`${modelCalls.priceCents} <= 15000`, eq(modelCalls.status, "open"), gt(modelCalls.startsAt, new Date()), sql`${modelCalls.spotsTaken} < ${modelCalls.spots}`];
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(modelCalls)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, modelCalls.userId))
    .where(and(...where));
  return r?.n ?? 0;
}

export async function openModelCalls(area: Area, areaMode: string | undefined, userId?: string) {
  const where = [...liveProWhere(area, areaMode), sql`${modelCalls.priceCents} <= 15000`, inArray(modelCalls.status, ["open"]), gt(modelCalls.startsAt, new Date()), sql`${modelCalls.spotsTaken} < ${modelCalls.spots}`];
  if (userId) where.push(eq(modelCalls.userId, userId));
  return db
    .select({ call: modelCalls, businessName: professionalProfiles.businessName, photoUrl: professionalProfiles.photoUrl, city: cities.name })
    .from(modelCalls)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, modelCalls.userId))
    .leftJoin(cities, eq(cities.id, professionalProfiles.cityId))
    .where(and(...where))
    .orderBy(asc(modelCalls.startsAt))
    .limit(50);
}
