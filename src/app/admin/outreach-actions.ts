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
