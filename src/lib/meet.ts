import "server-only";
import { and, asc, eq, gte, inArray, lte, ne, or, sql } from "drizzle-orm";
import { db, meetSpots, outreachMeetings } from "@/db";
import { chicagoNow, chicagoToUtc, label12, toMinutes, fmtDate } from "./time";

/**
 * Meet the Director of Outreach (/meet) — professionals book a 30-minute, in-person meeting with Avy.
 *
 * Rules (numbers live in Rules & Settings → Outreach meetings):
 *  - City first; only MEET_CITIES. 5 spots per specialty per city (a friend takes a spot in their specialty too).
 *  - Start times run from first_time, one meeting + travel apart (9:00, 10:15, 11:30…), restart after the break
 *    (no meetings 12–1), and the last start time (7:00 PM) is always offered. No meetings on the day off (Monday).
 *  - Every meeting needs travel_minutes (45) clear before the next one, in any city — times that conflict disappear.
 *  - If Avy already has meetings in that city, the same day is offered first (next open time after them).
 *  - A booking can't be changed. A missed meeting (owner marks no-show) blocks that email and phone from booking again.
 */

export const MEET_HOST = { name: "Avy Evans", title: "Director of Outreach" };
export const MEET_CITIES = ["Lewisville", "Flower Mound", "The Colony", "Highland Village", "Double Oak", "Copper Canyon", "Bartonville", "Carrollton", "Coppell", "Frisco"] as const;
export const SPECIALTIES = { nails: "Nail tech", lashes: "Lash artist", hair: "Hairstylist", barber: "Barber" } as const;
export const STATUSES = { licensed: "Licensed", in_school: "In school", self_taught: "Self-taught" } as const;
export type Specialty = keyof typeof SPECIALTIES;
export type ProStatus = keyof typeof STATUSES;
export const ACTIVE_STATES = ["booked", "showed"] as const; // hold a spot
const BLOCKING_STATES = ["booked", "showed", "no_show"]; // hold the time

export const normPhone = (p: string) => p.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
export const normEmail = (e: string) => e.trim().toLowerCase();

export async function meetSettings() {
  const s = await (await import("./settings")).getSettings();
  const n = (k: string, d: number) => { const v = Number(s[k]); return Number.isFinite(v) ? v : d; };
  const t = (k: string, d: string) => (typeof s[k] === "string" && /^\d{1,2}:\d{2}$/.test(String(s[k])) ? String(s[k]).padStart(5, "0") : d);
  return {
    meeting: Math.max(10, n("meet.meeting_minutes", 30)),
    travel: Math.max(0, n("meet.travel_minutes", 45)),
    first: t("meet.first_time", "09:00"),
    last: t("meet.last_time", "19:00"),
    breakStart: t("meet.break_start", "12:00"),
    breakEnd: t("meet.break_end", "13:00"),
    dayOff: Math.round(n("meet.day_off", 1)),
    daysAhead: Math.min(90, Math.max(1, Math.round(n("meet.days_ahead", 21)))),
    notice: Math.max(0, n("meet.min_notice_hours", 3)),
    spots: Math.max(1, Math.round(n("meet.spots_per_specialty", 5))),
  };
}
export type MeetCfg = Awaited<ReturnType<typeof meetSettings>>;

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** The day's possible start times: 9:00, 10:15, 11:30, (break) 1:00, 2:15 … and always the last start time. */
export function candidateTimes(c: Pick<MeetCfg, "meeting" | "travel" | "first" | "last" | "breakStart" | "breakEnd">): string[] {
  const step = c.meeting + c.travel;
  const first = toMinutes(c.first), last = toMinutes(c.last), bs = toMinutes(c.breakStart), be = toMinutes(c.breakEnd);
  const out: number[] = [];
  let m = first;
  while (m <= last) {
    const inBreak = bs < be && m < be && m + c.meeting > bs;
    if (inBreak) { m = Math.max(m, be); continue; }
    out.push(m);
    m += step;
  }
  if (!out.includes(last) && !(bs < be && last < be && last + c.meeting > bs)) out.push(last);
  return out.sort((a, b) => a - b).map(hhmm);
}

