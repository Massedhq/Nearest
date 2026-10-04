"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, prospects, prospectImports, outreachSuppression } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { checkProspect, normEmail, normPhone, resolvePlace, resolveCategory, logProspect, notifyAdmins, outreachScope, type ProspectInput, type CheckResult } from "@/lib/outreach";

type FormState = { error?: string; ok?: string };
const s = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);

async function canTouch(userId: string, recruiterId: string | null) {
  return recruiterId === userId || (await outreachScope(userId)).isMain;
}

async function create(p: ProspectInput, recruiterId: string, actorId: string, importId?: string) {
  const [cityId, cat] = await Promise.all([resolvePlace(p.city, p.state), resolveCategory(p.category)]);
  const [row] = await db.insert(prospects).values({
    recruiterId, name: p.name || "Unknown", business: p.business || null, city: p.city || null, state: (p.state || "TX").toUpperCase().slice(0, 2),
    cityId, category: cat?.name ?? p.category ?? null, categoryId: cat?.id ?? null,
    email: p.email || null, emailNorm: normEmail(p.email), phone: p.phone || null, phoneNorm: normPhone(p.phone),
    source: p.source || null, notes: p.notes || null, status: "approved", importId: importId ?? null,
  }).returning();
  await logProspect(row.id, importId ? "imported" : "added", p.source ? `Source: ${p.source}` : null, actorId);
  return row;
}

/** Add one prospect. Never creates a second record for someone already in Nearest. */
export async function addProspect(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const p: ProspectInput = { name: s(form, "name", 120), business: s(form, "business", 120), city: s(form, "city", 80), state: s(form, "state", 20) || "TX", category: s(form, "category", 80), email: s(form, "email", 120), phone: s(form, "phone", 30), source: s(form, "source", 60), notes: s(form, "notes", 1000) };
  if (!p.name) return { error: "Enter their name." };
  const recruiterId = (await outreachScope(user.id)).isMain && s(form, "recruiter", 40) ? s(form, "recruiter", 40) : user.id;
  const c = await checkProspect(p);
  if (c.kind === "no_contact") return { error: "Add an email or phone number." };
  if (c.kind === "suppressed") return { error: "This person asked not to be contacted, so they can't be added." };
  if (c.kind === "registered") return { error: "This person already has a Nearest account — no need to recruit them." };
  if (c.kind === "duplicate") {
    if (p.notes || p.source) await logProspect(c.prospectId, "note", `Also added${p.source ? ` (source: ${p.source})` : ""}${p.notes ? `: ${p.notes}` : ""}`, user.id);
    return { error: `Duplicate found — already in Outreach${c.recruiter ? ` with ${c.recruiter}` : ""} (status: ${c.status}). Your notes were added to their record; no second outreach was created.` };
  }
  if (c.kind === "possible" && form.get("addAnyway") !== "on") return { error: `Possible duplicate: someone with that name is already in ${p.city}${c.recruiter ? ` (with ${c.recruiter})` : ""}. Check "Add anyway" if this is a different person.` };
  const row = await create(p, recruiterId, user.id);
  revalidatePath("/admin/outreach");
  redirect(`/admin/outreach/prospects/${row.id}`);
}

