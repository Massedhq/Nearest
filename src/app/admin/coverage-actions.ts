"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, cities, cityCounties } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import type { FormState } from "@/components/ActionForm";

export async function addCity(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const countyIds = form.getAll("countyId").map(Number).filter(Boolean);
  if (!name) return { error: "Enter the city name." };
  if (!countyIds.length) return { error: "Pick at least one county." };
  const existing = await db.select().from(cities);
  if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) return { error: "That city is already listed." };
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
  const used = new Set(existing.map((c) => c.abbreviation));
  let abbr = (letters[0] + (letters.slice(1).replace(/[AEIOU]/g, "") + letters.slice(1)).slice(0, 2)).padEnd(3, "X");
  for (let i = 0; used.has(abbr); i++) abbr = letters.slice(0, 2) + String.fromCharCode(65 + (i % 26));
  const [c] = await db.insert(cities).values({ name, abbreviation: abbr }).returning();
  await db.insert(cityCounties).values(countyIds.map((countyId) => ({ cityId: c.id, countyId }))).onConflictDoNothing();
  await logActivity({ actorUserId: user.id, action: "city.added", targetType: "city", targetId: name, after: { abbr, countyIds } });
  revalidatePath("/admin/coverage");
  return { ok: `${name} added (code ${abbr}).` };
}

export async function toggleCity(form: FormData) {
  const { user } = await requireAdmin();
  const c = await db.query.cities.findFirst({ where: eq(cities.id, Number(form.get("id"))) });
  if (!c) return;
  await db.update(cities).set({ active: !c.active }).where(eq(cities.id, c.id));
  await logActivity({ actorUserId: user.id, action: "city.active", targetType: "city", targetId: c.name, before: c.active, after: !c.active });
  revalidatePath("/admin/coverage");
}
