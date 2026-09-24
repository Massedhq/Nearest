import "server-only";
import { and, eq, gt, inArray, lt, or } from "drizzle-orm";
import { db, proHours, proBlocks, proOpenings, bookings, modelCalls, professionalProfiles } from "@/db";
import { getSettings } from "./settings";
import { chicagoNow, chicagoToUtc, toMinutes } from "./time";

const pad = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function nextDays(n: number) {
  const out: string[] = [];
  const start = new Date(`${chicagoNow().date}T12:00:00Z`);
  for (let i = 0; i < n; i++) out.push(new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10));
  return out;
}

/** Start times ("HH:MM", Chicago) a student can book for this pro, service length and day. Applies every booking rule. */
export async function openSlots(proId: string, durationMin: number, day: string): Promise<string[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return [];
  const profile = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, proId) });
  if (!profile || profile.vacationMode) return [];
  const s = await getSettings();
  const now = chicagoNow();
  const isToday = day === now.date;
  if (day < now.date) return [];

  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const windows = await db.select().from(proHours).where(and(eq(proHours.userId, proId), eq(proHours.weekday, weekday)));

  // Candidate starts every 30 minutes inside each window, where the whole service fits.
  const starts = new Set<number>();
  for (const w of windows) {
    for (let m = toMinutes(w.startTime); m + durationMin <= toMinutes(w.endTime); m += 30) starts.add(m);
  }

  if (isToday) {
    // Same day: only times the pro posted as openings, before the cutoff, with enough notice.
    if (now.minutes >= toMinutes(String(s["booking.same_day_cutoff"]))) return [];
    const minStart = now.minutes + Number(s["booking.same_day_min_notice_hours"]) * 60;
    const posted = new Set((await db.select().from(proOpenings).where(and(eq(proOpenings.userId, proId), eq(proOpenings.day, day)))).map((o) => toMinutes(o.startTime)));
    starts.clear();
    for (const m of posted) if (m >= minStart) starts.add(m);
  }

  const dayStart = chicagoToUtc(day, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 30 * 3600000); // covers DST days
  const [taken, blocks, calls] = await Promise.all([
    db.select({ s: bookings.startsAt, e: bookings.endsAt }).from(bookings).where(and(
      eq(bookings.proId, proId), lt(bookings.startsAt, dayEnd), gt(bookings.endsAt, dayStart),
      or(inArray(bookings.status, ["confirmed", "completed"]), and(eq(bookings.status, "pending_payment"), gt(bookings.holdExpiresAt, new Date()))),
    )),
    db.select({ s: proBlocks.startsAt, e: proBlocks.endsAt }).from(proBlocks).where(and(eq(proBlocks.userId, proId), lt(proBlocks.startsAt, dayEnd), gt(proBlocks.endsAt, dayStart))),
    db.select({ s: modelCalls.startsAt, d: modelCalls.durationMin }).from(modelCalls).where(and(eq(modelCalls.userId, proId), inArray(modelCalls.status, ["open", "full"]), lt(modelCalls.startsAt, dayEnd), gt(modelCalls.startsAt, new Date(dayStart.getTime() - 12 * 3600000)))),
  ]);
  const busy = [
    ...taken.map((b) => [b.s.getTime(), b.e.getTime()]),
    ...blocks.map((b) => [b.s.getTime(), b.e.getTime()]),
    ...calls.map((c) => [c.s.getTime(), c.s.getTime() + c.d * 60000]),
  ];

  const earliest = Date.now() + (isToday ? 0 : Number(s["booking.advance_hours"]) * 3600000);
  const out: string[] = [];
  for (const m of [...starts].sort((a, b) => a - b)) {
    const start = chicagoToUtc(day, pad(m)).getTime();
    const end = start + durationMin * 60000;
    if (start < earliest) continue;
    if (busy.some(([bs, be]) => start < be && end > bs)) continue;
    out.push(pad(m));
  }
  return out;
}
