import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db, categories, cities, cityCounties, counties } from "@/db";
import { slotLimits } from "./slots";

/**
 * Where to recruit in DFW: every DFW city × every service category, with how many professional spots are taken
 * against Nearest's spots per city and category (Rules & Settings → Growth: spots per category per city, then waitlist).
 * A city is Filled when every category has reached that number — recruiting there would only add to the waitlist.
 * Counts use the same rule as the spot limits (slotCount): joined professionals by their spot city/category or by
 * their city + an active service in the category. No prospect or recruiting data is included.
 */
export type CityTarget = {
  id: number; name: string; counties: string[];
  cats: { id: number; name: string; taken: number; open: number }[];
  filledCats: number; openSpots: number; status: "filled" | "started" | "open";
};

export async function dfwTargets() {
  const [{ cap }, cats, rows, counts] = await Promise.all([
    slotLimits(),
    db.select({ id: categories.id, name: categories.name }).from(categories).where(and(eq(categories.active, true), ne(categories.name, "Other"))).orderBy(asc(categories.sort), asc(categories.name)),
    db.select({ id: cities.id, name: cities.name, county: counties.name }).from(cities)
      .innerJoin(cityCounties, eq(cityCounties.cityId, cities.id)).innerJoin(counties, eq(counties.id, cityCounties.countyId))
      .where(and(eq(counties.market, "DFW"), eq(counties.state, "TX"), eq(cities.state, "TX"), eq(cities.active, true))).orderBy(asc(cities.name), asc(counties.name)),
    db.execute<{ city_id: number; category_id: number; n: number }>(sql`
      with joined as (
        select p.user_id, p.slot_city_id, p.slot_category_id, p.city_id from professional_profiles p
        where p.placement_released_at is null
          and (p.entry_paid_at is not null or p.subscription_status in ('active','trialing','past_due') or p.entry_hold_until > now()
               or exists (select 1 from admin_members a where a.user_id = p.user_id and a.role = 'OWNER' and a.active))
      ), pairs as (
        select user_id, slot_city_id as city_id, slot_category_id as category_id from joined where slot_city_id is not null and slot_category_id is not null
        union
        select j.user_id, j.city_id, s.category_id from joined j join pro_services s on s.user_id = j.user_id and s.active where j.city_id is not null
      )
      select city_id, category_id, count(distinct user_id)::int as n from pairs group by city_id, category_id`),
  ]);
  const taken = new Map(counts.rows.map((r) => [`${r.city_id}:${r.category_id}`, r.n]));
  const byCity = new Map<number, { id: number; name: string; counties: string[] }>();
  for (const r of rows) {
    const c = byCity.get(r.id) ?? { id: r.id, name: r.name, counties: [] };
    if (!c.counties.includes(r.county)) c.counties.push(r.county);
    byCity.set(r.id, c);
  }
  const list: CityTarget[] = [...byCity.values()].map((c) => {
    const cs = cats.map((k) => { const t = taken.get(`${c.id}:${k.id}`) ?? 0; return { id: k.id, name: k.name, taken: t, open: Math.max(0, cap - t) }; });
    const filledCats = cs.filter((x) => x.open === 0).length;
    const openSpots = cs.reduce((t, x) => t + x.open, 0);
    return { ...c, cats: cs, filledCats, openSpots, status: filledCats === cs.length ? "filled" : cs.some((x) => x.taken > 0) ? "started" : "open" };
  });
  const countyNames = [...new Set(rows.map((r) => r.county))].sort();
  return { cap, cats, cities: list, counties: countyNames };
}
