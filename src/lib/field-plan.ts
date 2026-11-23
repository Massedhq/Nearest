import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, fieldTasks, fieldPlanSettings, teamAssistants, adminMembers, fieldTraining, educators } from "@/db";
import { recruitNext, upcoming, cardSupply } from "./field";
import { LESSONS } from "./training";
import { assistantsOf, centralToday, centralHour, centralWeekday, planSettings, tellAssistants, tellOwnerTask, hourLabel } from "./field-tasks";

/**
 * Daily AI plan (2026-11-23). Each weekday at the owner's send hour (Central) the plan builds the assistant's day
 * (about `hours` of work): copies the owner's repeating tasks, then adds tasks from real data in the owner's area —
 * student votes with no live professional, call-backs due from recent reports, drop-offs and pop-ups coming up, card
 * supply left, video educators in progress and the next training lesson. With ANTHROPIC_API_KEY the AI words and
 * orders them; without it the same data makes a rule-based plan. Sends the plan to the assistant and a copy to the owner.
 */
type PlanTask = { title: string; why: string; steps: string[]; kind: string; time: string };

async function context(ownerId: string) {
  const [votes, soon, supply] = await Promise.all([recruitNext(ownerId, 12), upcoming(ownerId), cardSupply(ownerId)]);
  const callbacks = (await db.execute(sql`select c.org_name as org, c.address, c.person, c.next_step as next, c.outcome
    from field_task_calls c join field_tasks t on t.id = c.task_id
    where t.owner_id = ${ownerId} and c.at > now() - interval '10 days' and c.outcome in ('Call back', 'No answer / voicemail', 'Interested', 'Pop-up possible')
    order by c.at desc limit 8`)).rows as { org: string; address: string; person: string; next: string | null; outcome: string }[];
  const users = (await assistantsOf(ownerId)).map((a) => a.userId).filter(Boolean) as string[];
  const done = users.length ? await db.select({ lesson: fieldTraining.lesson, step: fieldTraining.step }).from(fieldTraining).where(sql`${fieldTraining.userId} in (${sql.join(users.map((u) => sql`${u}`), sql`, `)})`) : [];
  const nextLesson = LESSONS.find((l) => done.filter((d) => d.lesson === l.id).length < l.steps.length) ?? null;
  const edus = await db.select({ name: educators.name, status: educators.status, skill: educators.skill }).from(educators).where(and(eq(educators.ownerId, ownerId), sql`${educators.status} in ('found','talking')`)).limit(5);
  return { votes, soon: soon.slice(0, 6), supply, callbacks, nextLesson, edus };
}

function rulePlan(c: Awaited<ReturnType<typeof context>>, hours: number): PlanTask[] {
  const out: PlanTask[] = [];
  const times = ["9:00 AM", "10:30 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM"];
  const open = c.votes.filter((v) => !v.covered);
  const city = open[0]?.city ?? c.votes[0]?.city;
  if (c.callbacks.length) out.push({ title: `Follow up: ${c.callbacks.slice(0, 3).map((x) => x.org).join(", ")}`, why: "Call-backs from your recent reports.", kind: "calls", time: "", steps: c.callbacks.slice(0, 3).map((x) => `${x.org} — ${x.next || x.outcome}${x.person ? ` (ask for ${x.person})` : ""}`).concat("Log each call in your report") });
  if (city) out.push({ title: `Find and call 5 youth programs in ${city}`, why: open[0] ? `${open[0].city} has ${open[0].votes} student votes for ${open[0].category} and no live professional yet.` : "Spread cards across your area.", kind: "calls", time: "",
    steps: [`Search Google Maps: "youth program ${city}", "rec center ${city}", "church youth ${city}"`, "Call each one and ask for the program manager or teen director", "Offer 10 GRANTED cards for teens 13+ and book a drop-off", "Ask if their space is free or paid for a pro sign-up pop-up", "Log every call in your report"] });
  if (open[1]) out.push({ title: `Find 3 ${open[1].category.toLowerCase()} professionals in ${open[1].city}`, why: `${open[1].votes} students voted for ${open[1].category} in ${open[1].city}.`, kind: "pros", time: "", steps: [`Search Instagram and Google for ${open[1].category.toLowerCase()} in ${open[1].city}`, "Add each one under Professionals and email the sign-up link", "Log who you reached in your report"] });
  out.push({ title: "Find 2 vendor pop-ups in your area", why: "Pop-ups bring professionals to sign up in person.", kind: "popups", time: "", steps: ["Search Facebook Events and Eventbrite for vendor markets this month", "Write down the vendor fee, date, address and host", "Add each under Pop-ups"] });
  if (c.edus.length < 3) out.push({ title: `Find 2 ${(open[0]?.category ?? "lash").toLowerCase()} educators for training videos`, why: "Step-by-step videos for Learn at Nearest.", kind: "edu", time: "", steps: ["Search Instagram, TikTok and YouTube for step-by-step tutorials", "Reach out using the script on Video educators", "Log each one with their price"] });
  if (c.nextLesson) out.push({ title: `Training: ${c.nextLesson.title}`, why: c.nextLesson.why, kind: "training", time: "", steps: ["Open Training", `Work through ${c.nextLesson.title} and tick each step`] });
  const n = Math.max(3, Math.min(6, Math.round(hours * 1.25)));
  return out.slice(0, n).map((t, i) => ({ ...t, time: times[i] ?? "" }));
}