/** Upload a list (Excel, CSV, Word, PDF) or paste one. Nothing is contacted — it goes to the review screen first. */
export async function uploadProspects(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const file = form.get("file");
  const pasted = s(form, "pasted", 200_000);
  const source = s(form, "source", 60) || null;
  let rows: ProspectInput[] = [];
  let filename = "Pasted list";
  try {
    const { parseProspectFile } = await import("@/lib/prospect-parse");
    if (file instanceof File && file.size > 0) {
      if (file.size > 10 * 1024 * 1024) return { error: "That file is over 10 MB. Split it into smaller files." };
      filename = file.name;
      rows = await parseProspectFile(file.name, Buffer.from(await file.arrayBuffer()));
    } else if (pasted) {
      rows = await parseProspectFile("pasted.txt", Buffer.from(pasted));
    } else return { error: "Choose a file or paste a list." };
  } catch (e) {
    console.error(e);
    return { error: "We couldn't read that file. Try saving it as Excel or CSV." };
  }
  if (!rows.length) return { error: "We didn't find any names with an email or phone number in that file." };
  const checked: (ProspectInput & { check: CheckResult; include: boolean })[] = [];
  const seenE = new Set<string>(), seenP = new Set<string>();
  for (const r of rows.slice(0, 2000)) {
    const row = { ...r, source: r.source || source };
    let check = await checkProspect(row);
    const e = normEmail(row.email), ph = normPhone(row.phone);
    if (check.kind === "ready" || check.kind === "no_city") {
      if ((e && seenE.has(e)) || (ph && seenP.has(ph))) check = { kind: "duplicate", prospectId: "", recruiter: "this file", status: "listed twice" };
    }
    if (e) seenE.add(e);
    if (ph) seenP.add(ph);
    checked.push({ ...row, check, include: check.kind === "ready" });
  }
  const [imp] = await db.insert(prospectImports).values({ recruiterId: user.id, filename, source, rows: checked }).returning();
  const issues = checked.filter((c) => c.check.kind === "duplicate" || c.check.kind === "possible").length;
  if (issues) await notifyAdmins({ kind: "import_review", title: "Import needs review", body: `${issues} possible duplicate${issues === 1 ? "" : "s"} in "${filename}".`, href: `/admin/outreach/import/${imp.id}` }, [user.id]);
  redirect(`/admin/outreach/import/${imp.id}`);
}

/** Approve the checked rows from an import. Only eligible rows become prospects. */
export async function approveImport(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const imp = await db.query.prospectImports.findFirst({ where: eq(prospectImports.id, s(form, "id", 40)) });
  if (!imp || imp.status !== "review") return { error: "This import was already handled." };
  if (!(await canTouch(user.id, imp.recruiterId))) return { error: "Not your import." };
  const rows = imp.rows as (ProspectInput & { check: CheckResult })[];
  const picked = new Set(form.getAll("row").map(String));
  let added = 0, skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!picked.has(String(i))) { skipped++; continue; }
    // Re-check at approval time — someone may have been added or registered since the upload.
    const c = await checkProspect(r);
    if (c.kind === "ready" || c.kind === "no_city" || (c.kind === "possible" && form.get(`force_${i}`) === "on")) {
      await create(r, imp.recruiterId ?? user.id, user.id, imp.id); added++;
    } else {
      if (c.kind === "duplicate" && c.prospectId && (r.notes || r.source)) await logProspect(c.prospectId, "note", `Also in "${imp.filename}"${r.source ? ` (source: ${r.source})` : ""}${r.notes ? `: ${r.notes}` : ""}`, user.id);
      skipped++;
    }
  }
  await db.update(prospectImports).set({ status: "done" }).where(eq(prospectImports.id, imp.id));
  revalidatePath("/admin/outreach");
  return { ok: `${added} prospect${added === 1 ? "" : "s"} added. ${skipped} skipped.` };
}

/** Edit a prospect, change their status, or add a note. */
export async function updateProspect(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const p = await db.query.prospects.findFirst({ where: eq(prospects.id, s(form, "id", 40)) });
  if (!p) return { error: "Not found." };
  if (!(await canTouch(user.id, p.recruiterId))) return { error: "This prospect belongs to another partner." };
  const email = s(form, "email", 120), phone = s(form, "phone", 30), city = s(form, "city", 80), category = s(form, "category", 80);
  const [cityId, cat] = await Promise.all([resolvePlace(city, s(form, "state", 20) || p.state), resolveCategory(category)]);
  const status = s(form, "status", 30) || p.status;
  const recruiter = (await outreachScope(user.id)).isMain && s(form, "recruiter", 40) ? s(form, "recruiter", 40) : p.recruiterId;
  await db.update(prospects).set({
    name: s(form, "name", 120) || p.name, business: s(form, "business", 120) || null, city: city || null, state: s(form, "state", 20) || p.state, cityId,
    category: cat?.name ?? (category || null), categoryId: cat?.id ?? null, email: email || null, emailNorm: normEmail(email), phone: phone || null, phoneNorm: normPhone(phone),
    source: s(form, "source", 60) || null, status, recruiterId: recruiter, updatedAt: new Date(),
  }).where(eq(prospects.id, p.id));
  if (status !== p.status) await logProspect(p.id, "status", `Status: ${p.status} → ${status}`, user.id);
  if (recruiter !== p.recruiterId) await logProspect(p.id, "reassigned", "Reassigned to another partner", user.id);
  const note = s(form, "note", 1000);
  if (note) await logProspect(p.id, "note", note, user.id);
  revalidatePath(`/admin/outreach/prospects/${p.id}`);
  return { ok: "Saved." };
}

