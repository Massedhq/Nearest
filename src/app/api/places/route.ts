import { and, asc, eq, sql } from "drizzle-orm";
import { db, counties, cities, cityCounties, schools } from "@/db";
import { getViewer } from "@/lib/viewer";

// Step-by-step school finder for sign-up: ?list=states | counties&state=TX | cities&county=ID | schools&city=ID
// Only places that actually have active schools are returned, so lists stay short.
export async function GET(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Sign in" }, { status: 401 });
  const u = new URL(req.url);
  const list = u.searchParams.get("list");
  const headers = { "Cache-Control": "private, max-age=300" };
  const hasSchool = sql`exists (select 1 from ${schools} s where s.city_id = ${cities.id} and s.active)`;

  if (list === "states") {
    const rows = await db.selectDistinct({ state: cities.state }).from(cities).where(and(eq(cities.active, true), hasSchool)).orderBy(asc(cities.state));
    return Response.json(rows.map((r) => r.state), { headers });
  }
  if (list === "counties") {
    const st = (u.searchParams.get("state") ?? "").toUpperCase().slice(0, 2);
    const rows = await db.selectDistinct({ id: counties.id, name: counties.name })
      .from(counties).innerJoin(cityCounties, eq(cityCounties.countyId, counties.id)).innerJoin(cities, eq(cities.id, cityCounties.cityId))
      .where(and(eq(counties.state, st), eq(cities.active, true), hasSchool)).orderBy(asc(counties.name));
    return Response.json(rows, { headers });
  }
  if (list === "cities") {
    const county = Number(u.searchParams.get("county"));
    const rows = await db.selectDistinct({ id: cities.id, name: cities.name })
      .from(cities).innerJoin(cityCounties, eq(cityCounties.cityId, cities.id))
      .where(and(eq(cityCounties.countyId, county), eq(cities.active, true), hasSchool)).orderBy(asc(cities.name));
    return Response.json(rows, { headers });
  }
  if (list === "schools") {
    const city = Number(u.searchParams.get("city"));
    const rows = await db.select({ id: schools.id, name: schools.name, type: schools.type }).from(schools)
      .where(and(eq(schools.cityId, city), eq(schools.active, true))).orderBy(asc(schools.name)).limit(2000);
    return Response.json(rows, { headers });
  }
  return Response.json({ error: "Unknown list" }, { status: 400 });
}
