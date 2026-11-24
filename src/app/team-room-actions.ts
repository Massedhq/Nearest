"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, cardPlaces, teamMeetings, teamNotes, users } from "@/db";
import { fieldActor, mayWork, type FieldActor } from "@/lib/team";
import { placeOwnerId } from "@/lib/field";
import { teamMembers, teamNotify, meetingLinkProblem, HOW } from "@/lib/team-room";
import { chicagoToUtc } from "@/lib/time";
import { logActivity } from "@/lib/log";

/**
 * Field team room (2026-11-23): team meetings, the Note Room, and handing organizations between teammates.
 * Everyone on an owner's team (the owner + their assistants) can set up a meeting and post notes. Every action
 * re-checks the team on the server and is logged.
 */
type FormState = { error?: string; ok?: string };
const s = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);
const ID = /^[0-9a-f-]{36}$/;
const refresh = () => { revalidatePath("/outreach", "layout"); revalidatePath("/admin/field", "layout"); };
async function actor(): Promise<FieldActor> { const a = await fieldActor(); if (!a) throw new Error("Not allowed."); return a; }
const who = (a: FieldActor) => a.user.firstName || "Someone";
const dayTime = (d: Date) => d.toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/* ───────────── Meetings ───────────── */

export async function scheduleMeeting(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const title = s(form, "title", 120), agenda = s(form, "agenda", 3000);
  const date = s(form, "date", 10), time = s(form, "time", 5);
  if (!title) return { error: "Give the meeting a title." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Choose the date and time." };
  const startsAt = chicagoToUtc(date, time);
  if (startsAt.getTime() < Date.now() - 5 * 60000) return { error: "That time has passed." };
  const minutes = [15, 30, 45, 60, 90].includes(Number(s(form, "minutes", 3))) ? Number(s(form, "minutes", 3)) : 30;
  const how = HOW[s(form, "how", 12)] ? s(form, "how", 12) : "video";
  const link = how === "video" ? s(form, "link", 500) : "";
  const bad = meetingLinkProblem(link); if (bad) return { error: bad };
  const place = how === "video" ? "" : s(form, "place", 200);
  const members = await teamMembers(a.ownerId);
  const picked = form.getAll("with").map(String).filter((id) => members.some((m) => m.userId === id));
  const attendees = [...new Set([a.user.id, ...picked])];
  if (attendees.length < 2) return { error: "Choose who's in the meeting." };
  const [m] = await db.insert(teamMeetings).values({ ownerId: a.ownerId, title, agenda: agenda || null, startsAt, minutes, how, link: link || null, place: place || null, attendees, createdBy: a.user.id }).returning();
  await logActivity({ actorUserId: a.user.id, action: "field.meeting_set", targetType: "team_meeting", targetId: m.id, after: { title, startsAt, how, attendees } });
  const where = how === "video" ? (link ? "Video — the join link is in Meetings." : "Video — the link will be added in Meetings.") : how === "phone" ? `Phone${place ? `: ${place}` : ""}` : `In person${place ? `: ${place}` : ""}`;
  await teamNotify(a.ownerId, attendees, a.user.id, `Meeting: ${title}`, `${who(a)} set up a meeting for ${dayTime(startsAt)} (${minutes} min). ${where}${agenda ? ` Agenda: ${agenda.slice(0, 300)}` : ""}`, "/meetings");
  refresh();
  return { ok: `Meeting set for ${dayTime(startsAt)}. Everyone invited was told.` };
}

async function meetingFor(a: FieldActor, id: string) {
  if (!ID.test(id)) return null;
  const m = await db.query.teamMeetings.findFirst({ where: eq(teamMeetings.id, id) });
  return m && m.ownerId === a.ownerId && mayWork(a, m.ownerId) ? m : null;
}

/** Add or change the video link, place or time (whoever set it up, or the owner). */
export async function updateMeeting(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const m = await meetingFor(a, s(form, "id", 40));
  if (!m) return { error: "That meeting isn't on your team." };
  if (m.createdBy !== a.user.id && a.assistant) return { error: "Only the person who set it up can change it." };
  const link = s(form, "link", 500);
  const bad = meetingLinkProblem(link); if (bad) return { error: bad };
  const date = s(form, "date", 10), time = s(form, "time", 5);
  const moved = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) ? chicagoToUtc(date, time) : null;
  const next = { link: m.how === "video" ? link || null : m.link, place: m.how !== "video" ? s(form, "place", 200) || m.place : m.place, startsAt: moved ?? m.startsAt, updatedAt: new Date() };
  await db.update(teamMeetings).set(next).where(eq(teamMeetings.id, m.id));
  await logActivity({ actorUserId: a.user.id, action: "field.meeting_changed", targetType: "team_meeting", targetId: m.id, before: { link: m.link, startsAt: m.startsAt }, after: next });
  const changed = moved && moved.getTime() !== m.startsAt.getTime() ? `moved to ${dayTime(moved)}` : next.link !== m.link ? "now has its video link" : "was updated";
  await teamNotify(a.ownerId, m.attendees, a.user.id, `Meeting update: ${m.title}`, `“${m.title}” ${changed}.`, "/meetings", !!moved);
  refresh();
  return { ok: "Saved — everyone in the meeting was told." };
}

