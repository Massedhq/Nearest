"use server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db, cities, cardPlaces, fieldContacts, fieldTouches, fieldSteps, fieldPopups, adDrafts, adSpend, platformSettings, prospects,
  teamAssistants, users, voucherDistributions, voucherDistributionEvents, areaCities, areaZips,
} from "@/db";
import { fieldActor, mayWork, type FieldActor, newTeamToken, TEAM_INVITE_DAYS, MAX_TEAM_ASSISTANTS } from "@/lib/team";
import { placeOwnerId, STEP_KINDS, TOUCH_KINDS, DEFAULT_CARDS_PER_ORG } from "@/lib/field";
import { areaOwnerFor, applyStartingSplit } from "@/lib/areas";
import { ORG_KINDS, locationKey } from "@/lib/distribution";
import { TRACKING_FIELDS } from "@/lib/tracking";
import { logActivity } from "@/lib/log";
import { sendEmail } from "@/lib/email";
import { notifyAdmins, checkProspect, normEmail, normPhone, resolvePlace, resolveCategory, logProspect } from "@/lib/outreach";
import { chicagoToUtc, fmtDate } from "@/lib/time";

/**
 * Field work actions (2026-11-22) — used by owners (Admin → Field team) and owners' assistants (/outreach). Every action
 * re-checks who is acting and that the organization / pop-up / ad belongs to an owner they work for (fieldActor +
 * mayWork). Assistants can never approve their own card requests or ads. Everything is written to the activity log.
 */
type FormState = { error?: string; ok?: string };
const s = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const ID = /^[0-9a-f-]{36}$/;
const APP = () => process.env.APP_URL || "https://usenearest.com";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const refresh = () => { revalidatePath("/outreach", "layout"); revalidatePath("/admin/field", "layout"); revalidatePath("/admin/areas"); };

async function actor(): Promise<FieldActor> {
  const a = await fieldActor();
  if (!a) throw new Error("Not allowed.");
  return a;
}
const who = (a: FieldActor) => a.user.firstName || a.user.email?.split("@")[0] || "Someone";

/** When an assistant books or asks for something, the owner gets a bell and an email. */
async function tellOwner(a: FieldActor, ownerId: string, title: string, body: string, href: string) {
  if (!a.assistant || a.user.id === ownerId) return;
  await notifyAdmins({ kind: "field", title, body, href }, [ownerId]);
  const o = await db.query.users.findFirst({ where: eq(users.id, ownerId), columns: { email: true, firstName: true } });
  await sendEmail({ to: o?.email, subject: title, eyebrow: "Field team", heading: title, lines: [body], button: { label: "Open it", url: `${APP()}${href}` }, replyTo: a.user.email ?? undefined }).catch(() => undefined);
}

async function findCity(name: string, state: string) {
  const n = name.replace(/,\s*[A-Za-z]{2}$/, "").trim();
  const m = await db.select({ id: cities.id, name: cities.name }).from(cities).where(and(eq(cities.active, true), eq(cities.state, state), sql`lower(${cities.name}) = lower(${n})`)).limit(2);
  return m.length === 1 ? m[0] : null;
}
const when = (date: string, time: string) => (/^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) ? chicagoToUtc(date, time) : null);

async function placeFor(a: FieldActor, placeId: string) {
  if (!ID.test(placeId)) return null;
  const place = await db.query.cardPlaces.findFirst({ where: eq(cardPlaces.id, placeId) });
  if (!place) return null;
  const ownerId = await placeOwnerId(place.id);
  return mayWork(a, ownerId) ? { place, ownerId: ownerId! } : null;
}

/* ───────────── Organizations ───────────── */

export async function fieldAddOrg(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const name = s(form, "name", 120);
  const kind = ORG_KINDS[s(form, "kind", 30)] ? s(form, "kind", 30) : "other";
  const street = s(form, "street", 160), state = (s(form, "state", 2) || "TX").toUpperCase(), zip = s(form, "zip", 10);
  if (!name) return { error: "Enter the organization's name." };
  if (street.length < 5 || !/\d/.test(street)) return { error: "Enter the street address (number and street)." };
  if (!/^\d{5}(-\d{4})?$/.test(zip)) return { error: "Enter the 5-digit ZIP code." };
  const city = await findCity(s(form, "city", 80), state);
  if (!city) return { error: "We couldn't find that city. Check the spelling (for example Frisco) and the state." };
  const owner = await areaOwnerFor(city.id, zip);
  if (a.scope && owner && owner !== a.scope) return { error: "That address is in another owner's area. Ask the main owner if it should be yours." };
  const [p] = await db.insert(cardPlaces).values({
    name, kind, street, state, zip, cityId: city.id, address: `${street}, ${city.name}, ${state} ${zip}`,
    contactName: s(form, "contactName", 100) || null, contact: s(form, "contact", 120) || null, locationKey: locationKey(name, street, zip.slice(0, 5)), createdBy: a.user.id,
  }).onConflictDoNothing().returning();
  if (!p) return { error: `${name} at ${street} is already listed — search for it below.` };
  if (s(form, "contactName", 100)) {
    const c = s(form, "contact", 120);
    await db.insert(fieldContacts).values({ placeId: p.id, name: s(form, "contactName", 100), title: s(form, "contactTitle", 80) || null, phone: c && !c.includes("@") ? c : null, email: c.includes("@") ? c : null, createdBy: a.user.id });
  }
  await logActivity({ actorUserId: a.user.id, action: "field.org_added", targetType: "card_place", targetId: p.id, after: { name, kind, street, city: city.name, state, zip } });
  refresh();
  return { ok: `${name} added. Open it to log calls, add people and book a meeting or drop-off.` };
}

