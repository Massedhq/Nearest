import "server-only";
import { eq } from "drizzle-orm";
import { db, cityCounties, counties } from "@/db";

/** Which market a city belongs to ("DFW", "HOU", …) — from its county. */
export async function marketOfCity(cityId: number | null | undefined) {
  if (!cityId) return null;
  const [row] = await db.select({ market: counties.market }).from(cityCounties).innerJoin(counties, eq(counties.id, cityCounties.countyId)).where(eq(cityCounties.cityId, cityId)).limit(1);
  return row?.market ?? null;
}


/** The city a professional's placement is in: where they work, or the city they claimed on Join. */
export const proCityId = (p: { cityId: number | null; slotCityId: number | null }) => p.cityId ?? p.slotCityId;
