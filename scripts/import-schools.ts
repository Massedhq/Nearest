// Loads U.S. schools into Nearest from official Department of Education directories
// (via the Urban Institute Education Data API — free, no key) with county names from the U.S. Census.
//
//   npm run schools:import -- --state TX          Texas only (fast, good first run)
//   npm run schools:import                        every state
//   add --dry-run to preview without saving
//
// Safe to run again: schools already in Nearest (same name + city) are skipped, nothing is deleted,
// and counties keep whatever market you've set.
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";
import { TEXAS_COUNTIES } from "../src/db/texas-counties";
import { US_STATES } from "../src/lib/markets";
import US_COUNTIES from "../src/db/us-counties.json";

const db = drizzle({ client: neon(process.env.DATABASE_URL!), schema });
const { counties, cities, cityCounties, schools } = schema;

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const ONLY = (() => { const i = args.indexOf("--state"); return i >= 0 ? args[i + 1]?.toUpperCase() : null; })();

const FIPS: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
  "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY",
};
const ABBR_TO_FIPS = Object.fromEntries(Object.entries(FIPS).map(([f, a]) => [a, f]));
const stateName = (st: string) => US_STATES.find(([a]) => a === st)?.[1] ?? st;

type Raw = Record<string, unknown>;
const pick = (r: Raw, ...keys: string[]) => { for (const k of keys) { const v = r[k]; if (v !== undefined && v !== null && String(v).trim() !== "" && String(v) !== "-1" && String(v) !== "-2") return v; } return null; };
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

/** "FRISCO HIGH SCHOOL" → "Frisco High School" (only when the source is all capitals). */
function nice(s: string) {
  if (!s || s !== s.toUpperCase()) return s;
  const small = new Set(["of", "the", "and", "at", "in", "for", "de", "la"]);
  return s.toLowerCase().split(/(\s+|-|\/)/).map((w, i) => {
    if (/^\s+$|^-$|^\//.test(w)) return w;
    if (/^(ii|iii|iv|vi|vii|viii|ix|xi)$/.test(w)) return w.toUpperCase();
    if (i > 0 && small.has(w)) return w;
    if (/^mc[a-z]/.test(w)) return "Mc" + w[2].toUpperCase() + w.slice(3);
    if (/^o'[a-z]/.test(w)) return "O'" + w[2].toUpperCase() + w.slice(3);
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join("")
    .replace(/&([a-z])/g, (_, c: string) => "&" + c.toUpperCase()) // A&M, not A&m
    .replace(/\bH\.? ?S\.?$/, "High School") // "Crockett Early College H S"
    .replace(/\bJr\.? H\.? ?S\.?$/i, "Junior High School")
    .replace(/\b(Kipp|Idea|Yes Prep|Stem|Aisd|Isd)\b/g, (w) => w.toUpperCase());
}

async function getJson(url: string, tries = 4): Promise<any> {
  let last = "";
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(90000), headers: { Accept: "application/json", "User-Agent": "Nearest school import (usenearest.com)" } });
      if (r.status === 404) return null;
      const text = await r.text();
      if (r.ok) {
        try { return JSON.parse(text); } catch { last = `got a web page instead of data (status ${r.status}): ${text.replace(/\s+/g, " ").slice(0, 160)}`; }
      } else last = `status ${r.status}: ${text.replace(/\s+/g, " ").slice(0, 160)}`;
    } catch (e) { last = (e as Error).message; }
    await new Promise((res) => setTimeout(res, 2000 * (i + 1)));
  }
  throw new Error(`Couldn't download ${url}\n  ${last}`);
}

/** Follows the API's "next" links until every page is read. */
async function allPages(url: string, label: string) {
  const out: Raw[] = [];
  let next: string | null = url;
  while (next) {
    const page: { results?: Raw[]; next?: string | null } | null = await getJson(next);
    if (!page) return null;
    out.push(...(page.results ?? []));
    process.stdout.write(`\r  ${label}: ${out.length.toLocaleString()} records`);
    next = page.next ?? null;
  }
  process.stdout.write("\n");
  return out;
}

/** Tries recent years until the directory has data. */
async function latest(path: (year: number) => string, label: string) {
  for (const y of [2024, 2023, 2022, 2021, 2020]) {
    const rows = await allPages(path(y), `${label} ${y}`);
    if (rows && rows.length) return { year: y, rows };
  }
  console.log(`  ⚠ No ${label} data found — skipped.`);
  return { year: 0, rows: [] as Raw[] };
}

type School = { name: string; type: "high_school" | "college" | "trade"; city: string; state: string; countyFips: string | null };

