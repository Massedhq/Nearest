import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, fieldTasks, fieldPlanSettings, teamAssistants, adminMembers, fieldTraining, educators } from "@/db";
import { recruitNext, upcoming, cardSupply } from "./field";
import { LESSONS } from "./training";
import { fieldGoals } from "./field-goals";
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
  const goals = await fieldGoals();
  const planned = (await db.execute(sql`select name, city_name as city from field_popups where owner_id = ${ownerId} and status = 'planned' and starts_at > now() order by starts_at limit 3`)).rows as { name: string; city: string }[];
  return { votes, soon: soon.slice(0, 6), supply, callbacks, nextLesson, edus, goals, planned };
}

/**
 * Several tasks a day, enough to fill the day's hours (2026-11-26, owner): about 45 minutes each, at least 4.
 * Monthly goals decide what's left to do — no pop-up finding once the month's pop-ups are set, no educator finding
 * once the educators are in.
 */
export const TASK_MINUTES = 45;
export const tasksForHours = (hours: number) => Math.max(4, Math.min(8, Math.ceil((hours * 60) / TASK_MINUTES)));

function rulePlan(c: Awaited<ReturnType<typeof context>>, hours: number): PlanTask[] {
  const out: PlanTask[] = [];
  const times = ["9:00 AM", "9:45 AM", "10:30 AM", "11:15 AM", "1:00 PM", "1:45 PM", "2:30 PM", "3:15 PM"];
  const open = c.votes.filter((v) => !v.covered);
  const cities = [...new Set([...open, ...c.votes].map((v) => v.city))];
  const g = c.goals;
  if (c.callbacks.length) out.push({ title: `Follow up: ${c.callbacks.slice(0, 3).map((x) => x.org).join(", ")}`, why: "Call-backs from your recent reports.", kind: "calls", time: "", steps: c.callbacks.slice(0, 3).map((x) => `${x.org} — ${x.next || x.outcome}${x.person ? ` (ask for ${x.person})` : ""}`).concat("Log each call in your report") });
  const orgs = (city: string, i: number): PlanTask => ({ title: `Find and call 5 youth programs in ${city}`, why: open[i] ? `${open[i].city} has ${open[i].votes} student votes for ${open[i].category} and no live professional yet.` : "Spread cards across your area.", kind: "calls", time: "",
    steps: [`Search Google Maps: "youth program ${city}", "rec center ${city}", "church youth ${city}"`, "Call each one and ask for the program manager or teen director", "Offer GRANTED cards for teens 13+ and book a drop-off", "Add each one under Organizations & cards (who you spoke to, program manager, cards, drop-off)", "Log every call in your report"] });
  const pros = (v: (typeof open)[number]): PlanTask => ({ title: `Find 3 ${v.category.toLowerCase()} professionals in ${v.city}`, why: `${v.votes} students voted for ${v.category} in ${v.city}.`, kind: "pros", time: "", steps: [`Search Instagram and Google for ${v.category.toLowerCase()} in ${v.city}`, "Add each one under Professionals and email the sign-up link", "Log who you reached in your report"] });
  if (cities[0]) out.push(orgs(cities[0], 0));
  if (open[0]) out.push(pros(open[0]));
  if (!g.popups.met) {
    if (g.popups.full) out.push({ title: `Confirm the planned pop-ups: ${c.planned.map((p) => p.name).join(", ") || "see Pop-ups"}`, why: `${g.popups.done} of ${g.popups.goal} pop-ups confirmed for ${g.month} — the rest are planned.`, kind: "popups", time: "", steps: ["Call each host to confirm the date, time and any fee", "Anything that costs money needs an OK before you agree to it", "Mark it Confirmed when it's set"] });
    else { const need = g.popups.goal - g.popups.done - g.popups.planned; out.push({ title: `Find ${Math.min(2, need)} pop-up${need > 1 ? "s" : ""} for ${g.month}`, why: `${g.popups.done} of ${g.popups.goal} pop-ups set for ${g.month} (all of Nearest). A vendor event in your area or our own both count.`, kind: "popups", time: "", steps: ["Search Facebook Events and Eventbrite for vendor markets this month, or ask an organization for free space", "Write down the vendor fee, date, address and host", "Add each under Pop-ups"] }); }
  }
  if (!g.educators.met) {
    if (g.educators.done + g.educators.working >= g.educators.goal) out.push({ title: "Follow up with the video educators in progress", why: `${g.educators.done} of ${g.educators.goal} educators done (agreement signed and video uploaded).`, kind: "edu", time: "", steps: ["Open Video educators", "Check who still needs a price, an agreement or their video", "Message each one and log it"] });
    else out.push({ title: `Find 2 educators for training videos`, why: `${g.educators.done} of ${g.educators.goal} video educators done for all of Nearest. Any category: lashes, hair, nails, braids, locs, piercing and more.`, kind: "edu", time: "", steps: ["Search Instagram, TikTok and YouTube for step-by-step tutorials", "Reach out using the script on Video educators", "Log each one with their price"] });
  }
  if (c.nextLesson) out.push({ title: `Training: ${c.nextLesson.title}`, why: c.nextLesson.why, kind: "training", time: "", steps: ["Open Training", `Work through ${c.nextLesson.title} and tick each step`] });
  // Fill the day: more organizations and professionals in the next cities.
  for (let i = 1; out.length < tasksForHours(hours) && i < 6; i++) {
    if (cities[i]) out.push(orgs(cities[i], i));
    if (out.length < tasksForHours(hours) && open[i]) out.push(pros(open[i]));
    if (!cities[i] && !open[i]) break;
  }
  while (out.length < tasksForHours(hours)) out.push({ title: `Call 5 more organizations in your area`, why: "Every organization is a place for GRANTED cards and pop-ups.", kind: "calls", time: "", steps: ["Search Google Maps for churches, rec centers, YMCAs and Boys & Girls Clubs near you", "Call each one and ask for the program manager", "Add each one under Organizations & cards and log the call"] });
  return out.slice(0, tasksForHours(hours)).map((t, i) => ({ ...t, time: times[i] ?? "" }));
}

