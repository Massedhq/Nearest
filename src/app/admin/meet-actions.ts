"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, meetSpots, outreachMeetings } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { MEET_CITIES } from "@/lib/meet";

type FormState = { error?: string; ok?: string };
const STATES: Record<string, string> = { showed: "Marked as showed up.", no_show: "Marked as a no-show — they can't book again.", cancelled: "Cancelled — the time and spot are open again.", booked: "Back to booked." };

/** Owner: showed up / no-show (blocks rebooking) / cancel (frees the time and spot) / undo. */
export async function setMeetingState(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const id = String(form.get("id") ?? "");
  const to = String(form.get("to") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id) || !STATES[to]) return { error: "Not found." };
  const before = await db.query.outreachMeetings.findFirst({ where: eq(outreachMeetings.id, id) });
  if (!before) return { error: "Not found." };
  await db.update(outreachMeetings).set({ state: to, stateAt: new Date(), stateBy: user.id }).where(eq(outreachMeetings.id, id));
  await logActivity({ actorUserId: user.id, action: `meet.${to}`, targetType: "outreach_meeting", targetId: id, before: { state: before.state }, after: { state: to } });
  revalidatePath("/admin/meet");
  return { ok: STATES[to] };
}

/** Owner: add Starbucks locations for a city — one per line, "Name | Address". */
export async function addMeetSpots(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const city = String(form.get("city") ?? "");
  if (!(MEET_CITIES as readonly string[]).includes(city)) return { error: "Choose a city." };
  const lines = String(form.get("lines") ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 50);
  const rows: { city: string; name: string; address: string }[] = [];
  for (const l of lines) {
    const [a, ...rest] = l.split("|");
    const address = rest.join("|").trim();
    let name = a.trim();
    if (!name || !address) return { error: `Use "Name | Address" on every line: ${l.slice(0, 60)}` };
    if (!/starbucks/i.test(name)) name = `Starbucks · ${name}`;
    rows.push({ city, name: name.slice(0, 120), address: address.slice(0, 200) });
  }
  if (!rows.length) return { error: "Paste at least one location." };
  await db.insert(meetSpots).values(rows);
  await logActivity({ actorUserId: user.id, action: "meet.spots_added", targetType: "meet_spots", after: { city, count: rows.length } });
  revalidatePath("/admin/meet");
  return { ok: `Added ${rows.length} location${rows.length === 1 ? "" : "s"} in ${city}.` };
}

/** Owner: take a Starbucks off the list (meetings already booked there keep their copy of the address). */
export async function removeMeetSpot(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return { error: "Not found." };
  const [row] = await db.update(meetSpots).set({ active: false }).where(and(eq(meetSpots.id, id), eq(meetSpots.active, true))).returning();
  if (!row) return { error: "Already removed." };
  await logActivity({ actorUserId: user.id, action: "meet.spot_removed", targetType: "meet_spots", targetId: String(id), before: { name: row.name, city: row.city } });
  revalidatePath("/admin/meet");
  return { ok: "Removed." };
}
