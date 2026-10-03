import "server-only";
import { and, eq } from "drizzle-orm";
import { db, counties, cities, cityCounties } from "@/db";
import { TEXAS_COUNTIES } from "@/db/texas-counties";
import { US_STATES } from "./markets";

const stateName = (st: string) => US_STATES.find(([a]) => a === st)?.[1] ?? st;
const clean = (s: string) => s.trim().replace(/\s+/g, " ");

/** Finds a county by state + name, or adds it. New Texas counties get their listed market; others "Other <State>". */
export async function findOrCreateCounty(state: string, name: string) {
  const n = clean(name).replace(/\s+(County|Parish|Borough|Census Area|Municipality)$/i, "");
  const existing = await db.query.counties.findFirst({ where: and(eq(counties.state, state), eq(counties.name, n)) });
  if (existing) return existing;
  const market = state === "TX" ? TEXAS_COUNTIES.find((c) => c.name.toLowerCase() === n.toLowerCase())?.market ?? "Other Texas" : `Other ${stateName(state)}`;
  const [row] = await db.insert(counties).values({ name: n, state, market }).returning();
  return row;
}

/** A unique 3-letter city code (used in invitation codes like FND-FRS-0001), unique across every state. */
async function newAbbreviation(name: string) {
  const used = new Set((await db.select({ a: cities.abbreviation }).from(cities)).map((r) => r.a));
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "") || "CTY";
  let abbr = (letters[0] + (letters.slice(1).replace(/[AEIOU]/g, "") + letters.slice(1)).slice(0, 2)).padEnd(3, "X");
  for (let i = 0; used.has(abbr); i++) abbr = letters.slice(0, 2).padEnd(2, "X") + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26)) : "");
  return abbr;
}

/** Finds a city by state + name, or adds it; always links it to the given county. */
export async function findOrCreateCity(state: string, name: string, countyId: number) {
  const n = clean(name);
  let city = await db.query.cities.findFirst({ where: and(eq(cities.state, state), eq(cities.name, n)) });
  let created = false;
  if (!city) {
    [city] = await db.insert(cities).values({ name: n, state, abbreviation: await newAbbreviation(n) }).returning();
    created = true;
  }
  await db.insert(cityCounties).values({ cityId: city.id, countyId }).onConflictDoNothing();
  return { city, created };
}

export type ZipResult = { zip: string; state: string; city: string; county: string | null; lat: number; lng: number };

/**
 * ZIP → city, state and county, using two free public services (no keys):
 * Zippopotam (ZIP → place, state, coordinates) and the FCC census area API (coordinates → county).
 */
export async function lookupZip(zip: string): Promise<ZipResult | { error: string }> {
  if (!/^\d{5}$/.test(zip)) return { error: "Enter a 5-digit ZIP code." };
  try {
    const z = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!z.ok) return { error: "We couldn't find that ZIP code." };
    const zd = (await z.json()) as { places?: { "place name": string; "state abbreviation": string; latitude: string; longitude: string }[] };
    const p = zd.places?.[0];
    if (!p) return { error: "We couldn't find that ZIP code." };
    const lat = Number(p.latitude), lng = Number(p.longitude);
    const state = p["state abbreviation"], city = p["place name"];
    const clean = (n: string | null | undefined) => n?.replace(/\s+(County|Parish|Borough|Census Area|Municipality)$/i, "").trim() || null;
    // 1) A city Nearest already knows (with its county) — no outside service needed.
    let county: string | null = await knownCounty(city, state);
    // 2) FCC area lookup.
    if (!county) {
      try {
        const f = await fetch(`https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lng}&format=json`, { signal: AbortSignal.timeout(6000), cache: "no-store" });
        if (f.ok) county = clean(((await f.json()) as { results?: { county_name?: string }[] }).results?.[0]?.county_name);
      } catch { /* try the next source */ }
    }
    // 3) U.S. Census Bureau geocoder.
    if (!county) {
      try {
        const c = await fetch(`https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties&format=json`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
        if (c.ok) {
          const cd = (await c.json()) as { result?: { geographies?: { Counties?: { BASENAME?: string; NAME?: string }[] } } };
          const k = cd.result?.geographies?.Counties?.[0];
          county = clean(k?.BASENAME ?? k?.NAME);
        }
      } catch { /* county stays blank */ }
    }
    return { zip, state, city, county, lat, lng };
  } catch {
    return { error: "The ZIP lookup service didn't respond. Try again, or type the city and county yourself." };
  }
}

/** The county of a city Nearest already has (by name + state), if any. */
async function knownCounty(cityName: string, state: string): Promise<string | null> {
  try {
    const { db, cities, cityCounties, counties } = await import("@/db");
    const { and, eq, sql } = await import("drizzle-orm");
    const [row] = await db.select({ name: counties.name }).from(cities)
      .innerJoin(cityCounties, eq(cityCounties.cityId, cities.id)).innerJoin(counties, eq(counties.id, cityCounties.countyId))
      .where(and(sql`lower(${cities.name}) = lower(${cityName})`, eq(cities.state, state))).limit(1);
    return row?.name ?? null;
  } catch {
    return null;
  }
}