export async function fieldAddContact(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const f = await placeFor(a, s(form, "placeId", 40));
  if (!f) return { error: "That organization isn't in your area." };
  const name = s(form, "name", 100), email = s(form, "email", 160).toLowerCase(), phone = s(form, "phone", 30);
  if (!name) return { error: "Enter the person's name." };
  if (email && !EMAIL.test(email)) return { error: "Check the email address." };
  const [c] = await db.insert(fieldContacts).values({ placeId: f.place.id, name, title: s(form, "title", 80) || null, phone: phone || null, email: email || null, notes: s(form, "notes", 500) || null, createdBy: a.user.id }).returning();
  await logActivity({ actorUserId: a.user.id, action: "field.contact_added", targetType: "card_place", targetId: f.place.id, after: { name, id: c.id } });
  refresh();
  return { ok: `${name} added.` };
}

export async function fieldLogTouch(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const kind = TOUCH_KINDS[s(form, "kind", 10)] ? s(form, "kind", 10) : "";
  const summary = s(form, "summary", 2000);
  if (!kind) return { error: "Choose call, email, text, visit or note." };
  if (!summary) return { error: "Write what happened." };
  const at = when(s(form, "date", 10), s(form, "time", 5)) ?? new Date();
  const contactId = ID.test(s(form, "contactId", 40)) ? s(form, "contactId", 40) : null;
  const popupId = s(form, "popupId", 40);
  if (ID.test(popupId)) {
    const p = await db.query.fieldPopups.findFirst({ where: eq(fieldPopups.id, popupId) });
    if (!p || !mayWork(a, p.ownerId)) return { error: "That pop-up isn't yours." };
    await db.insert(fieldTouches).values({ popupId, kind, summary, at, createdBy: a.user.id });
  } else {
    const f = await placeFor(a, s(form, "placeId", 40));
    if (!f) return { error: "That organization isn't in your area." };
    await db.insert(fieldTouches).values({ placeId: f.place.id, contactId, kind, summary, at, createdBy: a.user.id });
  }
  await logActivity({ actorUserId: a.user.id, action: "field.touch", targetType: ID.test(popupId) ? "field_popup" : "card_place", targetId: ID.test(popupId) ? popupId : s(form, "placeId", 40), after: { kind, summary: summary.slice(0, 200) } });
  refresh();
  return { ok: "Saved to the timeline." };
}

