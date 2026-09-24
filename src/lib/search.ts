import "server-only";
import { and, asc, desc, eq, gt, inArray, sql, type SQL } from "drizzle-orm";
import { db, professionalProfiles, proServices, proOpenings, portfolioItems, cities, modelCalls } from "@/db";
import { chicagoNow } from "./time";

export type Filters = { q?: string; cat?: string; today?: string; after?: string; under?: string; asl?: string; area?: string };
export type Area = { cityId: number; countyId: number | null } | null;

/** Only approved, searchable, not-on-vacation pros are ever returned to students. */
export function liveProWhere(area: Area, areaMode: string | undefined) {
  const w: SQL[] = [
    eq(professionalProfiles.reviewStatus, "approved"),
    eq(professionalProfiles.searchable, true),
    eq(professionalProfiles.vacationMode, false),
  ];
  if (area && areaMode === "city") w.push(eq(professionalProfiles.cityId, area.cityId));
  else if (area?.countyId && areaMode !== "all") w.push(eq(professionalProfiles.countyId, area.countyId));
  return w;
}

export async function searchPros(f: Filters, area: Area) {
  const today = chicagoNow().date;
  const where = liveProWhere(area, f.area);
  const q = f.q?.trim().slice(0, 60);
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    where.push(sql`(${professionalProfiles.businessName} ilike ${like} or exists (select 1 from ${proServices} s where s.user_id = ${professionalProfiles.userId} and s.active and s.name ilike ${like}))`);
  }
  if (f.cat && /^\d+$/.test(f.cat)) where.push(sql`exists (select 1 from ${proServices} s where s.user_id = ${professionalProfiles.userId} and s.active and s.category_id = ${Number(f.cat)})`);
  if (f.today) where.push(sql`exists (select 1 from ${proOpenings} o where o.user_id = ${professionalProfiles.userId} and o.day = ${today})`);
  if (f.after) where.push(eq(professionalProfiles.acceptsAfterSchool, true));
  if (f.under) where.push(sql`exists (select 1 from ${proServices} s where s.user_id = ${professionalProfiles.userId} and s.active and s.price_cents <= 2500)`);
  if (f.asl) where.push(sql`${professionalProfiles.aslLevel} <> 'none'`);

  const rows = await db
    .select({
      userId: professionalProfiles.userId,
      businessName: professionalProfiles.businessName,
      photoUrl: professionalProfiles.photoUrl,
      aslLevel: professionalProfiles.aslLevel,
      serviceMode: professionalProfiles.serviceMode,
      city: cities.name,
      minPrice: sql<number | null>`(select min(price_cents) from ${proServices} s where s.user_id = ${professionalProfiles.userId} and s.active)`,
      firstService: sql<string | null>`(select name from ${proServices} s where s.user_id = ${professionalProfiles.userId} and s.active order by s.sort limit 1)`,
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
        .where(inArray(portfolioItems.userId, rows.map((r) => r.userId)))
        .orderBy(desc(portfolioItems.featured), asc(portfolioItems.sort))
    : [];
  return rows.map((r) => ({ ...r, photos: photos.filter((p) => p.userId === r.userId).slice(0, 3).map((p) => p.url) }));
}

export async function openModelCalls(area: Area, areaMode: string | undefined, userId?: string) {
  const where = [...liveProWhere(area, areaMode), inArray(modelCalls.status, ["open"]), gt(modelCalls.startsAt, new Date()), sql`${modelCalls.spotsTaken} < ${modelCalls.spots}`];
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
