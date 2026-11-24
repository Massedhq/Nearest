"use server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, fieldTasks, fieldTaskCalls, fieldPlanSettings, fieldTraining, cardPlaces, fieldTouches, cities, voucherDistributions, teamAssistants } from "@/db";
import { fieldActor, mayWork, ownerFirstName, type FieldActor } from "@/lib/team";
import { centralToday, OUTCOMES, HOW, tellOwnerTask, tellAssistants, addDays } from "@/lib/field-tasks";
import { areaOwnerFor } from "@/lib/areas";
import { placeOwnerId } from "@/lib/field";
import { lessonById } from "@/lib/training";
import { logActivity } from "@/lib/log";
import { chicagoToUtc } from "@/lib/time";

/**
 * Field task actions (2026-11-23). Owners add, edit, delete, approve, send back and mark handled; an owner's assistant
 * starts, sends to the owner, and finishes with a report (every call/visit). Every action re-checks fieldActor + the
 * task's owner (mayWork) and is logged. Owners get a bell + email on start, send and complete; assistants get a notice +
 * email when the owner adds a task for today/tomorrow, approves or sends back.
 */
type FormState = { error?: string; ok?: string };
const s = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);
const ID = /^[0-9a-f-]{36}$/;
const refresh = () => { revalidatePath("/outreach", "layout"); revalidatePath("/admin/field", "layout"); };
async function actor(): Promise<FieldActor> { const a = await fieldActor(); if (!a) throw new Error("Not allowed."); return a; }
const who = (a: FieldActor) => a.assistant?.name || a.user.firstName || "Someone";
async function taskFor(a: FieldActor, id: string) {
  if (!ID.test(id)) return null;
  const t = await db.query.fieldTasks.findFirst({ where: eq(fieldTasks.id, id) });
  return t && mayWork(a, t.ownerId) ? t : null;
}
const ymd = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const TIME = /^(\d{1,2}):(\d{2})$/;
const timeLabel = (v: string) => { const m = TIME.exec(v); if (!m) return null; const h = Number(m[1]); return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`; };

/** Add a task. Owner → for their assistant; assistant → their own task (source "assistant"). */
export async function addTask(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const title = s(form, "title", 160);
  if (!title) return { error: "Write the task." };
  const due = ymd(s(form, "due", 10)) ?? centralToday();
  const steps = s(form, "steps", 3000).split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 12);
  const repeat = !a.assistant && s(form, "repeat", 10) === "weekdays" ? "weekdays" : "once";
  const ownerId = a.assistant ? a.ownerId : (ID.test(s(form, "ownerId", 40)) && a.main ? s(form, "ownerId", 40) : a.user.id);
  const kinds = ["calls", "pros", "popups", "edu", "ads", "training", "general"];
  const [t] = await db.insert(fieldTasks).values({
    ownerId, title, steps, why: s(form, "why", 300) || null, dueDate: due, dueTime: timeLabel(s(form, "time", 5)), priority: s(form, "priority", 10) === "high" ? "high" : "normal",
    repeat, kind: kinds.includes(s(form, "kind", 10)) ? s(form, "kind", 10) : "general", source: a.assistant ? "assistant" : "owner", createdBy: a.user.id,
  }).returning();
  await logActivity({ actorUserId: a.user.id, action: "field.task_added", targetType: "field_task", targetId: t.id, after: { title, due, repeat } });
  if (!a.assistant && (repeat === "weekdays" || due <= addDays(centralToday(), 1))) await tellAssistants(ownerId, `New task: ${title}`, `${a.user.firstName ?? "Avy"} added a task${repeat === "weekdays" ? " that repeats every weekday" : ` for ${due === centralToday() ? "today" : "tomorrow"}`}.`, "/outreach/tasks");
  refresh();
  return { ok: repeat === "weekdays" ? "Added — it repeats every weekday." : "Task added." };
}

export async function editTask(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const t = await taskFor(a, s(form, "id", 40));
  if (!t) return { error: "That task isn't yours." };
  if (a.assistant && t.source !== "assistant") return { error: `Only ${await ownerFirstName(t.ownerId)} can change this task. Add a note in your report instead.` };
  const title = s(form, "title", 160);
  if (!title) return { error: "Write the task." };
  const steps = s(form, "steps", 3000).split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 12);
  await db.update(fieldTasks).set({ title, steps, dueDate: ymd(s(form, "due", 10)) ?? t.dueDate, dueTime: timeLabel(s(form, "time", 5)) ?? t.dueTime, priority: s(form, "priority", 10) === "high" ? "high" : "normal", updatedAt: new Date() }).where(eq(fieldTasks.id, t.id));
  await logActivity({ actorUserId: a.user.id, action: "field.task_changed", targetType: "field_task", targetId: t.id, before: { title: t.title }, after: { title } });
  refresh();
  return { ok: "Saved." };
}

export async function deleteTask(form: FormData) {
  const a = await actor();
  const t = await taskFor(a, s(form, "id", 40));
  if (!t || (a.assistant && t.source !== "assistant")) return;
  await db.delete(fieldTasks).where(eq(fieldTasks.id, t.id));
  await logActivity({ actorUserId: a.user.id, action: "field.task_deleted", targetType: "field_task", targetId: t.id, before: { title: t.title, status: t.status } });
  refresh();
}

export async function startTask(form: FormData) {
  const a = await actor();
  const t = await taskFor(a, s(form, "id", 40));
  if (!t || !["todo", "back"].includes(t.status)) return;
  await db.update(fieldTasks).set({ status: "work", startedAt: t.startedAt ?? new Date(), updatedAt: new Date() }).where(eq(fieldTasks.id, t.id));
  await logActivity({ actorUserId: a.user.id, action: "field.task_started", targetType: "field_task", targetId: t.id, after: { title: t.title } });
  if (a.assistant) await tellOwnerTask(t.ownerId, `${who(a)} started “${t.title}”`, `Started ${new Date().toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" })}.`, `/admin/field/task/${t.id}`);
  refresh();
}

export async function sendToOwner(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const t = await taskFor(a, s(form, "id", 40));
  if (!t) return { error: "That task isn't yours." };
  const msg = s(form, "msg", 1000);
  if (!msg) return { error: `Say what ${await ownerFirstName(t.ownerId)} needs to do.` };
  await db.update(fieldTasks).set({ status: "needs", needsMsg: msg, updatedAt: new Date() }).where(eq(fieldTasks.id, t.id));
  await logActivity({ actorUserId: a.user.id, action: "field.task_sent", targetType: "field_task", targetId: t.id, after: { msg } });
  await tellOwnerTask(t.ownerId, `${who(a)} sent you “${t.title}”`, msg, `/admin/field/task/${t.id}`);
  refresh();
  return { ok: "Sent." };
}

/** Owner: done with what was asked → back to the assistant. */
export async function markHandled(form: FormData) {
  const a = await actor();
  if (a.assistant) return;
  const t = await taskFor(a, s(form, "id", 40));
  if (!t || t.status !== "needs") return;
  const note = s(form, "note", 600);
  await db.update(fieldTasks).set({ status: "work", backNote: note || t.backNote, needsMsg: null, updatedAt: new Date() }).where(eq(fieldTasks.id, t.id));
  await logActivity({ actorUserId: a.user.id, action: "field.task_handled", targetType: "field_task", targetId: t.id, after: { note } });
  await tellAssistants(t.ownerId, `${a.user.firstName ?? "Avy"} handled “${t.title}”`, note || "It's back with you to finish.", `/outreach/task/${t.id}`);
  refresh();
}

/** Parse "street, city, ST 75035" into parts (best effort) to file the place under Organizations. */
function splitAddress(v: string) {
  const m = /^(.+?),\s*([^,]+?)(?:,\s*|\s+)([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/.exec(v.trim()) ?? /^(.+?),\s*([^,]+?)\s+(\d{5})$/.exec(v.trim());
  if (!m) return null;
  return m.length === 5 ? { street: m[1], city: m[2], state: m[3], zip: m[4] } : { street: m[1], city: m[2], state: "TX", zip: m[3] };
}

/** Finish a task with its report: summary + every call/visit. New places go to Organizations (in the owner's area). */
export async function completeTask(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const t = await taskFor(a, s(form, "id", 40));
  if (!t) return { error: "That task isn't yours." };
  if (["done", "approved"].includes(t.status)) return { error: "This task is already finished." };
  const summary = s(form, "summary", 3000);
  if (!summary) return { error: `Write a short summary for ${await ownerFirstName(t.ownerId)}.` };
  const n = Math.min(20, Math.max(0, Number(s(form, "count", 3)) || 0));
  const calls: (typeof fieldTaskCalls.$inferInsert)[] = [];
  for (let i = 0; i < n; i++) {
    const g = (k: string, m = 300) => s(form, `c${i}_${k}`, m);
    if (!g("org") && !g("person") && !g("address")) continue;
    const date = ymd(g("date", 10)), time = TIME.exec(g("time", 5)) ? g("time", 5) : null;
    if (!g("org", 160)) return { error: `Call ${i + 1}: enter the organization or business name.` };
    if (!g("address", 200)) return { error: `Call ${i + 1}: enter the address (street, city, ZIP).` };
    if (!g("person", 120)) return { error: `Call ${i + 1}: enter who you talked to (or "Front desk", "Voicemail").` };
    if (!OUTCOMES.includes(g("outcome", 60))) return { error: `Call ${i + 1}: choose the outcome.` };
    if (!date || !time) return { error: `Call ${i + 1}: enter the date and time.` };
    calls.push({ taskId: t.id, at: chicagoToUtc(date, time), how: HOW[g("how", 10)] ? g("how", 10) : "call", orgName: g("org", 160), address: g("address", 200), person: g("person", 120),
      personTitle: g("title", 120) || null, contact: g("contact", 200) || null, outcome: g("outcome", 60), notes: g("notes", 1000) || null, nextStep: g("next", 300) || null, createdBy: a.user.id });
  }
  if (t.kind === "calls" && !calls.length) return { error: "Add at least one call or visit to the report." };
  // File each place under Organizations (match by name + street, else create when the city is known and in the area).
  for (const c of calls) {
    const parts = splitAddress(c.address);
    let place = await db.query.cardPlaces.findFirst({ where: sql`lower(${cardPlaces.name}) = lower(${c.orgName}) and (${parts ? sql`lower(coalesce(${cardPlaces.street}, '')) = lower(${parts.street})` : sql`true`})` });
    if (!place && parts) {
      const city = (await db.select({ id: cities.id }).from(cities).where(and(eq(cities.state, parts.state), sql`lower(${cities.name}) = lower(${parts.city})`)).limit(1))[0];
      const owner = city ? await areaOwnerFor(city.id, parts.zip) : null;
      if (city && (!owner || owner === t.ownerId)) {
        const { locationKey } = await import("@/lib/distribution");
        [place] = await db.insert(cardPlaces).values({ name: c.orgName, kind: "other", street: parts.street, state: parts.state, zip: parts.zip, cityId: city.id, address: `${parts.street}, ${parts.city}, ${parts.state} ${parts.zip}`,
          contactName: c.person, contact: c.contact, locationKey: locationKey(c.orgName, parts.street, parts.zip), createdBy: a.user.id, assignedTo: a.user.id, shared: true }).onConflictDoNothing().returning();
      }
    }
    if (place && mayWork(a, await placeOwnerId(place.id))) {
      c.placeId = place.id;
      await db.insert(fieldTouches).values({ placeId: place.id, kind: ["call", "email", "text", "visit"].includes(c.how!) ? c.how! : "call", summary: `${c.outcome}${c.person ? ` — ${c.person}${c.personTitle ? `, ${c.personTitle}` : ""}` : ""}${c.notes ? `. ${c.notes}` : ""}${c.nextStep ? ` Next: ${c.nextStep}` : ""}`, at: c.at, createdBy: a.user.id });
    }
  }
  if (calls.length) await db.insert(fieldTaskCalls).values(calls);
  const cards = Math.min(50, Math.max(0, Number(s(form, "cards", 3)) || 0));
  if (cards && calls[0]?.placeId) {
    const { cardSupply } = await import("@/lib/field");
    const pick = (await cardSupply(t.ownerId)).find((x) => x.left >= cards);
    if (pick) await db.insert(voucherDistributions).values({ batchId: pick.id, placeId: calls[0].placeId, quantity: cards, delivered: 0, status: "planned", distributedAt: new Date(), notes: `From task: ${t.title}`.slice(0, 300), createdBy: a.user.id, requestedBy: a.assistant ? a.user.id : null });
  }
  await db.update(fieldTasks).set({ status: "done", summary, cardsAsked: cards || null, doneAt: new Date(), updatedAt: new Date() }).where(eq(fieldTasks.id, t.id));
  await logActivity({ actorUserId: a.user.id, action: "field.task_completed", targetType: "field_task", targetId: t.id, after: { title: t.title, calls: calls.length, cards } });
  if (a.assistant) await tellOwnerTask(t.ownerId, `${who(a)} completed “${t.title}”`, `${summary.slice(0, 400)}${calls.length ? `\n${calls.length} call${calls.length === 1 ? "" : "s"} in the report.` : ""}${cards ? `\nAsked for ${cards} cards.` : ""}`, `/admin/field/task/${t.id}`);
  refresh(); revalidatePath("/admin/cards");
  return { ok: "Report sent." };
}

export async function approveTask(form: FormData) {
  const a = await actor();
  if (a.assistant) return;
  const t = await taskFor(a, s(form, "id", 40));
  if (!t || t.status !== "done") return;
  await db.update(fieldTasks).set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() }).where(eq(fieldTasks.id, t.id));
  await logActivity({ actorUserId: a.user.id, action: "field.task_approved", targetType: "field_task", targetId: t.id });
  await tellAssistants(t.ownerId, `Approved: ${t.title}`, `Nice work — ${a.user.firstName ?? "it was"} approved this report.`, `/outreach/task/${t.id}`);
  refresh();
}

export async function sendBackTask(form: FormData) {
  const a = await actor();
  if (a.assistant) return;
  const t = await taskFor(a, s(form, "id", 40));
  if (!t || !["done", "approved"].includes(t.status)) return;
  const note = s(form, "note", 800) || "Please take another look.";
  await db.update(fieldTasks).set({ status: "back", backNote: note, updatedAt: new Date() }).where(eq(fieldTasks.id, t.id));
  await logActivity({ actorUserId: a.user.id, action: "field.task_sent_back", targetType: "field_task", targetId: t.id, after: { note } });
  await tellAssistants(t.ownerId, `Sent back: ${t.title}`, note, `/outreach/task/${t.id}`);
  refresh();
}

/** Owner: AI plan settings + make a plan now. */
export async function savePlanSettings(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  if (a.assistant) return { error: `Only ${await ownerFirstName(a.ownerId)} can change this.` };
  const on = form.get("on") === "on";
  const hour = Math.min(10, Math.max(6, Number(s(form, "hour", 2)) || 7));
  const hours = Math.min(8, Math.max(2, Number(s(form, "hours", 2)) || 4));
  await db.insert(fieldPlanSettings).values({ ownerId: a.user.id, on, hour, hours, updatedAt: new Date() }).onConflictDoUpdate({ target: fieldPlanSettings.ownerId, set: { on, hour, hours, updatedAt: new Date() } });
  await logActivity({ actorUserId: a.user.id, action: "field.plan_settings", targetType: "field_plan", targetId: a.user.id, after: { on, hour, hours } });
  refresh();
  return { ok: on ? "Saved." : "AI plan paused." };
}

export async function makePlanNow(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  if (a.assistant) return { error: `Only ${await ownerFirstName(a.ownerId)} can do this.` };
  const day = s(form, "day", 10) === "tomorrow" ? addDays(centralToday(), 1) : centralToday();
  const { makePlan } = await import("@/lib/field-plan");
  const r = await makePlan(a.user.id, day, { actorId: a.user.id });
  refresh();
  return r.skipped ? { error: "That day already has an AI plan." } : { ok: `Plan made: ${r.made} tasks. Your assistant and you were sent a copy.` };
}

/** Time worked: the workspace pings once a minute while it's open and in front. */
export async function pingPresence() {
  const a = await fieldActor();
  if (!a?.assistant) return;
  const day = centralToday();
  await db.execute(sql`insert into field_presence (user_id, day, minutes, first_at, last_at) values (${a.user.id}, ${day}, 1, now(), now())
    on conflict (user_id, day) do update set minutes = field_presence.minutes + 1, last_at = now() where field_presence.last_at < now() - interval '50 seconds'`);
}

export async function tickTraining(form: FormData) {
  const a = await actor();
  const lesson = lessonById(s(form, "lesson", 30));
  const step = Number(s(form, "step", 3));
  if (!lesson || !Number.isInteger(step) || step < 0 || step >= lesson.steps.length) return;
  const done = await db.query.fieldTraining.findFirst({ where: and(eq(fieldTraining.userId, a.user.id), eq(fieldTraining.lesson, lesson.id), eq(fieldTraining.step, step)) });
  if (done) await db.delete(fieldTraining).where(and(eq(fieldTraining.userId, a.user.id), eq(fieldTraining.lesson, lesson.id), eq(fieldTraining.step, step)));
  else await db.insert(fieldTraining).values({ userId: a.user.id, lesson: lesson.id, step }).onConflictDoNothing();
  revalidatePath("/outreach/training", "layout");
}

/** Owner: "See <name>'s screen" — open the assistant's workspace as she sees it (cookie re-checked on every page). */
export async function viewAsAssistant(form: FormData) {
  const a = await actor();
  if (a.assistant) return;
  const id = s(form, "id", 40);
  const row = ID.test(id) ? await db.query.teamAssistants.findFirst({ where: and(eq(teamAssistants.id, id), eq(teamAssistants.status, "active")) }) : null;
  if (!row || !mayWork(a, row.ownerId)) return;
  const { cookies } = await import("next/headers");
  (await cookies()).set("nearest_view_as", row.id, { path: "/outreach", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 4 });
  await logActivity({ actorUserId: a.user.id, action: "field.view_as", targetType: "team_assistant", targetId: row.id, after: { name: row.name } });
  const { redirect } = await import("next/navigation");
  redirect("/outreach");
}

export async function stopViewAs() {
  const { cookies } = await import("next/headers");
  (await cookies()).delete({ name: "nearest_view_as", path: "/outreach" });
  const { redirect } = await import("next/navigation");
  redirect("/admin/field/team");
}