/** Do not contact — added to the suppression list so they're never re-added from any future upload. */
export async function doNotContact(form: FormData) {
  const { user } = await requireAdmin();
  const p = await db.query.prospects.findFirst({ where: eq(prospects.id, s(form, "id", 40)) });
  if (!p || !(await canTouch(user.id, p.recruiterId))) return;
  if (p.emailNorm || p.phoneNorm) await db.insert(outreachSuppression).values({ emailNorm: p.emailNorm, phoneNorm: p.phoneNorm, reason: "Marked do-not-contact by admin" });
  await db.update(prospects).set({ status: "opted_out", updatedAt: new Date() }).where(eq(prospects.id, p.id));
  await logProspect(p.id, "opted_out", "Marked do not contact", user.id);
  revalidatePath(`/admin/outreach/prospects/${p.id}`);
}

/** Bell: mark everything read. */
export async function markNotificationsRead() {
  const { user } = await requireAdmin();
  const { adminNotifications } = await import("@/db");
  const { isNull } = await import("drizzle-orm");
  await db.update(adminNotifications).set({ readAt: new Date() }).where(and(eq(adminNotifications.userId, user.id), isNull(adminNotifications.readAt)));
  revalidatePath("/admin", "layout");
}

// ---------- Part 2: email outreach ----------

/** Save the outreach emails (and the mailing address shown in every email). */
export async function saveTemplates(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const { outreachTemplates } = await import("@/db");
  for (const key of ["first", "follow1", "follow2"] as const) {
    const subject = s(form, `${key}_subject`, 200), body = String(form.get(`${key}_body`) ?? "").trim().slice(0, 5000);
    if (!subject || !body) return { error: "Every email needs a subject and a message." };
    if (!body.includes("{link}")) return { error: `Add {link} to the ${key === "first" ? "first email" : key === "follow1" ? "first follow-up" : "last follow-up"} so they can claim their spot.` };
    await db.insert(outreachTemplates).values({ key, subject, body, updatedBy: user.id }).onConflictDoUpdate({ target: outreachTemplates.key, set: { subject, body, updatedBy: user.id, updatedAt: new Date() } });
  }
  const address = s(form, "address", 300);
  if (!address) return { error: "Add your mailing address — every outreach email must include one." };
  await db.insert(outreachTemplates).values({ key: "address", subject: "address", body: address, updatedBy: user.id }).onConflictDoUpdate({ target: outreachTemplates.key, set: { body: address, updatedBy: user.id, updatedAt: new Date() } });
  revalidatePath("/admin/outreach/templates");
  return { ok: "Saved. Every email from now on uses these." };
}

/** Email yourself a sample of one template. */
export async function sendTestOutreach(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  if (!user.email) return { error: "Your account has no email." };
  const key = (["first", "follow1", "follow2"].includes(String(form.get("key"))) ? String(form.get("key")) : "first") as "first" | "follow1" | "follow2";
  const { sendOutreach } = await import("@/lib/outreach-mail");
  const sample = { id: "00000000-0000-0000-0000-000000000000", recruiterId: user.id, name: "Christina Lopez", city: "The Colony", category: "Nails", cityId: null, categoryId: null, email: user.email } as unknown as typeof prospects.$inferSelect;
  const r = await sendOutreach(sample, key, user.email);
  return r.sent ? { ok: `Test sent to ${user.email}.` } : { error: r.reason ?? "Couldn't send the test." };
}

