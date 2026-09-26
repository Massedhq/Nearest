"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, counties } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { lookupZip, findOrCreateCounty, findOrCreateCity } from "@/lib/places";
import { US_STATES } from "@/lib/markets";
import type { FormState } from "@/components/ActionForm";

export async function zipLookup(zip: string) {
  await requireAdmin();
  return lookupZip(String(zip).trim());
}

/** Resolves State + City + County from a form into a city id, adding the county/city if they're new. */
export async function placeFromForm(form: FormData): Promise<{ cityId: number; label: string } | { error: string }> {
  const state = String(form.get("state") ?? "").toUpperCase();
  const city = String(form.get("city") ?? "").trim().slice(0, 60);
  const county = String(form.get("county") ?? "").trim().slice(0, 60);
  if (!US_STATES.some(([a]) => a === state)) return { error: "Choose the state." };
  if (!city) return { error: "Enter the city (or look up the ZIP)." };
  if (!county) return { error: "Enter the county (or look up the ZIP)." };
  const c = await findOrCreateCounty(state, county);
  const { city: row } = await findOrCreateCity(state, city, c.id);
  return { cityId: row.id, label: `${row.name}, ${c.name} County, ${state}` };
}

export async function addPlace(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const p = await placeFromForm(form);
  if ("error" in p) return p;
  await logActivity({ actorUserId: user.id, action: "city.added", targetType: "city", targetId: p.label });
  revalidatePath("/admin", "layout");
  return { ok: `${p.label} is in the coverage list.` };
}

export async function setCountyMarket(form: FormData) {
  const { user } = await requireAdmin();
  const id = Number(form.get("countyId"));
  const market = String(form.get("market") ?? "").trim().slice(0, 40);
  if (!id || !market) return;
  const [before] = await db.select().from(counties).where(eq(counties.id, id));
  await db.update(counties).set({ market }).where(eq(counties.id, id));
  await logActivity({ actorUserId: user.id, action: "county.market", targetType: "county", targetId: `${before?.name} County, ${before?.state}`, before: before?.market, after: market });
  revalidatePath("/admin", "layout");
}