/** A start time is open when every other meeting that day leaves the travel time free on both sides. */
export function isOpen(start: number, taken: { s: number; e: number }[], c: Pick<MeetCfg, "meeting" | "travel">) {
  const end = start + c.meeting;
  return taken.every((b) => start >= b.e + c.travel || end + c.travel <= b.s);
}

const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const weekday = (date: string) => { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

type Booked = { id: string; city: string; s: number; e: number; date: string };

async function bookedBetween(fromUtc: Date, toUtc: Date): Promise<Booked[]> {
  const rows = await db.select({ id: outreachMeetings.id, city: outreachMeetings.city, startsAt: outreachMeetings.startsAt, endsAt: outreachMeetings.endsAt })
    .from(outreachMeetings).where(and(inArray(outreachMeetings.state, BLOCKING_STATES), gte(outreachMeetings.startsAt, fromUtc), lte(outreachMeetings.startsAt, toUtc)));
  return rows.map((r) => {
    const a = chicagoNow(r.startsAt), b = chicagoNow(r.endsAt);
    return { id: r.id, city: r.city, date: a.date, s: a.minutes, e: b.date === a.date ? b.minutes : 24 * 60 };
  });
}

export async function spotsLeft(city: string, cfg?: MeetCfg) {
  const c = cfg ?? (await meetSettings());
  const rows = await db.select({ sp: outreachMeetings.specialty, fsp: outreachMeetings.friendSpecialty }).from(outreachMeetings)
    .where(and(eq(outreachMeetings.city, city), inArray(outreachMeetings.state, [...ACTIVE_STATES])));
  const taken: Record<string, number> = {};
  for (const r of rows) {
    taken[r.sp] = (taken[r.sp] ?? 0) + 1;
    if (r.fsp) taken[r.fsp] = (taken[r.fsp] ?? 0) + 1;
  }
  return Object.fromEntries((Object.keys(SPECIALTIES) as Specialty[]).map((k) => [k, Math.max(0, c.spots - (taken[k] ?? 0))])) as Record<Specialty, number>;
}

export type MeetDay = { date: string; label: string; slots: { time: string; label: string }[]; inCity: boolean };

/** Every bookable day and time in the window, plus the same-day suggestion for this city. */
export async function availability(city: string, now = new Date()) {
  const cfg = await meetSettings();
  const today = chicagoNow(now).date;
  const dates = Array.from({ length: cfg.daysAhead + 1 }, (_, i) => addDays(today, i));
  const booked = await bookedBetween(chicagoToUtc(today, "00:00"), chicagoToUtc(addDays(today, cfg.daysAhead + 1), "00:00"));
  const earliest = now.getTime() + cfg.notice * 3600 * 1000;
  const cands = candidateTimes(cfg);
  const days: MeetDay[] = [];
  for (const date of dates) {
    if (weekday(date) === cfg.dayOff) continue;
    const taken = booked.filter((b) => b.date === date);
    const slots = cands
      .filter((t) => chicagoToUtc(date, t).getTime() >= earliest && isOpen(toMinutes(t), taken, cfg))
      .map((t) => ({ time: t, label: label12(t) }));
    const label = fmtDate(chicagoToUtc(date, "12:00"), { weekday: "long", month: "long", day: "numeric" });
    days.push({ date, label, slots, inCity: taken.some((b) => b.city === city) });
  }
  // Same-day first: the earliest day Avy is already in this city with an open time — the first open time after her
  // last meeting there that day (or the first open time that day).
  let suggestion: { date: string; time: string; label: string } | null = null;
  for (const d of days) {
    if (!d.inCity || !d.slots.length) continue;
    const lastHere = Math.max(...booked.filter((b) => b.date === d.date && b.city === city).map((b) => b.e));
    const pick = d.slots.find((s) => toMinutes(s.time) >= lastHere) ?? d.slots[0];
    suggestion = { date: d.date, time: pick.time, label: `${d.label} at ${pick.label}` };
    break;
  }
  const [spots, starbucks] = await Promise.all([
    spotsLeft(city, cfg),
    db.select({ id: meetSpots.id, name: meetSpots.name, address: meetSpots.address }).from(meetSpots)
      .where(and(eq(meetSpots.city, city), eq(meetSpots.active, true))).orderBy(asc(meetSpots.name)),
  ]);
  return { days: days.filter((d) => d.slots.length), suggestion, spots, spotsTotal: cfg.spots, starbucks, meetingMinutes: cfg.meeting, travelMinutes: cfg.travel, dayOff: cfg.dayOff, lastLabel: label12(cfg.last) };
}

export type BookInput = {
  city: string; specialty: string; proStatus: string; homeBased: boolean;
  date: string; time: string;
  locationType: string; address?: string; suite?: string; zip?: string; locationNotes?: string; spotId?: number | null;
  legalFirst: string; legalLast: string; businessName?: string; phone: string; email: string;
  photo: { url: string; access: string };
  friend?: { first: string; last: string; specialty: string; status: string; contact: string; photo: { url: string; access: string } } | null;
  agreed: boolean; ip?: string | null;
};

const clean = (s: string | undefined | null, max = 120) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Checks everything a booking must satisfy (except the photos, which the route checks). Returns an error or null. */
export async function bookingProblem(i: BookInput): Promise<string | null> {
  if (!(MEET_CITIES as readonly string[]).includes(i.city)) return "Choose your city first.";
  if (!(i.specialty in SPECIALTIES)) return "Choose your specialty.";
  if (!(i.proStatus in STATUSES)) return "Choose licensed, in school or self-taught.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date) || !/^\d{2}:\d{2}$/.test(i.time)) return "Choose a day and time.";
  if (!clean(i.legalFirst) || !clean(i.legalLast)) return "Enter your legal first and last name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(i.email.trim())) return "Enter a valid email.";
  if (normPhone(i.phone).length !== 10) return "Enter a 10-digit phone number.";
  if (i.locationType === "their_place") {
    if (!clean(i.address)) return "Enter the address where we'll meet.";
    if (!/^\d{5}$/.test(clean(i.zip))) return "Enter a 5-digit ZIP code.";
  } else if (i.locationType === "starbucks") {
    if (!i.spotId) return "Choose a Starbucks.";
    const s = await db.query.meetSpots.findFirst({ where: and(eq(meetSpots.id, i.spotId), eq(meetSpots.city, i.city), eq(meetSpots.active, true)) });
    if (!s) return "That Starbucks isn't on the list for your city. Choose another.";
  } else return "Choose where we'll meet.";
  if (i.friend) {
    if (!clean(i.friend.first) || !clean(i.friend.last)) return "Enter your friend's legal first and last name.";
    if (!(i.friend.specialty in SPECIALTIES)) return "Your friend must be a nail tech, lash artist, hairstylist or barber.";
    if (!(i.friend.status in STATUSES)) return "Choose licensed, in school or self-taught for your friend.";
    if (!clean(i.friend.contact)) return "Enter your friend's phone or email.";
  }
  if (!i.agreed) return "Check the box to confirm you'll keep this meeting.";

  // Missed a meeting before → can't book again. Already booked → can't book a second one (bookings can't change).
  const email = normEmail(i.email), phone = normPhone(i.phone);
  const past = await db.select({ state: outreachMeetings.state, startsAt: outreachMeetings.startsAt }).from(outreachMeetings)
    .where(and(or(eq(outreachMeetings.email, email), eq(outreachMeetings.phoneNorm, phone)), ne(outreachMeetings.state, "cancelled")));
  if (past.some((p) => p.state === "no_show")) return "Because a past meeting was missed, booking isn't available for you.";
  if (past.some((p) => p.state === "booked" && p.startsAt.getTime() > Date.now())) return "You already have a meeting booked. Bookings can't be changed — see you then!";

  const cfg = await meetSettings();
  const spots = await spotsLeft(i.city, cfg);
  const need: Record<string, number> = { [i.specialty]: 1 };
  if (i.friend) need[i.friend.specialty] = (need[i.friend.specialty] ?? 0) + 1;
  for (const [k, n] of Object.entries(need)) {
    if ((spots[k as Specialty] ?? 0) < n) return `${SPECIALTIES[k as Specialty]} spots in ${i.city} are full${i.friend && k === i.friend.specialty && k !== i.specialty ? " for your friend" : ""}.`;
  }
  const av = await availability(i.city);
  if (!av.days.some((d) => d.date === i.date && d.slots.some((s) => s.time === i.time))) return "That time was just taken. Please choose another.";
  return null;
}

/** Saves the booking, then makes sure nobody else grabbed an overlapping time or the last spot at the same moment. */
export async function createMeeting(i: BookInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const problem = await bookingProblem(i);
  if (problem) return { ok: false, error: problem };
  const cfg = await meetSettings();
  const startsAt = chicagoToUtc(i.date, i.time);
  const endsAt = new Date(startsAt.getTime() + cfg.meeting * 60000);
  const spot = i.locationType === "starbucks" && i.spotId ? await db.query.meetSpots.findFirst({ where: eq(meetSpots.id, i.spotId) }) : null;
  const [row] = await db.insert(outreachMeetings).values({
    city: i.city, specialty: i.specialty, proStatus: i.proStatus, homeBased: i.homeBased, startsAt, endsAt,
    locationType: i.locationType,
    address: i.locationType === "their_place" ? clean(i.address, 200) : null,
    suite: i.locationType === "their_place" ? clean(i.suite, 40) || null : null,
    zip: i.locationType === "their_place" ? clean(i.zip, 5) : null,
    locationNotes: i.locationType === "their_place" ? clean(i.locationNotes, 300) || null : null,
    spotId: spot?.id ?? null, spotLabel: spot ? `${spot.name} — ${spot.address}` : null,
    legalFirst: clean(i.legalFirst, 60), legalLast: clean(i.legalLast, 60), businessName: clean(i.businessName, 120) || null,
    phone: clean(i.phone, 30), phoneNorm: normPhone(i.phone), email: normEmail(i.email),
    photo: i.photo.url, photoAccess: i.photo.access,
    friendFirst: i.friend ? clean(i.friend.first, 60) : null, friendLast: i.friend ? clean(i.friend.last, 60) : null,
    friendSpecialty: i.friend?.specialty ?? null, friendStatus: i.friend?.status ?? null, friendContact: i.friend ? clean(i.friend.contact, 120) : null,
    friendPhoto: i.friend?.photo.url ?? null, friendPhotoAccess: i.friend?.photo.access ?? null,
    agreedAt: new Date(), ip: i.ip ?? null,
  }).returning({ id: outreachMeetings.id, createdAt: outreachMeetings.createdAt });

  // Race check: an overlapping meeting (incl. travel) or an over-full specialty saved at the same moment —
  // the booking saved first keeps it; this one is removed.
  const earlier = sql`(${outreachMeetings.createdAt} < ${row.createdAt} or (${outreachMeetings.createdAt} = ${row.createdAt} and ${outreachMeetings.id} < ${row.id}))`;
  const clash = await db.select({ id: outreachMeetings.id }).from(outreachMeetings).where(and(
    ne(outreachMeetings.id, row.id), inArray(outreachMeetings.state, BLOCKING_STATES), earlier,
    sql`${outreachMeetings.startsAt} < ${new Date(endsAt.getTime() + cfg.travel * 60000)} and ${outreachMeetings.endsAt} > ${new Date(startsAt.getTime() - cfg.travel * 60000)}`,
  )).limit(1);
  let full = false;
  if (!clash.length) {
    const before = await db.select({ sp: outreachMeetings.specialty, fsp: outreachMeetings.friendSpecialty }).from(outreachMeetings)
      .where(and(ne(outreachMeetings.id, row.id), eq(outreachMeetings.city, i.city), inArray(outreachMeetings.state, [...ACTIVE_STATES]), earlier));
    const count = (k: string) => before.filter((b) => b.sp === k).length + before.filter((b) => b.fsp === k).length;
    const mine = [i.specialty, ...(i.friend ? [i.friend.specialty] : [])];
    full = mine.some((k) => count(k) + mine.filter((x) => x === k).length > cfg.spots);
  }
  if (clash.length || full) {
    await db.delete(outreachMeetings).where(eq(outreachMeetings.id, row.id));
    return { ok: false, error: clash.length ? "That time was just taken. Please choose another." : "Those spots were just filled. Please check again." };
  }
  return { ok: true, id: row.id };
}

export const whereLabel = (m: { locationType: string; address: string | null; suite: string | null; zip: string | null; spotLabel: string | null; city: string }) =>
  m.locationType === "starbucks" ? (m.spotLabel ?? "Starbucks") : `${[m.address, m.suite].filter(Boolean).join(", ")}, ${m.city} ${m.zip ?? ""}`.trim();

/** Emails the professional (and owner bell + email) after a booking. Never throws. */
export async function announceMeeting(id: string) {
  try {
    const m = await db.query.outreachMeetings.findFirst({ where: eq(outreachMeetings.id, id) });
    if (!m) return;
    const when = `${fmtDate(m.startsAt, { weekday: "long", month: "long", day: "numeric" })} at ${m.startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}`;
    const where = m.locationType === "starbucks" ? (m.spotLabel ?? "Starbucks") : `Your location in ${m.city}`;
    const { sendEmail } = await import("./email");
    await sendEmail({
      to: m.email, subject: `You're booked with ${MEET_HOST.name} — ${when}`, eyebrow: `Nearest · ${MEET_HOST.title}`,
      heading: `See you ${fmtDate(m.startsAt, { weekday: "long" })}, ${m.legalFirst}.`,
      lines: [
        `When: ${when} (30 minutes).`, `Where: ${where}.`,
        ...(m.friendFirst ? [`Bringing: ${m.friendFirst} ${m.friendLast} (${SPECIALTIES[m.friendSpecialty as Specialty] ?? ""}).`] : []),
        "Bring your phone with photos of your best work, your prices, and your license or school info if you have it.",
        "This booking can't be changed. If the meeting is missed, booking won't be available again.",
      ],
    });
    const { mainOwnerId } = await import("./partner");
    const host = await mainOwnerId();
    if (host) {
      const { notifyAdmins } = await import("./outreach");
      await notifyAdmins({ kind: "meet_booked", title: `New meeting: ${m.legalFirst} ${m.legalLast} · ${SPECIALTIES[m.specialty as Specialty]} · ${m.city}`, body: `${when}${m.friendFirst ? ` + friend (${SPECIALTIES[m.friendSpecialty as Specialty]})` : ""}`, href: `/admin/meet#m-${m.id}` }, [host]);
      const hostUser = await db.query.users.findFirst({ where: (u, { eq: e }) => e(u.id, host), columns: { email: true } });
      await sendEmail({
        to: hostUser?.email, subject: `New meeting: ${m.legalFirst} ${m.legalLast} — ${m.city}, ${when}`, eyebrow: "Outreach meetings",
        heading: `${m.legalFirst} ${m.legalLast} booked ${when}.`,
        lines: [
          `${SPECIALTIES[m.specialty as Specialty]} · ${STATUSES[m.proStatus as ProStatus]} · ${m.homeBased ? "home-based" : "not home-based"}${m.businessName ? ` · ${m.businessName}` : ""}`,
          `Where: ${whereLabel(m)}`, `Phone: ${m.phone} · Email: ${m.email}`,
          ...(m.friendFirst ? [`Friend: ${m.friendFirst} ${m.friendLast} · ${SPECIALTIES[m.friendSpecialty as Specialty]} · ${STATUSES[m.friendStatus as ProStatus]} · ${m.friendContact}`] : []),
        ],
        button: { label: "Open outreach meetings", url: `${process.env.APP_URL || "https://www.usenearest.com"}/admin/meet` },
      });
    }
  } catch (e) { console.error("meet announce", e); }
}