export async function fieldAddStep(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const f = await placeFor(a, s(form, "placeId", 40));
  if (!f) return { error: "That organization isn't in your area." };
  const kind = STEP_KINDS[s(form, "kind", 10)] ? s(form, "kind", 10) : "";
  if (!kind) return { error: "Choose in-person meeting, virtual meeting or drop-off." };
  const at = when(s(form, "date", 10), s(form, "time", 5));
  if (!at) return { error: "Enter the date and time." };
  if (at.getTime() < Date.now() - 86400000) return { error: "That date has passed." };
  const link = s(form, "link", 400);
  if (kind === "virtual" && link && !/^https?:\/\//i.test(link)) return { error: "The meeting link should start with https://" };
  const contactId = ID.test(s(form, "contactId", 40)) ? s(form, "contactId", 40) : null;
  const [row] = await db.insert(fieldSteps).values({
    placeId: f.place.id, ownerId: f.ownerId, kind, startsAt: at, contactId, meetWith: s(form, "meetWith", 120) || null, link: link || null, notes: s(form, "notes", 1000) || null, createdBy: a.user.id,
  }).returning();
  await logActivity({ actorUserId: a.user.id, action: "field.step_booked", targetType: "card_place", targetId: f.place.id, after: { id: row.id, kind, at } });
  const day = at.toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  await tellOwner(a, f.ownerId, `${STEP_KINDS[kind]} booked — ${f.place.name}`, `${who(a)} booked a ${STEP_KINDS[kind].toLowerCase()} at ${f.place.name}${f.place.address ? `, ${f.place.address}` : ""} on ${day}.`, `/admin/field/org/${f.place.id}`);
  refresh();
  return { ok: `${STEP_KINDS[kind]} saved for ${day}.` };
}

export async function fieldStepStatus(form: FormData) {
  const a = await actor();
  const id = s(form, "id", 40), status = s(form, "status", 12);
  if (!ID.test(id) || !["done", "cancelled", "planned"].includes(status)) return;
  const st = await db.query.fieldSteps.findFirst({ where: eq(fieldSteps.id, id) });
  if (!st || !mayWork(a, st.ownerId)) return;
  await db.update(fieldSteps).set({ status, updatedAt: new Date() }).where(eq(fieldSteps.id, id));
  await logActivity({ actorUserId: a.user.id, action: "field.step_status", targetType: "field_step", targetId: id, before: { status: st.status }, after: { status } });
  refresh();
}

/* ───────────── Cards ───────────── */

/**
 * Cards for an organization from the owner's supply. An assistant's request waits for the owner (status planned,
 * requested_by); an owner's own goes straight to Assigned. Never more than what's left (checked in the statement).
 */
export async function fieldRequestCards(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const f = await placeFor(a, s(form, "placeId", 40));
  if (!f) return { error: "That organization isn't in your area." };
  const { cardSupply } = await import("@/lib/field");
  const supply = await cardSupply(f.ownerId);
  const pick = supply.find((x) => x.id === s(form, "batchId", 40)) ?? (supply.length === 1 ? supply[0] : null);
  if (!pick) return { error: supply.length ? "Choose which cards." : "There are no published cards for this area yet." };
  const qty = Number(s(form, "quantity", 6) || DEFAULT_CARDS_PER_ORG);
  if (!Number.isInteger(qty) || qty < 1 || qty > 1000) return { error: "Enter how many cards." };
  const day = s(form, "date", 10);
  const at = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T17:00:00Z`) : new Date();
  const isRequest = !!a.assistant;
  const status = isRequest ? "planned" : "assigned";
  const notes = s(form, "notes", 300) || null;
  const r = await db.execute(sql`insert into voucher_distributions (batch_id, place_id, quantity, delivered, status, distributed_at, notes, created_by, requested_by, approved_by, approved_at, updated_at)
    select ${pick.id}, ${f.place.id}, ${qty}, 0, ${status}, ${at.toISOString()}, ${notes}, ${a.user.id}, ${isRequest ? a.user.id : null}, ${isRequest ? null : a.user.id}, ${isRequest ? null : new Date().toISOString()}, now()
    where (select coalesce(sum(quantity), 0) from voucher_distributions where batch_id = ${pick.id} and status <> 'cancelled') + ${qty} <= ${pick.count}
    returning id`);
  const row = r.rows[0] as { id: string } | undefined;
  if (!row) return { error: `Only ${pick.left} cards are left.` };
  const after = { place: f.place.name, quantity: qty, status, date: at, notes, request: isRequest };
  await db.insert(voucherDistributionEvents).values({ distributionId: row.id, actorId: a.user.id, action: isRequest ? "requested" : "created", after });
  await logActivity({ actorUserId: a.user.id, action: isRequest ? "field.cards_requested" : "vouchers.assigned", targetType: "voucher_distribution", targetId: row.id, after });
  await tellOwner(a, f.ownerId, `Card request — ${f.place.name}`, `${who(a)} asked for ${qty} cards for ${f.place.name}. Approve or decline it in Field team.`, "/admin/field#requests");
  refresh(); revalidatePath("/admin/my-vouchers"); revalidatePath("/admin/cards");
  return { ok: isRequest ? `${qty} cards requested — waiting for approval.` : `${qty} cards assigned to ${f.place.name}.` };
}

/** Owner approves (→ Assigned) or declines (→ Canceled) an assistant's card request. Never an assistant. */
export async function decideCardRequest(form: FormData) {
  const a = await actor();
  if (a.assistant) return;
  const id = s(form, "id", 40), yes = s(form, "decision", 10) === "approve";
  if (!ID.test(id)) return;
  const d = await db.query.voucherDistributions.findFirst({ where: eq(voucherDistributions.id, id) });
  if (!d || d.status !== "planned" || !d.requestedBy) return;
  const batch = await db.query.nearestCardBatches.findFirst({ where: (b, { eq: e }) => e(b.id, d.batchId), columns: { distributorId: true } });
  if (!mayWork(a, batch?.distributorId)) return;
  const status = yes ? "assigned" : "cancelled";
  await db.update(voucherDistributions).set({ status, approvedBy: yes ? a.user.id : null, approvedAt: yes ? new Date() : null, updatedAt: new Date() }).where(and(eq(voucherDistributions.id, id), eq(voucherDistributions.status, "planned")));
  await db.insert(voucherDistributionEvents).values({ distributionId: id, actorId: a.user.id, action: yes ? "approved" : "declined", before: { status: "planned" }, after: { status } });
  await logActivity({ actorUserId: a.user.id, action: yes ? "field.cards_approved" : "field.cards_declined", targetType: "voucher_distribution", targetId: id, before: { status: "planned" }, after: { status, quantity: d.quantity } });
  refresh(); revalidatePath("/admin/my-vouchers"); revalidatePath("/admin/cards");
}

/* ───────────── Pop-ups ───────────── */

export async function savePopup(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const id = s(form, "id", 40);
  const existing = ID.test(id) ? await db.query.fieldPopups.findFirst({ where: eq(fieldPopups.id, id) }) : null;
  if (id && (!existing || !mayWork(a, existing.ownerId))) return { error: "That pop-up isn't yours." };
  const name = s(form, "name", 120), street = s(form, "street", 160), state = (s(form, "state", 2) || "TX").toUpperCase(), zip = s(form, "zip", 10);
  const kind = s(form, "kind", 10) === "vendor" ? "vendor" : "ours";
  const date = s(form, "date", 10), start = when(date, s(form, "start", 5)), end = when(date, s(form, "end", 5));
  if (!name) return { error: "Name the pop-up." };
  if (street.length < 5 || !/\d/.test(street)) return { error: "Enter the street address." };
  if (!/^\d{5}(-\d{4})?$/.test(zip)) return { error: "Enter the 5-digit ZIP code." };
  const city = await findCity(s(form, "city", 80), state);
  if (!city) return { error: "We couldn't find that city. Check the spelling and the state." };
  if (!start || !end || end <= start) return { error: "Enter the date, start time and end time." };
  const src = s(form, "sourceUrl", 400);
  if (src && !/^https?:\/\//i.test(src)) return { error: "The event listing link should start with https://" };
  // Whose pop-up: the area it's in, else the person working it.
  const ownerId = existing?.ownerId ?? (a.scope ?? (await areaOwnerFor(city.id, zip)) ?? a.ownerId);
  if (!mayWork(a, ownerId)) return { error: "That address is in another owner's area." };
  const v = {
    name, kind, hostName: s(form, "hostName", 120) || null, street, cityId: city.id, cityName: city.name, state, zip, startsAt: start, endsAt: end,
    details: s(form, "details", 1500) || null, sourceUrl: src || null, contactName: s(form, "contactName", 100) || null, contact: s(form, "contact", 160) || null, notes: s(form, "notes", 1500) || null,
    spaceCost: s(form, "spaceCost", 120) || null, vendorFee: s(form, "vendorFee", 120) || null, ourFee: s(form, "ourFee", 120) || null, bring: s(form, "bring", 600) || null,
    status: ["planned", "confirmed"].includes(s(form, "status", 12)) ? s(form, "status", 12) : existing?.status ?? "planned",
  };
  const paid = (x: string | null) => !!x && !/^(free|\$?0(\.00)?|none|no)$/i.test(x.trim());
  if (a.assistant && v.status === "confirmed" && existing?.status !== "confirmed" && (paid(v.spaceCost) || paid(v.vendorFee))) return { error: "This pop-up costs money — save it as Planned. Your owner confirms it." };
  if (existing) {
    await db.update(fieldPopups).set({ ...v, updatedAt: new Date() }).where(eq(fieldPopups.id, existing.id));
    await logActivity({ actorUserId: a.user.id, action: "field.popup_changed", targetType: "field_popup", targetId: existing.id, after: { name, at: start, status: v.status } });
  } else {
    const [row] = await db.insert(fieldPopups).values({ ...v, ownerId, createdBy: a.user.id }).returning();
    await logActivity({ actorUserId: a.user.id, action: "field.popup_added", targetType: "field_popup", targetId: row.id, after: { name, at: start, status: v.status } });
    await tellOwner(a, ownerId, `Pop-up booked — ${name}`, `${who(a)} set up "${name}" at ${street}, ${city.name} on ${fmtDate(start)} (${v.status}).`, "/admin/field/popups");
  }
  // Anything that costs money goes to the owner (assistants never pay or agree to a fee).
  const costs = [v.spaceCost && `space: ${v.spaceCost}`, v.vendorFee && `vendor fee: ${v.vendorFee}`].filter(Boolean);
  const free = (x: string | null) => !x || /^(free|\$?0(\.00)?|none|no)$/i.test(x.trim());
  if (a.assistant && (!free(v.spaceCost) || !free(v.vendorFee)) && (!existing || existing.spaceCost !== v.spaceCost || existing.vendorFee !== v.vendorFee))
    await tellOwner(a, ownerId, `Pop-up needs your OK — ${name}`, `${who(a)}: "${name}" costs money (${costs.join(", ")}). Only you agree to or pay a fee.`, "/admin/field/popups");
  refresh(); revalidatePath("/pop-ups", "layout");
  return { ok: existing ? "Pop-up saved." : `Pop-up saved.${v.status === "confirmed" ? " Its public page is live." : " Mark it Confirmed when it's set to show its public page."}` };
}

export async function popupStatus(form: FormData) {
  const a = await actor();
  const id = s(form, "id", 40), status = s(form, "status", 12);
  if (!ID.test(id) || !["planned", "confirmed", "done", "cancelled"].includes(status)) return;
  const p = await db.query.fieldPopups.findFirst({ where: eq(fieldPopups.id, id) });
  if (!p || !mayWork(a, p.ownerId)) return;
  if (a.assistant && status === "confirmed" && p.status !== "confirmed" && [p.spaceCost, p.vendorFee].some((x) => !!x && !/^(free|\$?0(\.00)?|none|no)$/i.test(x.trim()))) return; // costs money → owner confirms
  const signupsRaw = s(form, "signups", 5);
  const signups = signupsRaw === "" ? p.signups : Math.max(0, Math.min(9999, Math.round(Number(signupsRaw)) || 0));
  await db.update(fieldPopups).set({ status, signups, updatedAt: new Date() }).where(eq(fieldPopups.id, id));
  await logActivity({ actorUserId: a.user.id, action: "field.popup_status", targetType: "field_popup", targetId: id, before: { status: p.status, signups: p.signups }, after: { status, signups } });
  refresh(); revalidatePath("/pop-ups", "layout");
}

/* ───────────── Professionals ───────────── */

/** Add a professional to the owner's prospects (an assistant is recorded as who entered it), and optionally email the sign-up link. */
export async function teamAddProspect(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const p = { name: s(form, "name", 120), business: s(form, "business", 120), city: s(form, "city", 80), state: (s(form, "state", 2) || "TX").toUpperCase(), category: s(form, "category", 80), email: s(form, "email", 160), phone: s(form, "phone", 30), source: s(form, "source", 60) || "Field team", notes: s(form, "notes", 1000) };
  if (!p.name) return { error: "Enter their name." };
  const send = form.get("send") === "on";
  if (send && !EMAIL.test(p.email)) return { error: "Add their email to send the sign-up link." };
  const c = await checkProspect(p);
  if (c.kind === "no_contact") return { error: "Add an email or phone number." };
  if (c.kind === "suppressed") return { error: "This person asked not to be contacted." };
  if (c.kind === "registered") return { error: "This person already has a Nearest account." };
  if (c.kind === "duplicate") return { error: `Already in Outreach${c.recruiter ? ` with ${c.recruiter}` : ""} (status: ${c.status}).` };
  const [cityId, cat] = await Promise.all([resolvePlace(p.city, p.state), resolveCategory(p.category)]);
  const recruiterId = a.scope ?? ((await areaOwnerFor(cityId)) || a.ownerId);
  const [row] = await db.insert(prospects).values({
    recruiterId, name: p.name, business: p.business || null, city: p.city || null, state: p.state, cityId, category: cat?.name ?? (p.category || null), categoryId: cat?.id ?? null,
    email: p.email || null, emailNorm: normEmail(p.email), phone: p.phone || null, phoneNorm: normPhone(p.phone), source: p.source, notes: p.notes || null,
    status: send ? "link_sent" : "approved", enteredBy: a.assistant ? a.user.id : null, entryMethod: a.assistant ? "manual" : null, linkSentAt: send ? new Date() : null,
  }).returning();
  await logProspect(row.id, "added", `Added by ${who(a)} (field team)`, a.user.id);
  if (send) {
    await emailSignupLink(a, recruiterId, p.email, p.name);
    await logProspect(row.id, "link_sent", `Sign-up link emailed by ${who(a)}`, a.user.id);
  }
  await logActivity({ actorUserId: a.user.id, action: "field.prospect_added", targetType: "prospect", targetId: row.id, after: { name: p.name, city: p.city, sent: send } });
  refresh(); revalidatePath("/admin/outreach");
  return { ok: send ? `${p.name} added and the sign-up link was emailed.` : `${p.name} added.` };
}

async function emailSignupLink(a: FieldActor, ownerId: string, to: string, name: string) {
  const { partners } = await import("@/lib/partner");
  const code = (await partners()).find((x) => x.userId === ownerId)?.code;
  const url = `${APP()}/pro/sign-up${code ? `?ref=${encodeURIComponent(code)}` : ""}`;
  await sendEmail({
    to, subject: "Your invitation to join Nearest", eyebrow: "Nearest for professionals", heading: `${name.split(" ")[0]}, here's your link to join Nearest.`,
    lines: ["Nearest is a booking platform where verified students book verified beauty professionals.", "Joining is free — create your account, set up your profile and services, and submit it for review.", `${who(a)} from Nearest sent you this link. Just reply to this email with any questions.`],
    button: { label: "Create my professional account", url }, replyTo: a.user.email ?? undefined,
  }).catch(() => undefined);
  return url;
}

