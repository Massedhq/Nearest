import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

/**
 * Locations for the public site — only cities with at least one professional students can book right now
 * (same rule as student search, liveProWhere). Nothing about individual professionals is exposed: just the city,
 * its market and which service categories are listed there.
 */
export type ActiveCity = { id: number; name: string; state: string; stateSlug: string; slug: string; county: string | null; market: string | null; categories: string[] };

export const STATE_NAMES: Record<string, string> = { TX: "Texas", NM: "New Mexico", OK: "Oklahoma", LA: "Louisiana", AR: "Arkansas" };
export const citySlug = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const stateSlug = (st: string) => (STATE_NAMES[st] ?? st).toLowerCase().replace(/\s+/g, "-");

/** Markets announced but not live. Shown as "planned" only — never as bookable. Owner-confirmed date. */
export const PLANNED_MARKETS = [{ state: "New Mexico", when: "January 2027" }];

export async function activeCities(): Promise<ActiveCity[]> {
  try {
    const { db, professionalProfiles, proServices, cities, categories, cityCounties, counties } = await import("@/db");
    const { liveProWhere } = await import("@/lib/search");
    const live = await db.select({ cityId: professionalProfiles.cityId, userId: professionalProfiles.userId }).from(professionalProfiles).where(and(...liveProWhere(null, "place")));
    const ids = [...new Set(live.map((l) => l.cityId).filter((x): x is number => x != null))];
    if (!ids.length) return [];
    const users = live.map((l) => l.userId);
    const [rows, cats] = await Promise.all([
      db.select({ id: cities.id, name: cities.name, state: cities.state, county: counties.name, market: counties.market }).from(cities)
        .leftJoin(cityCounties, eq(cityCounties.cityId, cities.id)).leftJoin(counties, eq(counties.id, cityCounties.countyId))
        .where(and(inArray(cities.id, ids), eq(cities.active, true))).orderBy(asc(cities.name)),
      db.selectDistinct({ cityId: professionalProfiles.cityId, name: categories.name }).from(proServices)
        .innerJoin(professionalProfiles, eq(professionalProfiles.userId, proServices.userId))
        .innerJoin(categories, eq(categories.id, proServices.categoryId))
        .where(and(eq(proServices.active, true), inArray(proServices.userId, users), sql`${categories.name} <> 'Other'`)),
    ]);
    const seen = new Set<number>();
    return rows.filter((r) => !seen.has(r.id) && seen.add(r.id)).map((r) => ({
      id: r.id, name: r.name, state: r.state, stateSlug: stateSlug(r.state), slug: citySlug(r.name), county: r.county, market: r.market,
      categories: [...new Set(cats.filter((c) => c.cityId === r.id).map((c) => c.name))].sort(),
    }));
  } catch (e) {
    console.warn("public locations unavailable —", (e as Error).message?.split("\n")[0]);
    return [];
  }
}

/** For a city page: each active category and whether professionals can still join there (First In / open / full). */
export async function cityOpenings(cityId: number) {
  try {
    const { db, categories } = await import("@/db");
    const { slotCount, slotLimits } = await import("@/lib/slots");
    const [{ firstIn, cap }, cats] = await Promise.all([slotLimits(), db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort))]);
    const out: { name: string; status: "first_in" | "open" | "full" }[] = [];
    for (const c of cats) {
      if (c.name === "Other") continue;
      const n = await slotCount(cityId, c.id);
      out.push({ name: c.name, status: n < firstIn ? "first_in" : n < cap ? "open" : "full" });
    }
    return out;
  } catch (e) { console.error("city openings", e); return []; }
}