async function aiPlan(c: Awaited<ReturnType<typeof context>>, hours: number, ownerName: string): Promise<PlanTask[] | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const { AI_MODEL } = await import("./outreach-ai");
  const system = `You plan one workday (${hours} hours) for an outreach assistant at Nearest, a platform where verified students book beauty professionals. She works only ${ownerName}'s area. Her jobs: find organizations with youth programs (13+) and book GRANTED card drop-offs (10 cards each); ask about free space for pro sign-up pop-ups; find vendor pop-ups and their fees; find beauty professionals and email them the sign-up link; find educators for paid training videos; prepare ads for approval (never pay); Google Trends research; training lessons. Never contact students directly. Return ONLY a JSON array of 4–6 tasks: {"title": short imperative, "why": one sentence using the numbers given, "steps": 3–5 short steps, "kind": "calls"|"pros"|"popups"|"edu"|"ads"|"training"|"general", "time": "9:00 AM" style start}. Use real cities and numbers from the data. Call-backs first.`;
  const user = JSON.stringify({ studentVotes: c.votes.map((v) => ({ city: v.city, service: v.category, votes: v.votes, thisWeek: v.week, liveProThere: v.covered })), callBacksDue: c.callbacks, comingUp: c.soon.map((s) => ({ kind: s.kind, at: s.at, title: s.title })), cardsLeft: c.supply.reduce((a, s) => a + s.left, 0), educatorsInProgress: c.edus.length, nextTrainingLesson: c.nextLesson?.title ?? null });
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 1800, system, messages: [{ role: "user", content: user }] }), signal: AbortSignal.timeout(25_000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { content?: { type: string; text?: string }[] };
    const text = j.content?.find((x) => x.type === "text")?.text ?? "";
    const arr = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)) as PlanTask[];
    const kinds = ["calls", "pros", "popups", "edu", "ads", "training", "general"];
    const clean = arr.filter((t) => t && typeof t.title === "string" && t.title.trim()).slice(0, 6).map((t) => ({
      title: String(t.title).slice(0, 160), why: String(t.why ?? "").slice(0, 300), steps: (Array.isArray(t.steps) ? t.steps : []).map((s) => String(s).slice(0, 300)).slice(0, 8),
      kind: kinds.includes(t.kind) ? t.kind : "general", time: /^\d{1,2}:\d{2} (AM|PM)$/.test(String(t.time)) ? String(t.time) : "",
    }));
    return clean.length >= 2 ? clean : null;
  } catch { return null; }
}

