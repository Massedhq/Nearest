"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, cardPlaces, cities } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { PLACE_KINDS, assignRange, assignNumbers } from "@/lib/card-places";

type FormState = { error?: string; ok?: string };
const s = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);

/** Card places are for owners (Avy, Kisses, Lakeesha). Making card batches stays the main owner's alone. */
async function owner() {
  try { const { user, role } = await requireAdmin(); return role === "OWNER" ? user : null; } catch { return null; }
}
const refresh = () => { revalidatePath("/admin/card-places"); revalidatePath("/card"); revalidatePath("/cards"); };

/** Add a place Nearest gives cards to. */
export async function addCardPlace(_: FormState, form: FormData): Promise<FormState> {
  const user = await owner();
  if (!user) return { error: "Only owners can add card places." };
  const name = s(form, "name", 120);
  const kind = PLACE_KINDS[s(form, "kind", 30)] ? s(form, "kind", 30) : "other";
  const cityId = Number(s(form, "cityId", 10)) || null;
  if (!name) return { error: "Enter the place's name." };
  if (!cityId || !(await db.query.cities.findFirst({ where: eq(cities.id, cityId) }))) return { error: "Choose the city the place is in." };
  const [p] = await db.insert(cardPlaces).values({ name, kind, cityId, address: s(form, "address", 200) || null, notes: s(form, "notes", 500) || null, createdBy: user.id }).returning();
  await logActivity({ actorUserId: user.id, action: "cards.place_added", targetType: "card_place", targetId: p.id, after: { name, kind, cityId } });
  refresh();
  return { ok: `${name} added. Now give it cards below.` };
}

/** Hide a place from students (no longer handing out cards) or show it again. */
export async function setCardPlaceActive(form: FormData) {
  const user = await owner();
  if (!user) return;
  const id = s(form, "id", 40), on = s(form, "to", 5) === "on";
  const before = await db.query.cardPlaces.findFirst({ where: eq(cardPlaces.id, id) });
  if (!before) return;
  await db.update(cardPlaces).set({ active: on }).where(eq(cardPlaces.id, id));
  await logActivity({ actorUserId: user.id, action: on ? "cards.place_on" : "cards.place_off", targetType: "card_place", targetId: id, before: { active: before.active }, after: { active: on } });
  refresh();
}

/** Give cards to a place: a stack by # range from the printer file, or exact card numbers. */
export async function assignCardsToPlace(_: FormState, form: FormData): Promise<FormState> {
  const user = await owner();
  if (!user) return { error: "Only owners can give cards to a place." };
  const placeId = s(form, "placeId", 40);
  const move = form.get("move") === "on";
  const numbers = String(form.get("numbers") ?? "").slice(0, 40000).trim();
  const r = numbers
    ? await assignNumbers(placeId, numbers, user.id, move)
    : await assignRange(placeId, s(form, "batchId", 40), Number(s(form, "from", 6)), Number(s(form, "to", 6)), user.id, move);
  if ("ok" in r) {
    await logActivity({ actorUserId: user.id, action: "cards.assigned_to_place", targetType: "card_place", targetId: placeId, after: { how: numbers ? "numbers" : "range", batchId: s(form, "batchId", 40) || null, from: s(form, "from", 6) || null, to: s(form, "to", 6) || null, move, result: r.ok } });
    refresh();
  }
  return r;
}