/** Put prospects into a batch and start it now or on a date. */
export async function createBatch(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const { outreachBatches } = await import("@/db");
  const { isNull, inArray, sql } = await import("drizzle-orm");
  const name = s(form, "name", 80) || `Outreach ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}`;
  const limit = Math.min(2000, Math.max(1, Number(form.get("limit")) || 100));
  const city = s(form, "city", 80), category = s(form, "category", 80);
  const when = s(form, "startAt", 20);
  let startAt = new Date();
  if (form.get("start") === "later") {
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(when);
    if (!m) return { error: "Choose the date and time to start." };
    startAt = (await import("@/lib/time")).chicagoToUtc(m[1], m[2]);
    if (startAt.getTime() < Date.now() - 60000) return { error: "Choose a time in the future." };
  }
  const ready = await db.select({ id: prospects.id }).from(prospects)
    .where(and(eq(prospects.recruiterId, user.id), eq(prospects.status, "approved"), isNull(prospects.batchId), sql`${prospects.emailNorm} is not null`,
      ...(city ? [sql`lower(${prospects.city}) = lower(${city})`] : []), ...(category ? [sql`lower(${prospects.category}) = lower(${category})`] : [])))
    .orderBy(prospects.createdAt).limit(limit);
  if (!ready.length) return { error: "No ready prospects with an email match those choices." };
  const [b] = await db.insert(outreachBatches).values({ recruiterId: user.id, name, status: "scheduled", startAt }).returning();
  await db.update(prospects).set({ batchId: b.id, updatedAt: new Date() }).where(inArray(prospects.id, ready.map((r) => r.id)));
  revalidatePath("/admin/outreach/queue");
  const t = startAt.getTime() <= Date.now() + 60000 ? "starts within 15 minutes" : `starts ${startAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}`;
  return { ok: `"${name}": ${ready.length} prospect${ready.length === 1 ? "" : "s"} — ${t}.` };
}

/** Pause, resume or cancel a batch. */
export async function setBatchStatus(form: FormData) {
  const { user } = await requireAdmin();
  const { outreachBatches } = await import("@/db");
  const id = s(form, "id", 40);
  const to = s(form, "to", 20);
  const b = await db.query.outreachBatches.findFirst({ where: eq(outreachBatches.id, id) });
  if (!b || !(await canTouch(user.id, b.recruiterId))) return;
  if (to === "paused" && ["running", "scheduled"].includes(b.status)) await db.update(outreachBatches).set({ status: "paused" }).where(eq(outreachBatches.id, id));
  if (to === "resume" && b.status === "paused") await db.update(outreachBatches).set({ status: b.startAt.getTime() > Date.now() ? "scheduled" : "running" }).where(eq(outreachBatches.id, id));
  if (to === "cancelled" && !["done", "cancelled"].includes(b.status)) {
    await db.update(outreachBatches).set({ status: "cancelled" }).where(eq(outreachBatches.id, id));
    const { isNull } = await import("drizzle-orm");
    // Anyone not emailed yet goes back to Ready; the rest just stop.
    await db.update(prospects).set({ batchId: null, status: "approved", nextEmailAt: null }).where(and(eq(prospects.batchId, id), eq(prospects.emailsSent, 0)));
    await db.update(prospects).set({ nextEmailAt: null }).where(and(eq(prospects.batchId, id), isNull(prospects.registeredUserId)));
  }
  revalidatePath("/admin/outreach/queue");
}

/** Master switch: pause every outreach email (owners). */
export async function setOutreachPaused(form: FormData) {
  const { user } = await requireAdmin({ owner: true });
  const { platformSettings } = await import("@/db");
  const value = form.get("paused") === "1";
  await db.insert(platformSettings).values({ key: "outreach.paused", value, updatedBy: user.id })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedBy: user.id, updatedAt: new Date() } });
  revalidatePath("/admin/outreach/queue");
}

/** Pause / resume one prospect's emails. */
export async function setProspectPaused(form: FormData) {
  const { user } = await requireAdmin();
  const id = s(form, "id", 40);
  const p = await db.query.prospects.findFirst({ where: eq(prospects.id, id) });
  if (!p || !(await canTouch(user.id, p.recruiterId))) return;
  const paused = form.get("paused") === "1";
  await db.update(prospects).set({ paused, updatedAt: new Date() }).where(eq(prospects.id, id));
  await logProspect(id, paused ? "paused" : "resumed", paused ? "Emails paused." : "Emails resumed.", user.id);
  revalidatePath(`/admin/outreach/prospects/${id}`);
}

// ---------- Part 3: AI recruiter ----------