export async function cancelMeeting(form: FormData) {
  const a = await actor();
  const m = await meetingFor(a, s(form, "id", 40));
  if (!m || m.status !== "planned" || (m.createdBy !== a.user.id && a.assistant)) return;
  await db.update(teamMeetings).set({ status: "cancelled", updatedAt: new Date() }).where(eq(teamMeetings.id, m.id));
  await logActivity({ actorUserId: a.user.id, action: "field.meeting_cancelled", targetType: "team_meeting", targetId: m.id });
  await teamNotify(a.ownerId, m.attendees, a.user.id, `Canceled: ${m.title}`, `${who(a)} canceled “${m.title}” (${dayTime(m.startsAt)}).`, "/meetings");
  refresh();
}

/** Meeting notes — anyone in the meeting can write them; saving marks it done and shares them with the team. */
export async function saveMeetingNotes(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const m = await meetingFor(a, s(form, "id", 40));
  if (!m) return { error: "That meeting isn't on your team." };
  const notes = s(form, "notes", 6000);
  if (!notes) return { error: "Write the notes first." };
  await db.update(teamMeetings).set({ notes, status: "done", updatedAt: new Date() }).where(eq(teamMeetings.id, m.id));
  await logActivity({ actorUserId: a.user.id, action: "field.meeting_notes", targetType: "team_meeting", targetId: m.id, after: { notes: notes.slice(0, 300) } });
  await teamNotify(a.ownerId, "all", a.user.id, `Notes: ${m.title}`, `${who(a)} added the notes from “${m.title}”.`, "/meetings", false);
  refresh();
  return { ok: "Notes saved for the team." };
}

/* ───────────── Note Room ───────────── */

export async function postNote(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const body = s(form, "body", 4000);
  if (!body) return { error: "Write your note first." };
  const [n] = await db.insert(teamNotes).values({ ownerId: a.ownerId, authorId: a.user.id, body }).returning();
  await logActivity({ actorUserId: a.user.id, action: "field.note_posted", targetType: "team_note", targetId: n.id, after: { body: body.slice(0, 200) } });
  await teamNotify(a.ownerId, "all", a.user.id, `New note from ${who(a)}`, body.slice(0, 280), "/notes", false);
  refresh();
  return { ok: "Posted to the Note Room." };
}

async function noteFor(a: FieldActor, id: string) {
  if (!ID.test(id)) return null;
  const n = await db.query.teamNotes.findFirst({ where: eq(teamNotes.id, id) });
  return n && n.ownerId === a.ownerId ? n : null;
}

export async function editNote(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const n = await noteFor(a, s(form, "id", 40));
  if (!n || n.authorId !== a.user.id) return { error: "You can only edit your own notes." };
  const body = s(form, "body", 4000);
  if (!body) return { error: "A note can't be empty — delete it instead." };
  await db.update(teamNotes).set({ body, editedAt: new Date() }).where(eq(teamNotes.id, n.id));
  await logActivity({ actorUserId: a.user.id, action: "field.note_edited", targetType: "team_note", targetId: n.id, before: { body: n.body.slice(0, 200) }, after: { body: body.slice(0, 200) } });
  refresh();
  return { ok: "Saved." };
}

/** Delete: your own note, or any note when you're the owner. */
export async function deleteNote(form: FormData) {
  const a = await actor();
  const n = await noteFor(a, s(form, "id", 40));
  if (!n || (n.authorId !== a.user.id && a.assistant)) return;
  await db.delete(teamNotes).where(eq(teamNotes.id, n.id));
  await logActivity({ actorUserId: a.user.id, action: "field.note_deleted", targetType: "team_note", targetId: n.id, before: { body: n.body.slice(0, 300), author: n.authorId } });
  refresh();
}

/** Pin / unpin (anyone on the team) — pinned notes stay at the top. */
export async function pinNote(form: FormData) {
  const a = await actor();
  const n = await noteFor(a, s(form, "id", 40));
  if (!n) return;
  await db.update(teamNotes).set({ pinned: !n.pinned }).where(eq(teamNotes.id, n.id));
  await logActivity({ actorUserId: a.user.id, action: n.pinned ? "field.note_unpinned" : "field.note_pinned", targetType: "team_note", targetId: n.id });
  refresh();
}

/* ───────────── Who works an organization ───────────── */