/** Email the sign-up link to a prospect already in Outreach (the owner's own). */
export async function teamSendLink(form: FormData) {
  const a = await actor();
  const id = s(form, "id", 40);
  if (!ID.test(id)) return;
  const p = await db.query.prospects.findFirst({ where: eq(prospects.id, id) });
  if (!p || !p.email || !mayWork(a, p.recruiterId)) return;
  await emailSignupLink(a, p.recruiterId!, p.email, p.name);
  await db.update(prospects).set({ status: ["approved", "contacted", "conversation", "interested", "scheduled", "no_response"].includes(p.status) ? "link_sent" : p.status, linkSentAt: new Date(), updatedAt: new Date() }).where(eq(prospects.id, id));
  await logProspect(id, "link_sent", `Sign-up link emailed by ${who(a)}`, a.user.id);
  refresh(); revalidatePath("/admin/outreach");
}

/** A note / call / email on a prospect (goes on their Outreach timeline). */
export async function teamProspectNote(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const id = s(form, "id", 40);
  const p = ID.test(id) ? await db.query.prospects.findFirst({ where: eq(prospects.id, id) }) : null;
  if (!p || !mayWork(a, p.recruiterId)) return { error: "That prospect isn't yours." };
  const kind = TOUCH_KINDS[s(form, "kind", 10)] ? s(form, "kind", 10) : "note";
  const text = s(form, "summary", 1000);
  if (!text) return { error: "Write what happened." };
  await logProspect(id, "note", `${TOUCH_KINDS[kind]} — ${text} (${who(a)})`, a.user.id);
  await db.update(prospects).set({ lastContactAt: kind === "note" ? p.lastContactAt : new Date(), updatedAt: new Date() }).where(eq(prospects.id, id));
  refresh(); revalidatePath("/admin/outreach");
  return { ok: "Saved." };
}

