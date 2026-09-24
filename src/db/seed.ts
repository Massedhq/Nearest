import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { SETTINGS } from "../lib/settings-defaults";

const db = drizzle({ client: neon(process.env.DATABASE_URL!), schema });
const { counties, cities, cityCounties, platformSettings, categories, catalogServices } = schema;

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

async function main() {
  await db.insert(counties).values(COUNTIES.map((name) => ({ name }))).onConflictDoNothing();
  await db.insert(cities).values(CITIES.map((c) => ({ name: c.name, abbreviation: c.abbr }))).onConflictDoNothing();

  const countyRows = await db.select().from(counties);
  const cityRows = await db.select().from(cities);
  const links = CITIES.flatMap((c) => {
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

  // Never overwrite a value the owner already changed.
  await db
    .insert(platformSettings)
    .values(Object.entries(SETTINGS).map(([key, d]) => ({ key, value: d.value })))
    .onConflictDoNothing();

  const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from platform_settings`).then((r) => r.rows as { n: number }[]);
  console.log(`Seeded ${COUNTIES.length} counties, ${CITIES.length} cities, ${CATEGORIES.length} categories, ${n} settings.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
