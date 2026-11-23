import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, areaCities, areaZips, cities, users } from "@/db";
import { DFW_CITIES } from "@/db/dfw-cities";

/**
 * Areas (2026-11-22, owner): which owner works which part of a market. A city belongs to one owner; a ZIP can override
 * its city (that's how the City of Dallas is split North / South / East). ZIP first, then city. Kisses and Lakeesha see
 * their own area, the main owner sees all and changes it in Admin → Areas.
 */
export type Side = "north" | "south" | "east" | "westNorth" | "westCentral" | "westSouth";
export const SIDE_LABEL: Record<Side, string> = {
  north: "North Dallas and up", south: "South Dallas", east: "East Dallas",
  westNorth: "West — northeast Tarrant & Wise", westCentral: "West — central Tarrant", westSouth: "West — south Tarrant, Johnson & Parker",
};

// Starting split the owner approved (2026-11-22). Whole counties first, then named cities in Dallas and Tarrant counties.
const BY_COUNTY: Record<string, Side> = { Collin: "north", Denton: "north", Ellis: "south", Rockwall: "east", Kaufman: "east", Hunt: "east", Wise: "westNorth", Johnson: "westSouth", Parker: "westSouth" };
const BY_CITY: Record<string, Side> = {
  // Dallas County
  Addison: "north", Carrollton: "north", Coppell: "north", "Farmers Branch": "north", "Highland Park": "north", "University Park": "north", Irving: "north",
  Garland: "east", Mesquite: "east", Rowlett: "east", Sunnyvale: "east", "Balch Springs": "east", Seagoville: "east", Sachse: "east",
  "Cedar Hill": "south", "Cockrell Hill": "south", DeSoto: "south", Duncanville: "south", "Glenn Heights": "south", "Grand Prairie": "south", Hutchins: "south", Lancaster: "south", Wilmer: "south",
  // Tarrant County
  Keller: "westNorth", Southlake: "westNorth", Grapevine: "westNorth", Colleyville: "westNorth", Westlake: "westNorth", Haslet: "westNorth", Watauga: "westNorth",
  "North Richland Hills": "westNorth", "Haltom City": "westNorth", "Richland Hills": "westNorth", Saginaw: "westNorth", "Blue Mound": "westNorth",
  "Fort Worth": "westCentral", Hurst: "westCentral", Euless: "westCentral", Bedford: "westCentral", Arlington: "westCentral", Pantego: "westCentral",
  "Dalworthington Gardens": "westCentral", "River Oaks": "westCentral", "Sansom Park": "westCentral", "Lake Worth": "westCentral", Lakeside: "westCentral",
  "Pelican Bay": "westCentral", "Westover Hills": "westCentral", "Westworth Village": "westCentral", "White Settlement": "westCentral",
  Crowley: "westSouth", Benbrook: "westSouth", Everman: "westSouth", "Forest Hill": "westSouth", Kennedale: "westSouth", "Edgecliff Village": "westSouth",
};
// The City of Dallas by ZIP.
export const DALLAS_ZIPS: Record<"north" | "south" | "east", string[]> = {
  north: ["75201", "75202", "75204", "75205", "75207", "75209", "75219", "75220", "75225", "75229", "75230", "75231", "75234", "75235", "75240", "75243", "75244", "75247", "75248", "75251", "75252", "75254", "75287"],
  east: ["75206", "75214", "75217", "75218", "75223", "75226", "75227", "75228", "75238", "75246"],
  south: ["75203", "75208", "75210", "75211", "75212", "75215", "75216", "75224", "75232", "75233", "75236", "75237", "75241", "75249", "75253"],
};

export function startingSide(name: string, counties: string[]): Side | null {
  if (BY_CITY[name]) return BY_CITY[name];
  if (name === "Dallas") return null; // split by ZIP
  for (const c of counties) if (BY_COUNTY[c]) return BY_COUNTY[c];
  if (counties[0] === "Tarrant") return "westCentral";
  if (counties[0] === "Dallas") return "north";
  return null;
}

/** Who has each side: the three West slices go to the North, East and South owners. */
export function sideOwner(side: Side, who: { north: string; south: string; east: string }) {
  return side === "north" || side === "westNorth" ? who.north : side === "east" || side === "westCentral" ? who.east : who.south;
}