/* ───────────── Ads ───────────── */

export async function saveAdDraft(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const id = s(form, "id", 40);
  const existing = ID.test(id) ? await db.query.adDrafts.findFirst({ where: eq(adDrafts.id, id) }) : null;
  if (id && (!existing || !mayWork(a, existing.ownerId))) return { error: "That ad isn't yours." };
  if (existing && a.assistant && ["approved", "launched"].includes(existing.status)) return { error: "This ad is already approved — ask the owner to make changes." };
  const platform = ["facebook", "instagram", "tiktok", "google"].includes(s(form, "platform", 20)) ? s(form, "platform", 20) : "";
  const name = s(form, "name", 120);
  if (!platform) return { error: "Choose the platform." };
  if (!name) return { error: "Name the campaign." };
  const budget = s(form, "budget", 10);
  const budgetCents = budget ? Math.round(Number(budget) * 100) : null;
  if (budgetCents !== null && !(budgetCents > 0 && budgetCents <= 10000000)) return { error: "Check the budget." };
  const link = s(form, "link", 500), creative = s(form, "creative", 500);
  if ((link && !/^https?:\/\//i.test(link)) || (creative && !/^https?:\/\//i.test(creative))) return { error: "Links should start with https://" };
  const submit = s(form, "intent", 10) === "submit";
  const v = {
    platform, name, goal: s(form, "goal", 200) || null, audience: s(form, "audience", 1000) || null, budgetCents, budgetKind: s(form, "budgetKind", 10) === "total" ? "total" : "daily",
    startsOn: /^\d{4}-\d{2}-\d{2}$/.test(s(form, "startsOn", 10)) ? s(form, "startsOn", 10) : null, endsOn: /^\d{4}-\d{2}-\d{2}$/.test(s(form, "endsOn", 10)) ? s(form, "endsOn", 10) : null,
    headline: s(form, "headline", 200) || null, primaryText: s(form, "primaryText", 2000) || null, link: link || null, creative: creative || null, notes: s(form, "notes", 1000) || null,
    status: submit ? "submitted" : existing?.status === "changes" ? "changes" : existing?.status ?? "draft",
  };
  const ownerId = existing?.ownerId ?? a.ownerId;
  let rowId = existing?.id;
  if (existing) await db.update(adDrafts).set({ ...v, updatedAt: new Date() }).where(eq(adDrafts.id, existing.id));
  else rowId = (await db.insert(adDrafts).values({ ...v, ownerId, createdBy: a.user.id }).returning())[0].id;
  await logActivity({ actorUserId: a.user.id, action: submit ? "field.ad_submitted" : "field.ad_saved", targetType: "ad_draft", targetId: rowId!, after: { name, platform, status: v.status } });
  if (submit) await tellOwner(a, ownerId, `Ad ready for approval — ${name}`, `${who(a)} prepared a ${platform} ad "${name}". Review and approve it in Field team → Ads.`, "/admin/field/ads");
  refresh();
  return { ok: submit ? "Sent for approval." : "Draft saved." };
}

/** Owner: approve, ask for changes, or mark launched (after setting it up and paying in the ad platform). */
export async function reviewAdDraft(form: FormData) {
  const a = await actor();
  if (a.assistant) return;
  const id = s(form, "id", 40), decision = s(form, "decision", 12);
  if (!ID.test(id) || !["approved", "changes", "launched"].includes(decision)) return;
  const d = await db.query.adDrafts.findFirst({ where: eq(adDrafts.id, id) });
  if (!d || !mayWork(a, d.ownerId)) return;
  await db.update(adDrafts).set({ status: decision, reviewNote: s(form, "note", 1000) || d.reviewNote, reviewedBy: a.user.id, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(adDrafts.id, id));
  await logActivity({ actorUserId: a.user.id, action: `field.ad_${decision}`, targetType: "ad_draft", targetId: id, before: { status: d.status }, after: { status: decision } });
  refresh();
}

/** Ad spend from the platform's own numbers (for cost per vote). Owners and their assistants. */
export async function fieldAddSpend(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const platform = ["facebook", "instagram", "tiktok", "google", "other"].includes(s(form, "platform", 20)) ? s(form, "platform", 20) : "";
  const campaign = s(form, "campaign", 120);
  const amountCents = Math.round(Number(s(form, "amount", 12)) * 100);
  const fromDay = s(form, "fromDay", 10), toDay = s(form, "toDay", 10);
  if (!platform) return { error: "Choose the platform." };
  if (!campaign) return { error: "Enter the campaign name exactly as in the ad link (utm_campaign)." };
  if (!(amountCents > 0)) return { error: "Enter what was spent." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDay) || !/^\d{4}-\d{2}-\d{2}$/.test(toDay) || toDay < fromDay) return { error: "Enter the dates the spend covers." };
  const [r] = await db.insert(adSpend).values({ platform, campaign, amountCents, fromDay, toDay, createdBy: a.user.id }).returning();
  await logActivity({ actorUserId: a.user.id, action: "live.spend_added", targetType: "ad_spend", targetId: r.id, after: { platform, campaign, amountCents, fromDay, toDay } });
  refresh(); revalidatePath("/admin/live");
  return { ok: "Spend saved." };
}

/** Ad tracking IDs (site-wide) — the main owner or the main owner's assistant. */
export async function saveTrackingIds(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const { mainOwnerId } = await import("@/lib/partner");
  if (a.ownerId !== (await mainOwnerId())) return { error: "Only the main owner's team can change the tracking IDs." };
  const changes: Record<string, string> = {};
  for (const f of TRACKING_FIELDS) {
    const v = s(form, f.key, 60);
    if (v && !f.re.test(v)) return { error: `${f.label} doesn't look right (${f.hint}).` };
    changes[f.key] = v;
  }
  for (const [key, id] of Object.entries(changes)) {
    const value = { id };
    await db.insert(platformSettings).values({ key, value, updatedBy: a.user.id }).onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedBy: a.user.id, updatedAt: new Date() } });
  }
  await logActivity({ actorUserId: a.user.id, action: "field.tracking_saved", targetType: "setting", targetId: "tracking", after: changes });
  refresh(); revalidatePath("/vote"); revalidatePath("/admin/live");
  return { ok: "Tracking saved. It's on the voting page now (after a visitor allows ad measurement)." };
}

