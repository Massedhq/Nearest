import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, fieldTasks, fieldTaskCalls, teamAssistants, users, fieldPresence, fieldPlanSettings } from "@/db";

/**
 * Field tasks (2026-11-23) — queries and notifications. See fieldTasks in schema.ts for the status flow.
 * scope = the owner the work belongs to (null = every owner, main owner only).
 */
export const TASK_STATUS: Record<string, [string, string]> = {
  todo: ["todo", "To do"], work: ["work", "Working on it"], needs: ["needs", "Sent to owner"], done: ["done", "Done — waiting approval"], approved: ["ok", "Approved"], back: ["no", "Sent back"],
};
export const OUTCOMES = ["Interested", "Drop-off booked", "Meeting booked", "Pop-up possible", "Call back", "No answer / voicemail", "Not interested", "Left info / email sent"];
export const HOW = { call: "Call", email: "Email", text: "Text", visit: "Visit" } as Record<string, string>;

export const centralToday = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: "America/Chicago" });
export const centralHour = (d = new Date()) => Number(d.toLocaleString("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false })) % 24;
export const centralWeekday = (d = new Date()) => d.toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "short" });
export const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const dayLabel = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

export type TaskRow = typeof fieldTasks.$inferSelect & { calls: (typeof fieldTaskCalls.$inferSelect)[]; ownerName: string | null };

export async function tasksFor(scope: string | null, opts: { from?: string; to?: string; status?: string[]; templates?: boolean } = {}): Promise<TaskRow[]> {
  const w = [scope ? eq(fieldTasks.ownerId, scope) : sql`true`];
  if (opts.from) w.push(sql`${fieldTasks.dueDate} >= ${opts.from}`);
  if (opts.to) w.push(sql`${fieldTasks.dueDate} <= ${opts.to}`);
  if (opts.status?.length) w.push(inArray(fieldTasks.status, opts.status));
  w.push(opts.templates ? eq(fieldTasks.repeat, "weekdays") : eq(fieldTasks.repeat, "once"));
  const rows = await db.select({ t: fieldTasks, ownerName: users.firstName }).from(fieldTasks).leftJoin(users, eq(users.id, fieldTasks.ownerId)).where(and(...w))
    .orderBy(asc(fieldTasks.dueDate), sql`${fieldTasks.priority} = 'high' desc`, asc(fieldTasks.dueTime), asc(fieldTasks.createdAt)).limit(400);
  const ids = rows.map((r) => r.t.id);
  const calls = ids.length ? await db.select().from(fieldTaskCalls).where(inArray(fieldTaskCalls.taskId, ids)).orderBy(asc(fieldTaskCalls.at)) : [];
  return rows.map((r) => ({ ...r.t, ownerName: r.ownerName, calls: calls.filter((c) => c.taskId === r.t.id) }));
}

export async function taskById(id: string): Promise<TaskRow | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [r] = await db.select({ t: fieldTasks, ownerName: users.firstName }).from(fieldTasks).leftJoin(users, eq(users.id, fieldTasks.ownerId)).where(eq(fieldTasks.id, id)).limit(1);
  if (!r) return null;
  const calls = await db.select().from(fieldTaskCalls).where(eq(fieldTaskCalls.taskId, id)).orderBy(asc(fieldTaskCalls.at));
  return { ...r.t, ownerName: r.ownerName, calls };
}

/** Recent completed reports (newest first) for the owner's Reports page. */
export async function reportsFor(scope: string | null, limit = 60) {
  const rows = await db.select({ t: fieldTasks, ownerName: users.firstName }).from(fieldTasks).leftJoin(users, eq(users.id, fieldTasks.ownerId))
    .where(and(scope ? eq(fieldTasks.ownerId, scope) : sql`true`, inArray(fieldTasks.status, ["done", "approved"]))).orderBy(desc(fieldTasks.doneAt)).limit(limit);
  const ids = rows.map((r) => r.t.id);
  const calls = ids.length ? await db.select().from(fieldTaskCalls).where(inArray(fieldTaskCalls.taskId, ids)).orderBy(asc(fieldTaskCalls.at)) : [];
  return rows.map((r) => ({ ...r.t, ownerName: r.ownerName, calls: calls.filter((c) => c.taskId === r.t.id) }));
}

/** The owner's active assistants (for notifications and the "see her screen" list). */
export async function assistantsOf(ownerId: string) {
  return db.select({ id: teamAssistants.id, userId: teamAssistants.userId, name: teamAssistants.name, email: teamAssistants.email })
    .from(teamAssistants).where(and(eq(teamAssistants.ownerId, ownerId), eq(teamAssistants.status, "active")));
}

const APP = () => process.env.APP_URL || "https://usenearest.com";

/** Tell the owner (bell + email). */
export async function tellOwnerTask(ownerId: string, title: string, body: string, href = "/admin/field/tasks") {
  const { notifyAdmins } = await import("@/lib/outreach");
  await notifyAdmins({ kind: "field", title, body, href }, [ownerId]).catch(() => undefined);
  const o = await db.query.users.findFirst({ where: eq(users.id, ownerId), columns: { email: true } });
  const { sendEmail } = await import("@/lib/email");
  await sendEmail({ to: o?.email, subject: title, eyebrow: "Field team", heading: title, lines: [body], button: { label: "Open it", url: `${APP()}${href}` } }).catch(() => undefined);
}

/** Tell the owner's assistants (in-app notice + email). */
export async function tellAssistants(ownerId: string, title: string, body: string, href = "/outreach") {
  const { inbox } = await import("@/lib/inbox");
  const { sendEmail } = await import("@/lib/email");
  for (const a of await assistantsOf(ownerId)) {
    await inbox(a.userId, { kind: "field", title, body, href });
    await sendEmail({ to: a.email, subject: title, eyebrow: "Field team", heading: title, lines: [body], button: { label: "Open Field team", url: `${APP()}${href}` } }).catch(() => undefined);
  }
}

/** Minutes worked today (from page pings) for each assistant user. */
export async function minutesToday(userIds: string[]) {
  if (!userIds.length) return new Map<string, number>();
  const rows = await db.select().from(fieldPresence).where(and(inArray(fieldPresence.userId, userIds), eq(fieldPresence.day, centralToday())));
  return new Map(rows.map((r) => [r.userId, r.minutes]));
}

export async function planSettings(ownerId: string) {
  const s = await db.query.fieldPlanSettings.findFirst({ where: eq(fieldPlanSettings.ownerId, ownerId) });
  return { on: s?.on ?? true, hour: s?.hour ?? 7, hours: s?.hours ?? 4, lastPlanDate: s?.lastPlanDate ?? null };
}

export const hourLabel = (h: number) => `${h % 12 || 12}:00 ${h < 12 ? "AM" : "PM"}`;
