"use server";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db, educators, educatorContracts, teamAssistants } from "@/db";
import { fieldActor, mayWork, ownerFirstName, type FieldActor } from "@/lib/team";
import { tellOwnerTask, tellAssistants } from "@/lib/field-tasks";
import { AGREEMENT_FIELDS, EDUCATOR_AGREEMENT_VERSION, EDUCATOR_AGREEMENT_TITLE, agreementText, type AgreementFields } from "@/lib/educator-agreement";
import { logActivity } from "@/lib/log";

/**
 * Video educators + the Training Video Production, License & Confidentiality Agreement (2026-11-23).
 * Assistants log educators; the owner approves the price; an assistant the owner allowed to sign (team_assistants.can_sign)
 * — or the owner — sends the agreement already signed for Nearest; the creator signs from the emailed link
 * (/agreement/[token], only the token's hash is stored) and uploads the video on the same page. Everything is logged.
 */
type FormState = { error?: string; ok?: string };
const s = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);
const ID = /^[0-9a-f-]{36}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const APP = () => process.env.APP_URL || "https://usenearest.com";
const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const refresh = () => { revalidatePath("/outreach", "layout"); revalidatePath("/admin/field", "layout"); };
async function actor(): Promise<FieldActor> { const a = await fieldActor(); if (!a) throw new Error("Not allowed."); return a; }
const who = (a: FieldActor) => a.assistant?.name || a.user.firstName || "Someone";
const STATUSES = ["found", "talking", "price", "no"];
const PLATFORMS = ["Instagram", "TikTok", "Facebook", "YouTube", "Other"];

export async function saveEducator(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const id = s(form, "id", 40);
  const ex = ID.test(id) ? await db.query.educators.findFirst({ where: eq(educators.id, id) }) : null;
  if (id && (!ex || !mayWork(a, ex.ownerId))) return { error: "Not yours." };
  const v = {
    name: s(form, "name", 120), platform: PLATFORMS.includes(s(form, "platform", 20)) ? s(form, "platform", 20) : "Other", handle: s(form, "handle", 120) || null, phone: s(form, "phone", 40) || null,
    email: s(form, "email", 160).toLowerCase() || null, skill: s(form, "skill", 160), spokeAt: s(form, "spokeAt", 60) || null, asked: s(form, "asked", 600) || null, price: s(form, "price", 120) || null,
    products: s(form, "products", 40) || null, notes: s(form, "notes", 1000) || null,
  };
  if (!v.name) return { error: "Enter their name or business." };
  if (!v.skill) return { error: "Enter what they teach." };
  if (v.email && !EMAIL.test(v.email)) return { error: "Check the email." };
  let status = STATUSES.includes(s(form, "status", 12)) ? s(form, "status", 12) : ex?.status ?? "found";
  if (ex && ["agreed", "received"].includes(ex.status) && a.assistant) status = ex.status; // only the owner changes an agreed one
  let rowId = ex?.id;
  if (ex) await db.update(educators).set({ ...v, status, updatedAt: new Date() }).where(eq(educators.id, ex.id));
  else rowId = (await db.insert(educators).values({ ...v, status, ownerId: a.ownerId, createdBy: a.user.id }).returning())[0].id;
  await logActivity({ actorUserId: a.user.id, action: ex ? "field.educator_changed" : "field.educator_added", targetType: "educator", targetId: rowId!, after: { name: v.name, status, price: v.price } });
  if (status === "price" && ex?.status !== "price") await tellOwnerTask(a.ownerId, `Video price in: ${v.name}`, `${who(a)}: ${v.name} (${v.skill}) quoted ${v.price || "a price"} for a training video. Approve, counter or pass.`, "/admin/field/educators");
  refresh();
  return { ok: status === "price" ? (a.assistant ? `Saved — sent to ${await ownerFirstName(a.ownerId)}.` : "Saved.") : "Saved." };
}