/* ───────────── Assistants (owners only) ───────────── */

async function ownerOnly() {
  const a = await actor();
  if (a.assistant) throw new Error("Only an owner can do this.");
  return a;
}

export async function inviteTeamAssistant(_: FormState, form: FormData): Promise<FormState> {
  const a = await ownerOnly();
  const name = s(form, "name", 80), email = s(form, "email", 160).toLowerCase();
  if (!name) return { error: "Enter your assistant's name." };
  if (!EMAIL.test(email)) return { error: "Enter a valid email." };
  if (email === a.user.email?.toLowerCase()) return { error: "That's your own email — your assistant needs their own." };
  const taken = await db.query.users.findFirst({ where: eq(users.email, email), columns: { accountType: true } });
  if (taken && taken.accountType !== "staff") return { error: "That email already has a student or professional account. Use a different email (for example a @usenearest.com address)." };
  const mine = await db.select().from(teamAssistants).where(and(eq(teamAssistants.ownerId, a.user.id), inArray(teamAssistants.status, ["invited", "active"])));
  if (mine.some((x) => x.email === email)) return { error: "You already added this email." };
  if (mine.length >= MAX_TEAM_ASSISTANTS) return { error: `You can have up to ${MAX_TEAM_ASSISTANTS} assistants. Remove one first.` };
  const token = newTeamToken();
  const [row] = await db.insert(teamAssistants).values({ ownerId: a.user.id, name, email, token, inviteExpiresAt: new Date(Date.now() + TEAM_INVITE_DAYS * 86400000) }).returning();
  await emailTeamInvite(email, name, who(a), token);
  await logActivity({ actorUserId: a.user.id, action: "team.assistant_invited", targetType: "team_assistant", targetId: row.id, after: { name, email } });
  refresh();
  return { ok: `Invitation sent to ${email}.` };
}

