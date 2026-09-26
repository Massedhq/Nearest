import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, cities, counties, cityCounties } from "@/db";
import { marketName, sortMarkets } from "./markets";

export type CityGroup = { label: string; cities: { id: number; name: string }[] };

/** Active cities grouped by market (Dallas–Fort Worth, Houston, Austin…) for dropdowns. */
export async function cityGroups(): Promise<CityGroup[]> {
  const rows = await db
    .select({ id: cities.id, name: cities.name, state: cities.state, market: counties.market })
    .from(cities)
    .leftJoin(cityCounties, eq(cityCounties.cityId, cities.id))
    .leftJoin(counties, eq(counties.id, cityCounties.countyId))
    .where(eq(cities.active, true))
    .orderBy(asc(cities.name));
  const seen = new Set<number>();
  const byMarket = new Map<string, { id: number; name: string }[]>();
  for (const r of rows) {
    if (seen.has(r.id)) continue; // a city in two counties is listed once, under its first market
    seen.add(r.id);
    const m = r.market ?? "Other";
    byMarket.set(m, [...(byMarket.get(m) ?? []), { id: r.id, name: r.state !== "TX" ? `${r.name}, ${r.state}` : r.name }]);
  }
  return sortMarkets([...byMarket.keys()]).map((m) => ({ label: marketName(m), cities: byMarket.get(m)! }));
}
