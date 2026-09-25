import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { SETTINGS } from "../lib/settings-defaults";
import { DFW_CITIES } from "./dfw-cities";

const db = drizzle({ client: neon(process.env.DATABASE_URL!), schema });
const { counties, cities, cityCounties, platformSettings, categories, catalogServices, schools } = schema;

const COUNTIES = ["Collin", "Dallas", "Denton", "Ellis", "Hunt", "Johnson", "Kaufman", "Parker", "Rockwall", "Tarrant", "Wise"];

const CITIES: { name: string; abbr: string; counties: string[] }[] = [
  { name: "Frisco", abbr: "FRS", counties: ["Collin", "Denton"] },
  { name: "Allen", abbr: "ALN", counties: ["Collin"] },
  { name: "Plano", abbr: "PLN", counties: ["Collin", "Denton"] },
  { name: "McKinney", abbr: "MCK", counties: ["Collin"] },
  { name: "Little Elm", abbr: "LEL", counties: ["Denton"] },
  { name: "Aubrey", abbr: "AUB", counties: ["Denton"] },
  { name: "Arlington", abbr: "ARL", counties: ["Tarrant"] },
  { name: "Forney", abbr: "FOR", counties: ["Kaufman"] },
  { name: "Alvord", abbr: "ALV", counties: ["Wise"] },
];

// License flags are starting defaults only. Confirm each with TDLR and adjust in Admin > Marketplace.
const CATEGORIES: { name: string; license: string | null; services: string[] }[] = [
  { name: "Hair", license: "Cosmetology Operator license (TDLR)", services: ["Silk Press", "Wash & Style", "Cut", "Color"] },
  { name: "Braids", license: null, services: ["Knotless Braids", "Box Braids", "Cornrows", "Feed-in Braids"] },
  { name: "Locs", license: null, services: ["Retwist", "Starter Locs", "Loc Styling"] },
  { name: "Barber", license: "Barber license (TDLR)", services: ["Haircut", "Lineup", "Beard Trim"] },
  { name: "Lashes", license: "Eyelash Extension Specialty license (TDLR)", services: ["Classic Set", "Hybrid Set", "Volume Set", "Lash Model Set", "Lash Fill"] },
  { name: "Brows", license: null, services: ["Brow Lamination", "Brow Tint", "Brow Wax"] },
  { name: "Nails", license: "Manicurist Specialty license (TDLR)", services: ["Gel Manicure", "Acrylic Full Set", "Pedicure"] },
  { name: "Makeup", license: null, services: ["Soft Glam", "Full Glam", "Prom Makeup"] },
  { name: "Photography", license: null, services: ["Portrait Session", "Graduation Photos"] },
  { name: "Other", license: null, services: [] },
];

// Starter schools for the seeded cities. Owners add the rest in Admin > Schools,
// and students can request a missing school from the verification screen.
const SCHOOLS: { city: string; type: "high_school" | "college" | "trade"; names: string[] }[] = [
  { city: "Frisco", type: "high_school", names: ["Frisco High School", "Centennial High School", "Wakeland High School", "Liberty High School", "Lone Star High School", "Heritage High School", "Independence High School", "Reedy High School", "Memorial High School", "Emerson High School", "Panther Creek High School"] },
  { city: "Frisco", type: "college", names: ["Collin College – Frisco Campus", "University of North Texas at Frisco"] },
  { city: "Plano", type: "high_school", names: ["Plano Senior High School", "Plano East Senior High School", "Plano West Senior High School"] },
  { city: "Plano", type: "college", names: ["Collin College – Spring Creek Campus"] },
  { city: "Allen", type: "high_school", names: ["Allen High School"] },
  { city: "McKinney", type: "high_school", names: ["McKinney High School", "McKinney Boyd High School", "McKinney North High School"] },
  { city: "McKinney", type: "college", names: ["Collin College – McKinney Campus"] },
  { city: "Little Elm", type: "high_school", names: ["Little Elm High School"] },
  { city: "Aubrey", type: "high_school", names: ["Aubrey High School"] },
  { city: "Arlington", type: "high_school", names: ["Arlington High School", "Lamar High School", "Martin High School", "Sam Houston High School", "Bowie High School", "Seguin High School"] },
  { city: "Arlington", type: "college", names: ["University of Texas at Arlington"] },
  { city: "Forney", type: "high_school", names: ["Forney High School", "North Forney High School"] },
  { city: "Alvord", type: "high_school", names: ["Alvord High School"] },
];

async function main() {
  await db.insert(counties).values(COUNTIES.map((name) => ({ name }))).onConflictDoNothing();
  await db.insert(cities).values(CITIES.map((c) => ({ name: c.name, abbreviation: c.abbr }))).onConflictDoNothing();
  // Full DFW starter list: generate a unique 3-letter code for each new city (used in invite codes).
  const have = await db.select().from(cities);
  const usedAbbr = new Set(have.map((c) => c.abbreviation));
  for (const c of DFW_CITIES) {
    if (have.some((h) => h.name === c.name)) continue;
    const letters = c.name.toUpperCase().replace(/[^A-Z]/g, "");
    let abbr = (letters[0] + (letters.slice(1).replace(/[AEIOU]/g, "") + letters.slice(1)).slice(0, 2)).padEnd(3, "X");
    for (let i = 0; usedAbbr.has(abbr); i++) abbr = letters.slice(0, 2) + String.fromCharCode(65 + (i % 26));
    usedAbbr.add(abbr);
    await db.insert(cities).values({ name: c.name, abbreviation: abbr }).onConflictDoNothing();
  }

  const countyRows = await db.select().from(counties);
  const cityRows = await db.select().from(cities);
  const allCities = [...CITIES, ...DFW_CITIES.map((c) => ({ ...c, abbr: "" }))];
  const links = allCities.flatMap((c) => {
    const city = cityRows.find((r) => r.name === c.name)!;
    return c.counties.map((n) => ({ cityId: city.id, countyId: countyRows.find((r) => r.name === n)!.id }));
  });
  await db.insert(cityCounties).values(links).onConflictDoNothing();

  await db
    .insert(categories)
    .values(CATEGORIES.map((c, i) => ({ name: c.name, licenseRequired: !!c.license, licenseLabel: c.license, sort: i })))
    .onConflictDoNothing();
  const catRows = await db.select().from(categories);
  const svc = CATEGORIES.flatMap((c) => {
    const cat = catRows.find((r) => r.name === c.name)!;
    return c.services.map((name, i) => ({ categoryId: cat.id, name, sort: i }));
  });
  if (svc.length) await db.insert(catalogServices).values(svc).onConflictDoNothing();

  const cityRows2 = await db.select().from(cities);
  const schoolValues = SCHOOLS.flatMap((g) => {
    const city = cityRows2.find((c) => c.name === g.city)!;
    return g.names.map((name) => ({ name, type: g.type, cityId: city.id }));
  });
  await db.insert(schools).values(schoolValues).onConflictDoNothing();

  // Never overwrite a value the owner already changed.
  await db
    .insert(platformSettings)
    .values(Object.entries(SETTINGS).map(([key, d]) => ({ key, value: d.value })))
    .onConflictDoNothing();

  const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from platform_settings`).then((r) => r.rows as { n: number }[]);
  console.log(`Seeded ${COUNTIES.length} counties, ${cityRows.length} cities, ${CATEGORIES.length} categories, ${schoolValues.length} schools, ${n} settings.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