async function main() {
  const states = ONLY ? [ONLY] : Object.values(FIPS);
  if (ONLY && !ABBR_TO_FIPS[ONLY]) { console.log(`Unknown state "${ONLY}". Use a 2-letter code like TX.`); process.exitCode = 1; return; }
  console.log(`\nNearest school import — ${ONLY ? stateName(ONLY) : "all states"}${DRY ? " (preview only)" : ""}\n`);

  // County names by 5-digit FIPS (built into Nearest — no download needed)
  const countyByFips = new Map<string, string>(Object.entries(US_COUNTIES as unknown as Record<string, [string, string]>).map(([f, [n]]) => [f, n]));
  console.log(`  County names: ${countyByFips.size.toLocaleString()} (built in)`);

  const found: School[] = [];

  // Colleges, universities, community colleges, trade/technical/beauty schools (IPEDS)
  for (const st of states) {
    const fips = Number(ABBR_TO_FIPS[st]);
    const { rows } = await latest((y) => `https://educationdata.urban.org/api/v1/college-university/ipeds/directory/${y}/?fips=${fips}`, `${st} colleges`);
    const before = found.length;
    for (const r of rows) {
      const name = str(pick(r, "inst_name", "institution_name"));
      const city = str(pick(r, "city"));
      const level = Number(pick(r, "inst_level"));
      const sector = Number(pick(r, "sector"));
      const active = pick(r, "currently_active_ipeds");
      const closed = /^[CDM]/i.test(str(pick(r, "inst_status"))) || (active !== null && Number(active) === 0); // only when the field is present
      if (!name || !city || sector === 0 || closed) continue; // sector 0 = administrative offices
      const tradeWords = /(beauty|cosmetolog|barber|esthetic|nail|technical|trade|career|vocational|welding|truck|culinary|massage|makeup|hair|paul mitchell|aveda|empire|the school|school of (hair|beauty|cosmetology|massage|esthetics)|lash|brow|salon|spa\b)/i;
      // Trade/beauty schools by name at any length (the directory's length codes vary), or any under-2-year school.
      const type = level === 3 || (tradeWords.test(name) && !/\buniversity\b/i.test(name)) ? "trade" : "college";
      const county = str(pick(r, "county_fips", "county_code"));
      found.push({ name: nice(name), type, city: nice(city), state: st, countyFips: county ? county.padStart(5, "0") : null });
    }
    if (rows.length && found.length === before) console.log(`  ⚠ ${rows.length} college records but none matched. Fields received: ${Object.keys(rows[0]).join(", ")}`);
  }

  // Public high schools, including combined schools that go through 12th grade (NCES Common Core of Data)
  for (const st of states) {
    const fips = Number(ABBR_TO_FIPS[st]);
    const { rows } = await latest((y) => `https://educationdata.urban.org/api/v1/schools/ccd/directory/${y}/?fips=${fips}`, `${st} public schools`);
    const before = found.length;
    for (const r of rows) {
      const name = str(pick(r, "school_name"));
      const city = str(pick(r, "city_location", "city_mailing"));
      const level = Number(pick(r, "school_level"));
      const high = Number(pick(r, "highest_grade_offered"));
      const status = Number(pick(r, "school_status"));
      if (!name || !city) continue;
      if ([2, 6, 7].includes(status)) continue; // closed / inactive / future
      if (!(level === 3 || high === 12)) continue; // high schools, plus any school that offers 12th grade
      // Leave out placements students don't "attend" as their school: special-ed and alternative/disciplinary
      // programs (school_type 2 and 4), and anything named like a DAEP, JJAEP, detention or juvenile center.
      const schoolType = Number(pick(r, "school_type"));
      if (schoolType === 2 || schoolType === 4) continue;
      if (/\b(daep|jjaep|detention|juvenile|disciplinary|restorative|transition center|residential treatment|correctional|hospital|homebound)\b/i.test(name)) continue;
      const county = str(pick(r, "county_code"));
      found.push({ name: nice(name), type: "high_school", city: nice(city), state: st, countyFips: county ? county.padStart(5, "0") : null });
    }
    if (rows.length && found.length === before) console.log(`  ⚠ ${rows.length} school records but no high schools matched. Fields received: ${Object.keys(rows[0]).join(", ")}`);
  }

  const byType = (t: string) => found.filter((s) => s.type === t).length;
  console.log(`\n  Found ${found.length.toLocaleString()}: ${byType("high_school").toLocaleString()} high schools, ${byType("college").toLocaleString()} colleges & universities, ${byType("trade").toLocaleString()} trade schools`);
  console.log("  Examples:");
  for (const s of found.filter((_, i) => i % Math.max(1, Math.floor(found.length / 6)) === 0).slice(0, 6)) {
    console.log(`    ${s.name} — ${s.city}, ${s.state}${s.countyFips && countyByFips.get(s.countyFips) ? ` (${countyByFips.get(s.countyFips)} County)` : ""}`);
  }
  if (DRY) { console.log("\nPreview only — nothing saved. Run again without --dry-run to save."); return; }

  // ---------- Save ----------
  const countyRows = await db.select().from(counties);
  const countyKey = (st: string, n: string) => `${st}|${n.toLowerCase()}`;
  const countyMap = new Map(countyRows.map((c) => [countyKey(c.state, c.name), c.id]));
  const cityRows = await db.select().from(cities);
  const cityKey = (st: string, n: string) => `${st}|${n.toLowerCase()}`;
  const cityMap = new Map(cityRows.map((c) => [cityKey(c.state, c.name), c.id]));
  const used = new Set(cityRows.map((c) => c.abbreviation));

  // Counties
  const needCounties = new Map<string, { name: string; state: string }>();
  for (const s of found) {
    const n = s.countyFips ? countyByFips.get(s.countyFips) : null;
    if (n && !countyMap.has(countyKey(s.state, n))) needCounties.set(countyKey(s.state, n), { name: n, state: s.state });
  }
  const newCounties = [...needCounties.values()].map((c) => ({
    name: c.name, state: c.state,
    market: c.state === "TX" ? TEXAS_COUNTIES.find((t) => t.name.toLowerCase() === c.name.toLowerCase())?.market ?? "Other Texas" : `Other ${stateName(c.state)}`,
  }));
  for (let i = 0; i < newCounties.length; i += 500) {
    const ins = await db.insert(counties).values(newCounties.slice(i, i + 500)).returning();
    for (const c of ins) countyMap.set(countyKey(c.state, c.name), c.id);
  }
  console.log(`  Counties added: ${newCounties.length.toLocaleString()}`);

  // Cities (each gets a unique code for invitation codes)
  const abbr = (name: string) => {
    const L = name.toUpperCase().replace(/[^A-Z]/g, "") || "CTY";
    let a = (L[0] + (L.slice(1).replace(/[AEIOU]/g, "") + L.slice(1)).slice(0, 2)).padEnd(3, "X");
    for (let i = 0; used.has(a); i++) a = L.slice(0, 2).padEnd(2, "X") + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26)) : "");
    used.add(a);
    return a;
  };
  const needCities = new Map<string, { name: string; state: string }>();
  for (const s of found) if (!cityMap.has(cityKey(s.state, s.city))) needCities.set(cityKey(s.state, s.city), { name: s.city, state: s.state });
  const newCities = [...needCities.values()].map((c) => ({ ...c, abbreviation: abbr(c.name) }));
  for (let i = 0; i < newCities.length; i += 500) {
    const ins = await db.insert(cities).values(newCities.slice(i, i + 500)).onConflictDoNothing().returning();
    for (const c of ins) cityMap.set(cityKey(c.state, c.name), c.id);
    process.stdout.write(`\r  Cities added: ${Math.min(i + 500, newCities.length).toLocaleString()} / ${newCities.length.toLocaleString()}`);
  }
  process.stdout.write("\n");

  // City ↔ county links
  const links = new Map<string, { cityId: number; countyId: number }>();
  for (const s of found) {
    const cityId = cityMap.get(cityKey(s.state, s.city));
    const n = s.countyFips ? countyByFips.get(s.countyFips) : null;
    const countyId = n ? countyMap.get(countyKey(s.state, n)) : undefined;
    if (cityId && countyId) links.set(`${cityId}|${countyId}`, { cityId, countyId });
  }
  const linkList = [...links.values()];
  for (let i = 0; i < linkList.length; i += 1000) await db.insert(cityCounties).values(linkList.slice(i, i + 1000)).onConflictDoNothing();

  // Schools
  const seen = new Set<string>();
  const toSave = found.flatMap((s) => {
    const cityId = cityMap.get(cityKey(s.state, s.city));
    const k = `${s.name.toLowerCase()}|${cityId}`;
    if (!cityId || seen.has(k)) return [];
    seen.add(k);
    return [{ name: s.name.slice(0, 120), type: s.type, cityId }];
  });
  let saved = 0;
  for (let i = 0; i < toSave.length; i += 500) {
    const ins = await db.insert(schools).values(toSave.slice(i, i + 500)).onConflictDoNothing().returning({ id: schools.id });
    saved += ins.length;
    process.stdout.write(`\r  Schools saved: ${saved.toLocaleString()} new (${Math.min(i + 500, toSave.length).toLocaleString()} / ${toSave.length.toLocaleString()} checked)`);
  }
  process.stdout.write("\n");
  console.log(`\nDone. ${saved.toLocaleString()} new schools added; ${(toSave.length - saved).toLocaleString()} were already in Nearest.`);
}
main().catch((e) => { console.error("\nImport stopped:", e.message ?? e); process.exitCode = 1; });