async function emailTeamInvite(to: string, name: string, owner: string, token: string) {
  await sendEmail({
    to, subject: `${owner} invited you to Nearest's field team`, eyebrow: "Field team invitation", heading: `Welcome to the Nearest field team, ${name.split(" ")[0]}.`,
    lines: [`${owner} added you as their assistant on Nearest.`, "You'll create your own login to work their outreach: organizations, calls and emails, meetings and card drop-offs, pop-up events, professional sign-ups, ad prep and the live vote map.", `This link works for ${TEAM_INVITE_DAYS} days.`],
    button: { label: "Accept and create my login", url: `${APP()}/outreach/join/${token}` },
  }).catch(() => undefined);
}

export async function resendTeamAssistant(form: FormData) {
  const a = await ownerOnly();
  const id = s(form, "id", 40);
  if (!ID.test(id)) return;
  const token = newTeamToken();
  const [row] = await db.update(teamAssistants).set({ token, inviteExpiresAt: new Date(Date.now() + TEAM_INVITE_DAYS * 86400000) })
    .where(and(eq(teamAssistants.id, id), a.scope ? eq(teamAssistants.ownerId, a.user.id) : sql`true`, eq(teamAssistants.status, "invited"))).returning();
  if (row) {
    await emailTeamInvite(row.email, row.name, who(a), token);
    await logActivity({ actorUserId: a.user.id, action: "team.assistant_resent", targetType: "team_assistant", targetId: id });
  }
  refresh();
}

export async function removeTeamAssistant(form: FormData) {
  const a = await ownerOnly();
  const id = s(form, "id", 40);
  if (!ID.test(id)) return;
  const [row] = await db.update(teamAssistants).set({ status: "removed", removedAt: new Date() })
    .where(and(eq(teamAssistants.id, id), a.scope ? eq(teamAssistants.ownerId, a.user.id) : sql`true`)).returning();
  if (row) await logActivity({ actorUserId: a.user.id, action: "team.assistant_removed", targetType: "team_assistant", targetId: id, after: { name: row.name, email: row.email } });
  refresh();
}

/* ───────────── Areas (main owner only) ───────────── */

async function mainOnly() {
  const a = await actor();
  if (!a.main) throw new Error("Only the main owner can change areas.");
  return a;
}

export async function applyAreaSplit(_: FormState, form: FormData): Promise<FormState> {
  const a = await mainOnly();
  const north = s(form, "north", 40), south = s(form, "south", 40), east = s(form, "east", 40);
  if (![north, south, east].every((x) => ID.test(x))) return { error: "Choose who has North, South and East." };
  const r = await applyStartingSplit({ north, south, east }, a.user.id);
  await logActivity({ actorUserId: a.user.id, action: "areas.split_applied", targetType: "areas", targetId: "dfw", after: { north, south, east, ...r } });
  refresh();
  return { ok: `Areas set: ${r.cities} cities and ${r.zips} Dallas ZIP codes.` };
}

export async function setCityArea(form: FormData) {
  const a = await mainOnly();
  const cityId = Number(s(form, "cityId", 10)), ownerId = s(form, "ownerId", 40);
  if (!Number.isInteger(cityId) || cityId < 1) return;
  const before = await db.query.areaCities.findFirst({ where: eq(areaCities.cityId, cityId) });
  if (!ownerId) await db.delete(areaCities).where(eq(areaCities.cityId, cityId));
  else if (ID.test(ownerId)) await db.insert(areaCities).values({ cityId, ownerId, updatedBy: a.user.id }).onConflictDoUpdate({ target: areaCities.cityId, set: { ownerId, updatedBy: a.user.id, updatedAt: new Date() } });
  await logActivity({ actorUserId: a.user.id, action: "areas.city", targetType: "city", targetId: String(cityId), before: { ownerId: before?.ownerId ?? null }, after: { ownerId: ownerId || null } });
  refresh();
}

export async function setZipArea(_: FormState, form: FormData): Promise<FormState> {
  const a = await mainOnly();
  const zips = s(form, "zips", 2000).split(/[\s,]+/).filter(Boolean);
  const ownerId = s(form, "ownerId", 40);
  if (!zips.length || !zips.every((z) => /^\d{5}$/.test(z))) return { error: "Enter 5-digit ZIP codes, separated by spaces or commas." };
  if (ownerId && !ID.test(ownerId)) return { error: "Choose who." };
  const cityId = s(form, "city", 80) ? (await findCity(s(form, "city", 80), "TX"))?.id ?? null : null;
  for (const zip of zips) {
    if (!ownerId) await db.delete(areaZips).where(eq(areaZips.zip, zip));
    else await db.insert(areaZips).values({ zip, ownerId, cityId, updatedBy: a.user.id }).onConflictDoUpdate({ target: areaZips.zip, set: { ownerId, ...(cityId ? { cityId } : {}), updatedBy: a.user.id, updatedAt: new Date() } });
  }
  await logActivity({ actorUserId: a.user.id, action: "areas.zips", targetType: "zip", targetId: zips.join(","), after: { ownerId: ownerId || null } });
  refresh();
  return { ok: ownerId ? `${zips.length} ZIP code${zips.length === 1 ? "" : "s"} saved.` : `${zips.length} ZIP code${zips.length === 1 ? "" : "s"} removed (they follow their city again).` };
}

/* ───────────── Assistant logins & signing (owners only, 2026-11-23) ───────────── */

const words = ["North", "Field", "Bloom", "Glow", "Studio", "Velvet", "Rose", "Grace", "Shine", "Polish"];
function makePassword() {
  const r = (n: number) => Math.floor(Math.random() * n);
  return `${words[r(words.length)]}-${words[r(words.length)]}-${1000 + r(9000)}!`;
}