/** Build and send one owner's plan for a day. Skips a day that already has AI tasks unless `force`. */
export async function makePlan(ownerId: string, day = centralToday(), opts: { force?: boolean; actorId?: string } = {}) {
  const exists = await db.select({ id: fieldTasks.id }).from(fieldTasks).where(and(eq(fieldTasks.ownerId, ownerId), eq(fieldTasks.dueDate, day), eq(fieldTasks.source, "ai"))).limit(1);
  if (exists.length && !opts.force) return { made: 0, skipped: true };
  const s = await planSettings(ownerId);
  // Repeating tasks the owner set ("every weekday") come first.
  const weekday = !["Sat", "Sun"].includes(new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" }));
  let copied = 0;
  if (weekday) {
    const tpl = await db.select().from(fieldTasks).where(and(eq(fieldTasks.ownerId, ownerId), eq(fieldTasks.repeat, "weekdays")));
    for (const t of tpl) {
      const has = await db.select({ id: fieldTasks.id }).from(fieldTasks).where(and(eq(fieldTasks.repeatOf, t.id), eq(fieldTasks.dueDate, day))).limit(1);
      if (has.length) continue;
      await db.insert(fieldTasks).values({ ownerId, assistantId: t.assistantId, title: t.title, why: t.why, steps: t.steps, dueDate: day, dueTime: t.dueTime, priority: t.priority, kind: t.kind, source: t.source === "assistant" ? "assistant" : "owner", repeatOf: t.id, createdBy: t.createdBy });
      copied++;
    }
  }
  const c = await context(ownerId);
  const owner = await db.query.users.findFirst({ where: (u, { eq: e }) => e(u.id, ownerId), columns: { firstName: true } });
  const plan = (await aiPlan(c, s.hours, owner?.firstName ?? "the owner")) ?? rulePlan(c, s.hours);
  if (plan.length) await db.insert(fieldTasks).values(plan.map((t) => ({ ownerId, title: t.title, why: t.why, steps: t.steps, dueDate: day, dueTime: t.time || null, kind: t.kind, source: "ai", createdBy: opts.actorId ?? null })));
  await db.insert(fieldPlanSettings).values({ ownerId, lastPlanDate: day, updatedAt: new Date() }).onConflictDoUpdate({ target: fieldPlanSettings.ownerId, set: { lastPlanDate: day, updatedAt: new Date() } });
  const label = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" });
  const list = plan.map((t) => `• ${t.time ? `${t.time} — ` : ""}${t.title}`).join("\n");
  await tellAssistants(ownerId, `Your plan for ${label} is ready`, `${plan.length + copied} tasks, about ${s.hours} hours:\n${list}`, "/outreach");
  await tellOwnerTask(ownerId, `Today's field plan was sent (${plan.length + copied} tasks)`, `Nearest AI sent your assistant the plan for ${label}:\n${list}`, "/admin/field/tasks");
  return { made: plan.length + copied, skipped: false };
}

/** Cron (every 15 min): each owner with an active assistant gets one plan per weekday at their send hour or later. */
export async function runFieldPlans() {
  const day = centralToday();
  if (["Sat", "Sun"].includes(centralWeekday())) return { plans: 0 };
  const hour = centralHour();
  const owners = await db.selectDistinct({ id: teamAssistants.ownerId }).from(teamAssistants)
    .innerJoin(adminMembers, and(eq(adminMembers.userId, teamAssistants.ownerId), eq(adminMembers.active, true)))
    .where(eq(teamAssistants.status, "active"));
  let plans = 0;
  for (const o of owners) {
    const s = await planSettings(o.id);
    if (!s.on || hour < s.hour || s.lastPlanDate === day || hour > 17) continue;
    const r = await makePlan(o.id, day);
    if (!r.skipped) plans++;
  }
  return { plans, at: hourLabel(hour) };
}

export async function recentPlanDays(ownerId: string) {
  return db.selectDistinct({ day: fieldTasks.dueDate }).from(fieldTasks).where(and(eq(fieldTasks.ownerId, ownerId), eq(fieldTasks.source, "ai"), gte(fieldTasks.dueDate, centralToday()))).orderBy(desc(fieldTasks.dueDate)).limit(5);
}