/** A partner answers a prospect (from Needs review or the prospect page). Optionally saves it as an approved answer. */
export async function replyToProspect(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const id = s(form, "id", 40);
  const body = String(form.get("body") ?? "").trim().slice(0, 5000);
  if (!body) return { error: "Write your reply." };
  const p = await db.query.prospects.findFirst({ where: eq(prospects.id, id) });
  if (!p || !(await canTouch(user.id, p.recruiterId))) return { error: "Not found." };
  let text = body;
  if (form.get("withLink") === "on") {
    const { makeInviteLink } = await import("@/lib/outreach-mail");
    text = `${body}\n\nYour personal invite (good for 24 hours):\n${await makeInviteLink(p.id)}`;
  }
  const { sendReply } = await import("@/lib/outreach-ai");
  if (!(await sendReply(p, text, "admin", user.id))) return { error: "Couldn't send — check that email is set up and they have an email address." };
  await db.update(prospects).set({ status: form.get("withLink") === "on" ? "link_sent" : p.status === "needs_review" ? "conversation" : p.status, reviewQuestion: null, updatedAt: new Date(), ...(form.get("withLink") === "on" ? { linkSentAt: new Date() } : {}) }).where(eq(prospects.id, id));
  await logProspect(id, "admin_replied", `${user.firstName ?? "A partner"} replied.`, user.id);
  const q = s(form, "saveQuestion", 500);
  if (form.get("save") === "on" && q) {
    const { outreachAnswers } = await import("@/db");
    await db.insert(outreachAnswers).values({ question: q, answer: body, createdBy: user.id });
  }
  revalidatePath(`/admin/outreach/prospects/${id}`);
  revalidatePath("/admin/outreach/review");
  return { ok: form.get("save") === "on" && q ? "Sent — and saved so the AI can answer this next time." : "Sent." };
}

/** Take over a conversation (AI stops answering) or hand it back to the AI. */
export async function setAiMode(form: FormData) {
  const { user } = await requireAdmin();
  const id = s(form, "id", 40);
  const p = await db.query.prospects.findFirst({ where: eq(prospects.id, id) });
  if (!p || !(await canTouch(user.id, p.recruiterId))) return;
  const mode = form.get("mode") === "human" ? "human" : "ai";
  await db.update(prospects).set({ aiMode: mode, updatedAt: new Date() }).where(eq(prospects.id, id));
  await logProspect(id, mode === "human" ? "taken_over" : "handed_back", mode === "human" ? `${user.firstName ?? "A partner"} took over — the AI won't reply.` : "Handed back to the AI recruiter.", user.id);
  revalidatePath(`/admin/outreach/prospects/${id}`);
}

/** The AI's playbook, never-say rules and holding reply (owners). */
export async function saveAiCopy(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const { outreachTemplates } = await import("@/db");
  for (const key of ["playbook", "never", "holding"] as const) {
    const body = String(form.get(key) ?? "").trim().slice(0, 12000);
    if (!body) return { error: "Fill in every box." };
    await db.insert(outreachTemplates).values({ key, subject: key, body, updatedBy: user.id }).onConflictDoUpdate({ target: outreachTemplates.key, set: { body, updatedBy: user.id, updatedAt: new Date() } });
  }
  revalidatePath("/admin/outreach/answers");
  return { ok: "Saved. The AI uses this on its next reply." };
}

export async function addAnswer(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const question = s(form, "question", 500), answer = String(form.get("answer") ?? "").trim().slice(0, 3000);
  if (!question || !answer) return { error: "Add the question and the approved answer." };
  const { outreachAnswers } = await import("@/db");
  await db.insert(outreachAnswers).values({ question, answer, createdBy: user.id });
  revalidatePath("/admin/outreach/answers");
  return { ok: "Added. The AI can use it now." };
}

export async function deleteAnswer(form: FormData) {
  await requireAdmin();
  const { outreachAnswers } = await import("@/db");
  await db.delete(outreachAnswers).where(eq(outreachAnswers.id, s(form, "id", 40)));
  revalidatePath("/admin/outreach/answers");
}

/** Turn the AI recruiter on or off for everyone (owners). Off = every reply goes to Needs review. */
export async function setAiEnabled(form: FormData) {
  const { user } = await requireAdmin({ owner: true });
  const { platformSettings } = await import("@/db");
  const value = form.get("on") === "1";
  await db.insert(platformSettings).values({ key: "outreach.ai_enabled", value, updatedBy: user.id })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedBy: user.id, updatedAt: new Date() } });
  revalidatePath("/admin/outreach/answers");
}
