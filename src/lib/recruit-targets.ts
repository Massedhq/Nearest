import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db, categories, cities, cityCounties, counties } from "@/db";
import { slotLimits } from "./slots";

/**
 * Where to recruit in DFW: every DFW city × every service category, with how many professional spots are taken
 * against Nearest's recruiting target of professionals per category per city (Rules & Settings → Growth → growth.target_per_category, 5).
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
  const [{ firstIn: cap }, cats, rows, counts] = await Promise.all([
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

/**
 * Shown to everyone on Where to recruit (admins and Lead Contributors) so nobody recruits the same professional twice:
 * which professionals count toward each DFW city's spots, and for everyone
 * who doesn't count yet, why. Same rule as slotCount: a professional counts once they've submitted their profile
 * (or are an owner / active member), in their city, once per category they have an active service in (plus the
 * category they joined under). Only names, business names, city and categories — no contact details.
 */
export type CountedPro = { userId: string; name: string; business: string | null; cats: string[] };
export type UncountedPro = { userId: string; name: string; business: string | null; city: string | null; cats: string[]; reason: string };

export async function whoCounts() {
  const r = await db.execute<{
    user_id: string; display_name: string | null; first_name: string | null; last_name: string | null; business_name: string | null;
    city_id: number | null; city: string | null; dfw: boolean; joined: boolean; released: boolean; cats: string[] | null; planned: string[] | null;
  }>(sql`
    select p.user_id, p.display_name, u.first_name, u.last_name, p.business_name, p.city_id, c.name as city,
      exists (select 1 from city_counties cc join counties k on k.id = cc.county_id where cc.city_id = p.city_id and k.market = 'DFW') as dfw,
      (p.entry_paid_at is not null or p.subscription_status in ('active','trialing','past_due') or p.entry_hold_until > now()
        or exists (select 1 from admin_members a where a.user_id = p.user_id and a.role = 'OWNER' and a.active)) as joined,
      p.placement_released_at is not null as released,
      (select array_agg(distinct k.name order by k.name) from categories k
        where k.id in (select s.category_id from pro_services s where s.user_id = p.user_id and s.active)
           or (k.id = p.slot_category_id and p.slot_city_id = p.city_id)) as cats,
      -- what they're signing up for while still in setup: their joining category, saved services, or services saved for later
      (select array_agg(distinct k.name order by k.name) from categories k
        where k.id = p.slot_category_id
           or k.id in (select s.category_id from pro_services s where s.user_id = p.user_id)
           or k.id::text in (select d->>'categoryId' from jsonb_array_elements(case when jsonb_typeof(p.services_draft) = 'array' then p.services_draft else '[]'::jsonb end) d)) as planned
    from professional_profiles p join users u on u.id = p.user_id
    left join cities c on c.id = p.city_id
    where not exists (select 1 from users x where x.id = p.user_id and x.account_type = 'student')`);
  const counted = new Map<number, CountedPro[]>();
  const uncounted = new Map<number, UncountedPro[]>();
  const noCity: UncountedPro[] = []; // not in any DFW city yet — every professional shows up somewhere, never skipped
  const { personName } = await import("./pro-name");
  for (const x of r.rows) {
    const base = { userId: x.user_id, name: personName(x.display_name, x.first_name, x.last_name), business: x.business_name };
    const cats = x.cats ?? [], planned = x.planned ?? [];
    if (!x.city_id) { noCity.push({ ...base, city: null, cats: planned, reason: "Hasn't chosen their city yet (Location step of setup)" }); continue; }
    if (!x.dfw) { noCity.push({ ...base, city: x.city, cats: planned, reason: `Their city (${x.city}) isn't one of the DFW cities on this page` }); continue; }
    const reason = x.released ? "Their spot was released (they didn't activate after their first booking request)"
      : !x.joined ? "Hasn't submitted their profile yet — they count once they tap Submit profile on the last setup step"
      : !cats.length ? "No active services yet — they count in each category they add a service in"
      : "";
    if (reason) uncounted.set(x.city_id, [...(uncounted.get(x.city_id) ?? []), { ...base, city: x.city, cats: planned, reason }]);
    else counted.set(x.city_id, [...(counted.get(x.city_id) ?? []), { ...base, cats }]);
  }
  return { counted: Object.fromEntries(counted), uncounted: Object.fromEntries(uncounted), noCity };
}
