import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { SETTINGS } from "../lib/settings-defaults";
import { DFW_CITIES } from "./dfw-cities";
import { TEXAS_COUNTIES } from "./texas-counties";

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
// Categories group services by license (a category's license applies to every pro in it — see Admin → Marketplace).
// Existing names are kept so live professionals aren't affected; new services are only ever added, never removed.
// Source: "Nearest — Personal, Beauty & Wellness Service Categories" reference.
const CATEGORIES: { name: string; license: string | null; services: string[] }[] = [
  { name: "Hair", license: "Cosmetology Operator license (TDLR)", services: [
    "Silk Press", "Wash & Style", "Cut", "Color", "Blowout", "Roller Set", "Trim", "Curls", "Updo", "Ponytail", "Quick Weave", "Sew-In",
    "Wig Install", "Lace Install", "Wig Customization", "Wig Plucking", "Bleaching Knots", "Wig Styling", "Wig Maintenance", "Wig Reinstall",
    "Extensions", "Microlinks", "Tape-Ins", "I-Tips", "K-Tips", "Clip-Ins", "Extension Removal", "Extension Maintenance",
    "Wash & Go", "Twist-Out", "Braid-Out", "Two-Strand Twists", "Coil Styling", "Protective Style", "Natural Hair Treatment", "Detangling",
    "Highlights", "Lowlights", "Balayage", "Root Touch-Up", "Fashion Color", "Toner", "Color Correction",
    "Scalp Analysis", "Scalp Cleansing", "Scalp Treatment", "Buildup Removal", "Scalp Massage", "Scalp Hydration", "Head Spa Treatment",
  ] },
  { name: "Braids", license: null, services: ["Knotless Braids", "Box Braids", "Cornrows", "Feed-in Braids", "Stitch Braids", "Fulani Braids", "Lemonade Braids", "Tribal Braids", "Braided Ponytail", "Crochet Braids"] },
  { name: "Locs", license: null, services: ["Retwist", "Starter Locs", "Loc Styling", "Interlocking", "Loc Repair", "Loc Extensions", "Instant Locs", "Loc Detox"] },
  { name: "Barber", license: "Barber license (TDLR)", services: ["Haircut", "Lineup", "Beard Trim", "Fade", "Taper", "Beard Shaping", "Razor Shave", "Hair Design", "Hot-Towel Shave"] },
  { name: "Lashes", license: "Eyelash Extension Specialty license (TDLR)", services: ["Classic Set", "Hybrid Set", "Volume Set", "Lash Model Set", "Lash Fill", "Mega Volume Set", "Lash Removal", "Lash Lift", "Lash Tint", "Cluster Lashes", "Individual Clusters", "Lash Maintenance"] },
  { name: "Brows", license: null, services: ["Brow Lamination", "Brow Tint", "Brow Wax", "Brow Shaping", "Brow Threading", "Henna Brows", "Brow Mapping", "Upper Lip Threading", "Chin Threading", "Cheek Threading", "Sideburn Threading", "Full-Face Threading"] },
  { name: "Nails", license: "Manicurist Specialty license (TDLR)", services: ["Gel Manicure", "Acrylic Full Set", "Pedicure", "Manicure", "Acrylic Fill", "Gel-X", "Builder Gel", "Dip Powder", "Nail Art", "Nail Repair", "Soak-Off", "Gel Pedicure", "Spa Pedicure", "French Pedicure", "Toe Acrylic", "Polish Change", "Callus Care"] },
  { name: "Makeup", license: null, services: ["Soft Glam", "Full Glam", "Prom Makeup", "Natural Makeup", "Bridal Makeup", "Event Makeup", "Editorial Makeup", "Strip-Lash Application"] },
  { name: "Photography", license: null, services: ["Portrait Session", "Graduation Photos"] },
  { name: "Skincare", license: "Esthetician license (TDLR)", services: ["Facial", "Deep Cleansing Facial", "Hydration Facial", "Acne Facial", "Extractions", "Exfoliation", "Mask Treatment", "Dermaplaning", "Chemical Peel", "Skin Consultation", "Skin Maintenance Treatment", "Facial Massage", "Gua Sha", "Facial Sculpting", "Lymphatic Facial Massage"] },
  { name: "Hair Removal", license: "Esthetician license (TDLR)", services: ["Lip Wax", "Chin Wax", "Underarm Wax", "Arm Wax", "Leg Wax", "Bikini Wax", "Brazilian Wax", "Back/Chest Wax", "Brazilian Sugaring", "Bikini Sugaring", "Leg Sugaring", "Arm Sugaring", "Underarm Sugaring", "Face Sugaring", "Back/Chest Sugaring"] },
  { name: "Massage", license: "Massage Therapist license (TDLR)", services: ["Swedish Massage", "Deep-Tissue Massage", "Sports Massage", "Chair Massage", "Prenatal Massage", "Hot-Stone Massage"] },
  { name: "Body & Wellness", license: null, services: ["Full-Body Spray Tan", "Partial Spray Tan", "Contour Tan", "Express Tan", "Teeth Whitening", "Teeth Whitening Touch-Up", "Tooth Gems", "Tooth Gem Design", "Tooth Gem Removal", "Henna Tattoo", "Henna Hand Design", "Henna Feet Design", "Bridal Henna", "Custom Henna", "Cavitation", "Radiofrequency Treatment", "Vacuum Therapy", "Body Sculpting", "Wood Therapy", "Lymphatic Treatment"] },
  { name: "Tattoos & Piercings", license: "Tattoo & body piercing license (Texas DSHS)", services: ["Fine-Line Tattoo", "Traditional Tattoo", "Lettering Tattoo", "Custom Tattoo", "Flash Tattoo", "Tattoo Touch-Up", "Microblading", "Powder Brows", "Ombre Brows", "Combo Brows", "Lip Blush", "Permanent Eyeliner", "Ear Piercing", "Nose Piercing", "Navel Piercing", "Facial/Body Piercing", "Jewelry Change"] },
  { name: "Fitness", license: null, services: ["Strength Training", "Weight Training", "Conditioning", "Beginner Training", "One-on-One Fitness Session", "Private Yoga", "Beginner Yoga", "Restorative Yoga", "Flexibility Session", "Assisted Stretching", "Mobility Session", "Recovery Stretching", "Mat Pilates", "Reformer Pilates", "Private Pilates", "Beginner Pilates", "Guided Meditation", "Breathwork Session", "Relaxation Session"] },
  { name: "Personal Styling", license: null, services: ["Outfit Styling", "Wardrobe Consultation", "Event Styling", "Closet Styling", "Personal Shopping", "Personal Style Consultation", "Color Analysis", "Wardrobe Planning", "Image Styling", "Alterations", "Hemming", "Resizing", "Zipper Repair", "Custom Fitting", "Sneaker Cleaning", "Sneaker Deep Clean", "Sneaker Whitening", "Stain Removal", "Sneaker Restoration", "Accessory Styling", "Jewelry Styling", "Ear Styling", "Beauty Consultation", "Product Selection", "Skincare Routine Guidance", "Makeup Product Guidance"] },
  { name: "Grooming", license: "Barber or Cosmetology license (TDLR)", services: ["Men's Haircut", "Beard Grooming", "Facial Grooming", "Men's Brows", "Men's Waxing", "Basic Skincare"] },
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
  // All 254 Texas counties; only missing ones are added, and an existing county's market is never overwritten.
  const haveCounties = await db.select().from(counties);
  const missingCounties = TEXAS_COUNTIES.filter((c) => !haveCounties.some((h) => h.state === "TX" && h.name === c.name));
  if (missingCounties.length) await db.insert(counties).values(missingCounties.map((c) => ({ name: c.name, state: "TX", market: c.market })));
  void COUNTIES;
  await db.insert(cities).values(CITIES.map((c) => ({ name: c.name, abbreviation: c.abbr }))).onConflictDoNothing();
  // Full DFW starter list: generate a unique 3-letter code for each new city (used in invite codes).
  const all = await db.select().from(cities);
  const have = all.filter((c) => c.state === "TX");
  const usedAbbr = new Set(all.map((c) => c.abbreviation)); // codes are unique across every state
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
    const city = cityRows.find((r) => r.state === "TX" && r.name === c.name)!;
    return c.counties.map((n) => ({ cityId: city.id, countyId: countyRows.find((r) => r.state === "TX" && r.name === n)!.id }));
  });
  await db.insert(cityCounties).values(links).onConflictDoNothing();

  await db
    .insert(categories)
    .values(CATEGORIES.map((c, i) => ({ name: c.name, licenseRequired: !!c.license, licenseLabel: c.license, sort: i })))
    .onConflictDoNothing();
  // "Other" always sorts last, after categories added later.
  await db.update(categories).set({ sort: 999 }).where(sql`${categories.name} = 'Other'`);
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

  // Client photos used to be copied into portfolios automatically. Take those back out (they stay in the pro's
  // private Client photos). Photos a pro chose to add later have from_booking_id set and are never touched.
  await db.execute(sql`delete from portfolio_items where source = 'nearest' and from_booking_id is null`);

  // Never overwrite a value the owner already changed.
  await db
    .insert(platformSettings)
    .values(Object.entries(SETTINGS).map(([key, d]) => ({ key, value: d.value })))
    .onConflictDoNothing();

  const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from platform_settings`).then((r) => r.rows as { n: number }[]);
  // Professional status is self-reported now (no license review): accept anything left pending/rejected from the old review.
  await db.execute(sql`update pro_credentials set status = 'verified', review_note = null where status <> 'verified'`);
  // Professional status is one value per account now: carry over each pro's most common earlier per-category choice.
  await db.execute(sql`update professional_profiles pp set professional_status = x.st from (
    select distinct on (user_id) user_id, case kind when 'license' then 'licensed' when 'diploma' then 'license_pending' when 'enrolled' then 'currently_enrolled' when 'self_taught' then 'self_taught' end as st
    from pro_credentials group by user_id, kind order by user_id, count(*) desc, kind) x
    where pp.user_id = x.user_id and pp.professional_status is null and x.st is not null`);
  console.log(`Seeded ${countyRows.length} counties, ${cityRows.length} cities, ${CATEGORIES.length} categories, ${schoolValues.length} schools, ${n} settings.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