/** Drop tasks the goals say aren't needed (pop-ups this month are set, or the educators are in). */
function goalFilter(plan: PlanTask[], g: Awaited<ReturnType<typeof fieldGoals>>) {
  return plan.filter((t) => !(t.kind === "popups" && g.popups.met) && !(t.kind === "edu" && g.educators.met));
}

async function aiPlan(c: Awaited<ReturnType<typeof context>>, hours: number, ownerName: string): Promise<PlanTask[] | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const { AI_MODEL } = await import("./outreach-ai");
  const system = `You plan one workday (${hours} hours) for an outreach assistant at Nearest, a platform where verified students book beauty professionals. She works only ${ownerName}'s area. Her jobs: find organizations with youth programs (13+) and book GRANTED card drop-offs (10 cards each); ask about free space for pro sign-up pop-ups; find vendor pop-ups and their fees; find beauty professionals and email them the sign-up link; find educators for paid training videos; prepare ads for approval (never pay); Google Trends research; training lessons. Never contact students directly. Goals for ALL of Nearest: ${c.goals.popups.goal} pop-ups a month (vendor events we join or our own; this month ${c.goals.popups.done} confirmed, ${c.goals.popups.planned} planned${c.goals.popups.met ? " — GOAL MET, give NO pop-up tasks" : c.goals.popups.full ? " — enough planned, only confirm them, don't find new ones" : ""}) and ${c.goals.educators.goal} video educators in all (${c.goals.educators.done} done = agreement signed AND video uploaded, ${c.goals.educators.working} in progress${c.goals.educators.met ? " — GOAL MET, give NO educator tasks" : ""}; any category). Every task must be real work she saves in the app (calls logged, organizations added, professionals added, pop-ups saved), about ${TASK_MINUTES} minutes each. Return ONLY a JSON array of exactly ${tasksForHours(hours)} tasks: {"title": short imperative, "why": one sentence using the numbers given, "steps": 3–5 short steps, "kind": "calls"|"pros"|"popups"|"edu"|"ads"|"training"|"general", "time": "9:00 AM" style start}. Use real cities and numbers from the data. Call-backs first.`;
  const user = JSON.stringify({ studentVotes: c.votes.map((v) => ({ city: v.city, service: v.category, votes: v.votes, thisWeek: v.week, liveProThere: v.covered })), callBacksDue: c.callbacks, comingUp: c.soon.map((s) => ({ kind: s.kind, at: s.at, title: s.title })), cardsLeft: c.supply.reduce((a, s) => a + s.left, 0), educatorsInProgress: c.edus.length, nextTrainingLesson: c.nextLesson?.title ?? null });
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 2600, system, messages: [{ role: "user", content: user }] }), signal: AbortSignal.timeout(25_000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { content?: { type: string; text?: string }[] };
    const text = j.content?.find((x) => x.type === "text")?.text ?? "";
    const arr = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)) as PlanTask[];
    const kinds = ["calls", "pros", "popups", "edu", "ads", "training", "general"];
    const clean = arr.filter((t) => t && typeof t.title === "string" && t.title.trim()).slice(0, 8).map((t) => ({
      title: String(t.title).slice(0, 160), why: String(t.why ?? "").slice(0, 300), steps: (Array.isArray(t.steps) ? t.steps : []).map((s) => String(s).slice(0, 300)).slice(0, 8),
      kind: kinds.includes(t.kind) ? t.kind : "general", time: /^\d{1,2}:\d{2} (AM|PM)$/.test(String(t.time)) ? String(t.time) : "",
    }));
    const kept = goalFilter(clean, c.goals);
    return kept.length >= Math.min(4, tasksForHours(hours)) ? kept : null;
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
  const plan = goalFilter((await aiPlan(c, s.hours, owner?.firstName ?? "the owner")) ?? rulePlan(c, s.hours), c.goals);
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