/** Put the approved starting split in place. Cities are matched by name in Texas. Replaces every area row. */
export async function applyStartingSplit(who: { north: string; south: string; east: string }, actorId: string) {
  const names = DFW_CITIES.map((c) => c.name);
  const rows = await db.select({ id: cities.id, name: cities.name }).from(cities).where(and(eq(cities.state, "TX"), inArray(cities.name, names)));
  const byName = new Map(DFW_CITIES.map((c) => [c.name, c.counties]));
  const cityRows: { cityId: number; ownerId: string; updatedBy: string }[] = [];
  let dallasId: number | null = null;
  for (const r of rows) {
    if (r.name === "Dallas") { dallasId = r.id; continue; }
    const side = startingSide(r.name, byName.get(r.name) ?? []);
    if (side) cityRows.push({ cityId: r.id, ownerId: sideOwner(side, who), updatedBy: actorId });
  }
  const zipRows = (Object.entries(DALLAS_ZIPS) as ["north" | "south" | "east", string[]][])
    .flatMap(([side, zips]) => zips.map((zip) => ({ zip, ownerId: who[side], cityId: dallasId, updatedBy: actorId })));
  await db.transaction(async (tx) => {
    await tx.delete(areaCities);
    await tx.delete(areaZips);
    if (cityRows.length) await tx.insert(areaCities).values(cityRows);
    if (zipRows.length) await tx.insert(areaZips).values(zipRows);
    if (dallasId) await tx.insert(areaCities).values({ cityId: dallasId, ownerId: who.north, updatedBy: actorId }); // Dallas ZIPs not on the list → North
  });
  return { cities: cityRows.length + (dallasId ? 1 : 0), zips: zipRows.length };
}

const zip5 = (z: string | null | undefined) => (z ? (/^(\d{5})/.exec(z.trim())?.[1] ?? null) : null);

/** The owner whose area this place is in (ZIP first, then city), or null when it's in nobody's area. */
export async function areaOwnerFor(cityId: number | null | undefined, zip?: string | null) {
  const z = zip5(zip);
  if (z) {
    const r = await db.query.areaZips.findFirst({ where: eq(areaZips.zip, z) });
    if (r) return r.ownerId;
  }
  if (cityId) {
    const r = await db.query.areaCities.findFirst({ where: eq(areaCities.cityId, cityId) });
    if (r) return r.ownerId;
  }
  return null;
}

/** SQL: true when a row's city/ZIP is in this owner's area. Pass the row's city id and ZIP column expressions. */
export function inArea(ownerId: string, cityCol: unknown, zipCol?: unknown) {
  const zipPart = zipCol
    ? sql`(left(coalesce(${zipCol}::text, ''), 5) in (select zip from area_zips where owner_id = ${ownerId})
         or (${cityCol} in (select city_id from area_cities where owner_id = ${ownerId})
             and left(coalesce(${zipCol}::text, ''), 5) not in (select zip from area_zips where owner_id <> ${ownerId})))`
    : sql`${cityCol} in (select city_id from area_cities where owner_id = ${ownerId})`;
  return zipPart;
}

/** Every area row with names, for Admin → Areas. */
export async function areaMap() {
  const [cityRows, zipRows, owners] = await Promise.all([
    db.execute<{ cityId: number; city: string; ownerId: string }>(sql`select a.city_id as "cityId", c.name as city, a.owner_id as "ownerId" from area_cities a join cities c on c.id = a.city_id order by c.name`),
    db.select().from(areaZips).orderBy(areaZips.zip),
    areaOwners(),
  ]);
  return { cities: cityRows.rows, zips: zipRows, owners };
}

/** The active owners (Avy, Kisses, Lakeesha…) with first names. */
export async function areaOwners() {
  const { partners } = await import("./partner");
  return (await partners()).map((p) => ({ id: p.userId, name: p.first || p.email?.split("@")[0] || "Owner" }));
}

/** City ids in an owner's area (whole cities; ZIP-split cities are included too). */
export async function areaCityIds(ownerId: string) {
  const [a, b] = await Promise.all([
    db.select({ id: areaCities.cityId }).from(areaCities).where(eq(areaCities.ownerId, ownerId)),
    db.selectDistinct({ id: areaZips.cityId }).from(areaZips).where(eq(areaZips.ownerId, ownerId)),
  ]);
  return [...new Set([...a.map((x) => x.id), ...b.map((x) => x.id).filter((x): x is number => x != null)])];
}

export async function ownerFirstName(id: string | null | undefined) {
  if (!id) return null;
  const u = await db.query.users.findFirst({ where: eq(users.id, id), columns: { firstName: true, email: true } });
  return u?.firstName || u?.email?.split("@")[0] || null;
}
