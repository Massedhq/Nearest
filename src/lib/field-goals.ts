import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getSettings } from "./settings";

/**
 * Field team goals (2026-11-26, owner) — for ALL of Nearest, not per team.
 * Pop-ups: field.popups_per_month (4) a month, any mix of vendor events we join and our own. A pop-up counts when it's
 * Confirmed or Done in that month (by its date); Planned ones are "in the works".
 * Video educators: field.educators_total (4) in all. One counts only when the agreement is signed AND the video is
 * uploaded (educator_contracts.status = 'uploaded'). Once a goal is met the daily plan stops sending that kind of task
 * and assistants can't add more.
 */
export type Goals = {
  month: string; // "November"
  popups: { goal: number; done: number; planned: number; met: boolean; full: boolean };
  educators: { goal: number; done: number; working: number; met: boolean };
  minHours: number;
  idleReset: number;
};

/** Central month bounds for a date ("YYYY-MM"). */
const monthOf = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: "America/Chicago" }).slice(0, 7);

export async function popupMonthCount(month: string) {
  const r = (await db.execute(sql`select
      count(*) filter (where status in ('confirmed','done'))::int as done,
      count(*) filter (where status = 'planned')::int as planned
    from field_popups where to_char(starts_at at time zone 'America/Chicago', 'YYYY-MM') = ${month}`)).rows[0] as { done: number; planned: number };
  return { done: Number(r?.done ?? 0), planned: Number(r?.planned ?? 0) };
}

export async function fieldGoals(now = new Date()): Promise<Goals> {
  const s = await getSettings();
  const month = monthOf(now);
  const pGoal = Math.max(0, Number(s["field.popups_per_month"] ?? 4));
  const eGoal = Math.max(0, Number(s["field.educators_total"] ?? 4));
  const p = await popupMonthCount(month);
  const e = (await db.execute(sql`select
      (select count(distinct educator_id)::int from educator_contracts where status = 'uploaded') as done,
      (select count(*)::int from educators ed where ed.status not in ('no')
         and not exists (select 1 from educator_contracts c where c.educator_id = ed.id and c.status = 'uploaded')) as working`)).rows[0] as { done: number; working: number };
  const eDone = Number(e?.done ?? 0);
  return {
    month: now.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "long" }),
    popups: { goal: pGoal, done: p.done, planned: p.planned, met: p.done >= pGoal, full: p.done + p.planned >= pGoal },
    educators: { goal: eGoal, done: eDone, working: Number(e?.working ?? 0), met: eDone >= eGoal },
    minHours: Math.max(1, Number(s["field.min_hours"] ?? 4)),
    idleReset: Math.max(15, Number(s["field.idle_reset_minutes"] ?? 60)),
  };
}

/** Monthly check used when a pop-up is added: is the month of that date already full? */
export async function popupMonthFull(at: Date) {
  const s = await getSettings();
  const goal = Math.max(0, Number(s["field.popups_per_month"] ?? 4));
  const c = await popupMonthCount(monthOf(at));
  return { full: c.done + c.planned >= goal, goal, ...c, month: at.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "long" }) };
}

/**
 * Real work happened (anything saved): the open time since the last save counts as worked.
 * Called from logActivity for every saved change, and from training ticks. No row = not an assistant = nothing to do.
 */
export async function bankWork(userId: string | null) {
  if (!userId) return;
  const today = sql`to_char(now() at time zone 'America/Chicago', 'YYYY-MM-DD')`;
  const open = await db.execute(sql`select 1 from field_presence where user_id = ${userId} and day = ${today} and pending > 0 limit 1`);
  if (!open.rows.length) return;
  const s = await getSettings();
  const reset = Math.max(15, Number(s["field.idle_reset_minutes"] ?? 60));
  // Open time older than the reset was already "nothing done" — it goes to idle, not worked.
  await db.execute(sql`update field_presence set
      minutes = minutes + case when pending_since >= now() - make_interval(mins => ${reset}) then pending else 0 end,
      idle = idle + case when pending_since < now() - make_interval(mins => ${reset}) then pending else 0 end,
      pending = 0, pending_since = null
    where user_id = ${userId} and day = ${today} and pending > 0`);
}

/** One open minute (from pingPresence). */
export async function recordPing(userId: string, day: string) {
  const s = await getSettings();
  const reset = Math.max(15, Number(s["field.idle_reset_minutes"] ?? 60));
  await db.execute(sql`insert into field_presence (user_id, day, minutes, pending, pending_since, idle, first_at, last_at) values (${userId}, ${day}, 0, 1, now(), 0, now(), now())
    on conflict (user_id, day) do update set
      idle = field_presence.idle + case when field_presence.pending_since < now() - make_interval(mins => ${reset}) then field_presence.pending else 0 end,
      pending = case when field_presence.pending_since < now() - make_interval(mins => ${reset}) then 1 else field_presence.pending + 1 end,
      pending_since = case when field_presence.pending_since is null or field_presence.pending_since < now() - make_interval(mins => ${reset}) then now() else field_presence.pending_since end,
      last_at = now()
    where field_presence.last_at < now() - interval '50 seconds'`);
}