/** Create an assistant's login with a password the owner sets (or one made for them) — ready right away. */
export async function createAssistantLogin(_: FormState, form: FormData): Promise<FormState> {
  const a = await ownerOnly();
  const name = s(form, "name", 80), email = s(form, "email", 160).toLowerCase();
  const legalName = s(form, "legalName", 120), title = s(form, "title", 120);
  let password = String(form.get("password") ?? "").trim();
  if (!name) return { error: "Enter the name she goes by." };
  if (!EMAIL.test(email)) return { error: "Enter a valid email." };
  if (password && password.length < 10) return { error: "Use at least 10 characters for the password, or leave it empty and one is made for you." };
  if (password.length > 128) return { error: "That password is too long." };
  if (!password) password = makePassword();
  const taken = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (taken && taken.accountType !== "staff") return { error: "That email already has a student or professional account. Use a different email." };
  const mine = await db.select().from(teamAssistants).where(and(eq(teamAssistants.ownerId, a.user.id), inArray(teamAssistants.status, ["invited", "active"])));
  if (mine.some((x) => x.email === email)) return { error: "You already added this email." };
  if (mine.length >= MAX_TEAM_ASSISTANTS) return { error: `You can have up to ${MAX_TEAM_ASSISTANTS} assistants. Remove one first.` };
  const { clerkClient } = await import("@clerk/nextjs/server");
  const clerk = await clerkClient();
  const [first, ...rest] = (legalName || name).split(" ");
  let clerkId: string;
  try {
    const found = await clerk.users.getUserList({ emailAddress: [email] });
    if (found.data[0]) {
      clerkId = found.data[0].id;
      await clerk.users.updateUser(clerkId, { password, skipPasswordChecks: true });
    } else {
      const cu = await clerk.users.createUser({ emailAddress: [email], password, skipPasswordChecks: true, firstName: first, lastName: rest.join(" ") || undefined, unsafeMetadata: { door: "team" } });
      clerkId = cu.id;
    }
  } catch (e) {
    console.error("create assistant login", e);
    return { error: "We couldn't create the sign-in. Try a different password, or use Email her a link instead." };
  }
  let u = taken ?? (await db.query.users.findFirst({ where: eq(users.clerkUserId, clerkId) }));
  if (!u) [u] = await db.insert(users).values({ clerkUserId: clerkId, accountType: "staff", firstName: first, lastName: rest.join(" ") || null, email, emailVerifiedAt: new Date() }).returning();
  else await db.update(users).set({ clerkUserId: clerkId, emailVerifiedAt: u.emailVerifiedAt ?? new Date(), updatedAt: new Date() }).where(eq(users.id, u.id));
  const [row] = await db.insert(teamAssistants).values({ ownerId: a.user.id, name, email, token: newTeamToken(), status: "active", userId: u.id, acceptedAt: new Date(), inviteExpiresAt: new Date(),
    legalName: legalName || null, title: title || null, canSign: form.get("canSign") === "on" }).returning();
  await logActivity({ actorUserId: a.user.id, action: "team.assistant_login_created", targetType: "team_assistant", targetId: row.id, after: { name, email, legalName, title, canSign: row.canSign } });
  refresh();
  return { ok: `Login ready. Email: ${email} · Password: ${password} — give her these, she signs in at usenearest.com/sign-in. (Shown once.)` };
}

export async function resetAssistantPassword(_: FormState, form: FormData): Promise<FormState> {
  const a = await ownerOnly();
  const id = s(form, "id", 40);
  const row = ID.test(id) ? await db.query.teamAssistants.findFirst({ where: eq(teamAssistants.id, id) }) : null;
  if (!row || row.status !== "active" || !row.userId || (a.scope && row.ownerId !== a.user.id)) return { error: "Not found." };
  let password = String(form.get("password") ?? "").trim();
  if (password && password.length < 10) return { error: "Use at least 10 characters." };
  if (!password) password = makePassword();
  const u = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
  try { const { clerkClient } = await import("@clerk/nextjs/server"); await (await clerkClient()).users.updateUser(u!.clerkUserId, { password, skipPasswordChecks: true }); }
  catch (e) { console.error("reset assistant password", e); return { error: "We couldn't change the password. Try a different one." }; }
  await logActivity({ actorUserId: a.user.id, action: "team.assistant_password_reset", targetType: "team_assistant", targetId: row.id });
  return { ok: `New password for ${row.email}: ${password} (shown once).` };
}

/** Signing for Nearest: legal name + department, and the owner's switch. */
export async function saveAssistantSigner(_: FormState, form: FormData): Promise<FormState> {
  const a = await ownerOnly();
  const id = s(form, "id", 40);
  const row = ID.test(id) ? await db.query.teamAssistants.findFirst({ where: eq(teamAssistants.id, id) }) : null;
  if (!row || (a.scope && row.ownerId !== a.user.id)) return { error: "Not found." };
  const legalName = s(form, "legalName", 120), title = s(form, "title", 120), canSign = form.get("canSign") === "on";
  if (canSign && (!legalName || !title)) return { error: "Add her legal name and department to let her sign." };
  await db.update(teamAssistants).set({ legalName: legalName || null, title: title || null, canSign }).where(eq(teamAssistants.id, row.id));
  await logActivity({ actorUserId: a.user.id, action: "team.assistant_signer", targetType: "team_assistant", targetId: row.id, before: { legalName: row.legalName, title: row.title, canSign: row.canSign }, after: { legalName, title, canSign } });
  refresh();
  return { ok: canSign ? `${legalName} can sign agreements for Nearest.` : "Saved — she can't sign agreements." };
}