/** Owner: approve the price, counter (with a note back to the assistant), pass, or mark the video received. */
export async function decideEducator(form: FormData) {
  const a = await actor();
  if (a.assistant) return;
  const e = ID.test(s(form, "id", 40)) ? await db.query.educators.findFirst({ where: eq(educators.id, s(form, "id", 40)) }) : null;
  if (!e || !mayWork(a, e.ownerId)) return;
  const d = s(form, "decision", 12), note = s(form, "note", 600);
  const status = d === "approve" ? "agreed" : d === "counter" ? "talking" : d === "pass" ? "no" : d === "received" ? "received" : null;
  if (!status) return;
  await db.update(educators).set({ status, ownerNote: note || e.ownerNote, updatedAt: new Date() }).where(eq(educators.id, e.id));
  await logActivity({ actorUserId: a.user.id, action: `field.educator_${d}`, targetType: "educator", targetId: e.id, before: { status: e.status }, after: { status, note } });
  const msg = d === "approve" ? `Price approved for ${e.name}${note ? ` — ${note}` : ""}. You can send the agreement now.` : d === "counter" ? `Counter for ${e.name}: ${note || "see notes"}` : d === "pass" ? `Passing on ${e.name}${note ? ` — ${note}` : ""}.` : `Video from ${e.name} marked received.`;
  await tellAssistants(e.ownerId, msg, msg, "/outreach/educators");
  refresh();
}

/** Send the agreement — signed for Nearest by the sender — to the creator's email. */
export async function sendAgreement(_: FormState, form: FormData): Promise<FormState> {
  const a = await actor();
  const e = ID.test(s(form, "id", 40)) ? await db.query.educators.findFirst({ where: eq(educators.id, s(form, "id", 40)) }) : null;
  if (!e || !mayWork(a, e.ownerId)) return { error: "Not yours." };
  if (e.status !== "agreed") return { error: a.assistant ? `${await ownerFirstName(e.ownerId)} needs to approve the price first.` : "Approve the price first." };
  let signer: string, title: string;
  if (a.assistant) {
    const row = await db.query.teamAssistants.findFirst({ where: eq(teamAssistants.id, a.assistant.id) });
    if (!row?.canSign || !row.legalName || !row.title) return { error: `${await ownerFirstName(e.ownerId)} hasn't allowed you to sign agreements yet.` };
    signer = row.legalName; title = row.title;
  } else { signer = "Nearest"; title = "Authorized representative"; }
  if (form.get("agree") !== "on") return { error: "Tick the box to sign for Nearest." };
  const to = s(form, "email", 160).toLowerCase();
  if (!EMAIL.test(to)) return { error: "Enter their email — that's where it's sent." };
  const fields = Object.fromEntries(AGREEMENT_FIELDS.map((f) => [f.key, s(form, f.key, 300)])) as AgreementFields;
  const missing = AGREEMENT_FIELDS.find((f) => f.required && !fields[f.key]);
  if (missing) return { error: `Fill in: ${missing.label}.` };
  const open = await db.query.educatorContracts.findFirst({ where: and(eq(educatorContracts.educatorId, e.id), eq(educatorContracts.status, "sent")) });
  if (open) await db.update(educatorContracts).set({ status: "cancelled" }).where(eq(educatorContracts.id, open.id));
  const token = randomBytes(24).toString("hex");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const [c] = await db.insert(educatorContracts).values({ educatorId: e.id, tokenHash: hash(token), version: EDUCATOR_AGREEMENT_VERSION, fields, nearestSigner: signer, nearestTitle: title, nearestSignedAt: new Date(), nearestIp: ip, createdBy: a.user.id }).returning();
  await db.update(educators).set({ email: to, updatedAt: new Date() }).where(eq(educators.id, e.id));
  const { sendEmail } = await import("@/lib/email");
  await sendEmail({ to, subject: "Your Nearest training video agreement", eyebrow: "Nearest", heading: `${fields.legal.split(" ")[0]}, your agreement is ready to sign.`,
    lines: [`Thanks for talking with ${a.assistant ? a.assistant.name : "us"}! Here's the ${EDUCATOR_AGREEMENT_TITLE} for your ${fields.subject} video.`, "Open it, check your details, type your name to sign, and send it back. After you sign, the same page is where you upload your video.", "No account or other app needed."],
    button: { label: "Open and sign", url: `${APP()}/agreement/${token}` }, replyTo: a.user.email ?? undefined }).catch(() => undefined);
  await logActivity({ actorUserId: a.user.id, action: "field.agreement_sent", targetType: "educator_contract", targetId: c.id, after: { educator: e.name, to, signer, title, fee: fields.fee } });
  if (a.assistant) await tellOwnerTask(e.ownerId, `Agreement sent to ${e.name}`, `${signer} (${title}) signed for Nearest and sent the video agreement to ${to}. Fee: ${fields.fee}.`, "/admin/field/educators");
  refresh();
  return { ok: `Signed for Nearest and sent to ${to}.` };
}

async function contractByToken(token: string) {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const c = await db.query.educatorContracts.findFirst({ where: eq(educatorContracts.tokenHash, hash(token)) });
  if (!c || c.status === "cancelled") return null;
  const e = await db.query.educators.findFirst({ where: eq(educators.id, c.educatorId) });
  return e ? { c, e } : null;
}