async function orgFor(a: FieldActor, id: string) {
  if (!ID.test(id)) return null;
  const p = await db.query.cardPlaces.findFirst({ where: eq(cardPlaces.id, id) });
  if (!p) return null;
  const ownerId = await placeOwnerId(p.id);
  if (!mayWork(a, ownerId) || ownerId !== a.ownerId && a.assistant) return null;
  return { p, ownerId: ownerId! };
}
const workerOf = (p: typeof cardPlaces.$inferSelect) => (p.openToClaim ? null : p.assignedTo ?? p.createdBy);

/** Share with the whole team (the person who added it, whoever works it, or the owner). */
export async function shareOrg(form: FormData) {
  const a = await actor();
  const f = await orgFor(a, s(form, "id", 40));
  if (!f || f.p.shared) return;
  if (a.assistant && f.p.createdBy !== a.user.id && workerOf(f.p) !== a.user.id) return;
  await db.update(cardPlaces).set({ shared: true }).where(eq(cardPlaces.id, f.p.id));
  await logActivity({ actorUserId: a.user.id, action: "field.org_shared", targetType: "card_place", targetId: f.p.id });
  await teamNotify(f.ownerId, "all", a.user.id, `Shared — ${f.p.name}`, `${who(a)} shared ${f.p.name} with the team.`, `/org/${f.p.id}`, false);
  refresh();
}

/** Release: hand it to a teammate, or open it for anyone to claim. Only whoever works it (or the owner). */
export async function releaseOrg(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const f = await orgFor(a, s(form, "id", 40));
  if (!f) return { error: "That organization isn't on your team." };
  const current = workerOf(f.p);
  if (a.assistant && current !== a.user.id) return { error: "Only the person working it can release it." };
  const to = s(form, "to", 40);
  const members = await teamMembers(f.ownerId);
  if (to === "anyone") {
    await db.update(cardPlaces).set({ assignedTo: null, openToClaim: true, shared: true }).where(eq(cardPlaces.id, f.p.id));
    await logActivity({ actorUserId: a.user.id, action: "field.org_released", targetType: "card_place", targetId: f.p.id, before: { worker: current }, after: { open: true } });
    await teamNotify(f.ownerId, "all", a.user.id, `Open to claim — ${f.p.name}`, `${who(a)} released ${f.p.name}. The first person to tap Claim it works it.`, `/org/${f.p.id}`);
    refresh();
    return { ok: "Released — anyone on the team can claim it." };
  }
  const m = members.find((x) => x.userId === to);
  if (!m) return { error: "Choose who gets it." };
  if (m.userId === current) return { error: `${m.name} is already working it.` };
  await db.update(cardPlaces).set({ assignedTo: m.userId, openToClaim: false, shared: true }).where(eq(cardPlaces.id, f.p.id));
  await logActivity({ actorUserId: a.user.id, action: "field.org_released", targetType: "card_place", targetId: f.p.id, before: { worker: current }, after: { worker: m.userId } });
  await teamNotify(f.ownerId, [m.userId], a.user.id, `${f.p.name} is yours now`, `${who(a)} handed ${f.p.name} to you. You're the one working it now.`, `/org/${f.p.id}`);
  refresh();
  return { ok: `${m.name} is working it now.` };
}

/** Claim an organization someone released to anyone. First tap wins. */
export async function claimOrg(form: FormData) {
  const a = await actor();
  const f = await orgFor(a, s(form, "id", 40));
  if (!f) return;
  const [won] = await db.update(cardPlaces).set({ assignedTo: a.user.id, openToClaim: false }).where(and(eq(cardPlaces.id, f.p.id), eq(cardPlaces.openToClaim, true))).returning();
  if (!won) return;
  await logActivity({ actorUserId: a.user.id, action: "field.org_claimed", targetType: "card_place", targetId: f.p.id });
  await teamNotify(f.ownerId, "all", a.user.id, `Claimed — ${f.p.name}`, `${who(a)} is working ${f.p.name} now.`, `/org/${f.p.id}`, false);
  refresh();
}

/** The owner can take over any organization on the team (the person working it is told). */
export async function takeOverOrg(form: FormData) {
  const a = await actor();
  if (a.assistant) return;
  const f = await orgFor(a, s(form, "id", 40));
  if (!f) return;
  const before = workerOf(f.p);
  if (before === a.user.id) return;
  await db.update(cardPlaces).set({ assignedTo: a.user.id, openToClaim: false }).where(eq(cardPlaces.id, f.p.id));
  await logActivity({ actorUserId: a.user.id, action: "field.org_taken_over", targetType: "card_place", targetId: f.p.id, before: { worker: before }, after: { worker: a.user.id } });
  if (before) {
    const u = await db.query.users.findFirst({ where: eq(users.id, before), columns: { id: true } });
    if (u) await teamNotify(f.ownerId, [u.id], a.user.id, `${f.p.name} was taken over`, `${who(a)} is working ${f.p.name} now.`, `/org/${f.p.id}`);
  }
  refresh();
}