/** Public (the creator, from the emailed link): fill/correct their part, agree, type their name. */
export async function signAgreement(_: FormState, form: FormData): Promise<FormState> {
  const token = s(form, "token", 60);
  const r = await contractByToken(token);
  if (!r) return { error: "This link isn't valid anymore. Ask Nearest for a new one." };
  if (r.c.status !== "sent") return { ok: "Already signed — thank you!" };
  if (form.get("agree") !== "on") return { error: "Tick the box to agree." };
  const name = s(form, "signature", 120);
  if (name.length < 3) return { error: "Type your full legal name to sign." };
  const fields = { ...r.c.fields } as Record<string, string>;
  for (const f of AGREEMENT_FIELDS) { const v = s(form, f.key, 300); if (v) fields[f.key] = v; }
  const missing = AGREEMENT_FIELDS.find((f) => f.required && !fields[f.key]);
  if (missing) return { error: `Fill in: ${missing.label}.` };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const [done] = await db.update(educatorContracts).set({ fields, creatorName: name, creatorSignedAt: new Date(), creatorIp: ip, creatorAgent: (h.get("user-agent") ?? "").slice(0, 300), status: "signed" })
    .where(and(eq(educatorContracts.id, r.c.id), eq(educatorContracts.status, "sent"))).returning();
  if (!done) return { ok: "Already signed — thank you!" };
  const when = (d: Date) => d.toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" }) + " CT";
  const text = agreementText(fields, { nearest: done.nearestSigner, nearestTitle: done.nearestTitle, nearestAt: when(done.nearestSignedAt), creator: name, creatorAt: when(done.creatorSignedAt!) });
  const { sendEmail } = await import("@/lib/email");
  const to = r.e.email;
  await sendEmail({ to, subject: "Signed: your Nearest training video agreement", eyebrow: "Nearest", heading: "You're all set — here's your signed copy.", lines: ["Thank you! Your agreement is signed by you and by Nearest.", "When your video is ready, upload it on the same page (button below).", ...text.split("\n")],
    button: { label: "Upload my video", url: `${APP()}/agreement/${token}` } }).catch(() => undefined);
  await logActivity({ actorUserId: null, action: "field.agreement_signed", targetType: "educator_contract", targetId: done.id, after: { creator: name, ip } });
  const msg = `${name} signed the video agreement (${fields.subject}, ${fields.fee}). They have the upload link.`;
  await tellOwnerTask(r.e.ownerId, `Signed: ${r.e.name}`, msg, "/admin/field/educators");
  await tellAssistants(r.e.ownerId, `Signed: ${r.e.name}`, msg, "/outreach/educators");
  revalidatePath(`/agreement/${token}`); refresh();
  return { ok: "Signed — thank you! A copy is on its way to your email." };
}

/** Public: the creator finished uploading (file went straight to storage through /api/educator-upload). */
export async function saveEducatorVideo(_: FormState, form: FormData): Promise<FormState> {
  const token = s(form, "token", 60);
  const r = await contractByToken(token);
  if (!r || !["signed", "uploaded"].includes(r.c.status)) return { error: "This link isn't ready for uploads." };
  const url = s(form, "video", 600), access = s(form, "video_access", 10) === "public" ? "public" : "private";
  if (!/^https:\/\/[a-z0-9.-]+\.blob\.vercel-storage\.com\//.test(url) || !url.includes(`/educators/${r.c.id}/`)) return { error: "Upload the video first." };
  await db.update(educatorContracts).set({ videoUrl: url, videoAccess: access, videoName: s(form, "video_name", 150) || null, productList: s(form, "products", 3000) || null, uploadedAt: new Date(), status: "uploaded" }).where(eq(educatorContracts.id, r.c.id));
  await db.update(educators).set({ status: "received", updatedAt: new Date() }).where(eq(educators.id, r.e.id));
  await logActivity({ actorUserId: null, action: "field.educator_video_uploaded", targetType: "educator_contract", targetId: r.c.id, after: { name: s(form, "video_name", 150) } });
  const msg = `${r.e.name} uploaded their training video. Review it within 10 business days.`;
  await tellOwnerTask(r.e.ownerId, `Video received: ${r.e.name}`, msg, "/admin/field/educators");
  await tellAssistants(r.e.ownerId, `Video received: ${r.e.name}`, msg, "/outreach/educators");
  revalidatePath(`/agreement/${token}`); refresh();
  return { ok: "Got it — your video is with Nearest. We'll review it within 10 business days." };
}
