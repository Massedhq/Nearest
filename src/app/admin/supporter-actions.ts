"use server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, supporters, supporterInvites } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import type { FormState } from "@/components/ActionForm";
import { hashToken, INVITE_DAYS_DEFAULT, logSupporter, manageLink, newToken, publishProblems } from "@/lib/supporters";

const s = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);
function refresh() { revalidatePath("/"); revalidatePath("/supporters"); revalidatePath("/admin/supporters", "layout"); }

/** Load the record and check nobody else changed it since the admin opened the page. */
async function current(f: FormData) {
  const id = s(f, "id", 40);
  const version = Number(f.get("version"));
  const row = /^[0-9a-f-]{36}$/.test(id) ? await db.query.supporters.findFirst({ where: eq(supporters.id, id) }) : null;
  if (!row) return { error: "Not found." } as const;
  if (Number.isInteger(version) && version !== row.version) return { error: "This record changed since you opened it (the supporter may have sent a correction). Reload and check again." } as const;
  return { row } as const;
}
async function save(id: string, version: number, set: Partial<typeof supporters.$inferInsert>) {
  const [r] = await db.update(supporters).set({ ...set, version: sql`${supporters.version} + 1`, updatedAt: new Date() })
    .where(and(eq(supporters.id, id), eq(supporters.version, version))).returning();
  return r ?? null;
}

// ---------- Invitations (never sent automatically — the admin copies the link) ----------
export async function createSupporterInvite(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const label = s(f, "label", 120) || null;
  const days = Number(f.get("days") || INVITE_DAYS_DEFAULT);
  if (!Number.isInteger(days) || days < 1 || days > 60) return { error: "Expiry must be 1–60 days." };
  const [inv] = await db.insert(supporterInvites).values({ token: newToken(), label, expiresAt: new Date(Date.now() + days * 86400000), createdBy: user.id }).returning();
  await logActivity({ actorUserId: user.id, action: "supporter.invite_created", targetType: "supporter_invite", targetId: inv.id, after: { label, days } });
  refresh();
  return { ok: "Invitation created — copy its link below and share it yourself." };
}

export async function revokeSupporterInvite(f: FormData) {
  const { user } = await requireAdmin();
  const id = s(f, "id", 40);
  await db.update(supporterInvites).set({ status: "revoked" }).where(and(eq(supporterInvites.id, id), eq(supporterInvites.status, "invited")));
  await logActivity({ actorUserId: user.id, action: "supporter.invite_revoked", targetType: "supporter_invite", targetId: id });
  refresh();
}

// ---------- Review ----------
export async function approveSupporter(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const c = await current(f);
  if ("error" in c) return { error: c.error };
  const { row } = c;
  if (!["submitted", "needs_correction", "approved"].includes(row.status)) return { error: `It's ${row.status.replace("_", " ")} — it can't be approved.` };
  let org = {};
  if (row.endorsementType === "organizational") {
    const choice = f.get("org");
    if (choice === "confirm") {
      if (!row.orgAuthorityConfirmed) return { error: "The supporter didn't confirm organizational authorization." };
      org = { orgAuthorityReviewedBy: user.id };
    } else if (choice === "personal") org = { endorsementType: "personal", orgAuthorityReviewedBy: null };
    else return { error: "Confirm the organizational authorization, or approve it as a personal endorsement." };
  }
  const r = await save(row.id, row.version, { status: "approved", approvedAt: new Date(), approvedBy: user.id, adminNote: null, ...org });
  if (!r) return { error: "This record just changed. Reload and try again." };
  await logSupporter(row.id, "admin", "approved", org, user.id);
  await logActivity({ actorUserId: user.id, action: "supporter.approved", targetType: "supporter", targetId: row.name, before: row.status, after: { status: "approved", ...org } });
  refresh();
  return { ok: "Approved. Publish it when you're ready." };
}

export async function requestSupporterFix(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const c = await current(f);
  if ("error" in c) return { error: c.error };
  const note = s(f, "note", 1000);
  if (!note) return { error: "Tell the supporter what needs correcting." };
  if (["declined", "withdrawn"].includes(c.row.status)) return { error: "This record is closed." };
  const r = await save(c.row.id, c.row.version, { status: "needs_correction", adminNote: note });
  if (!r) return { error: "This record just changed. Reload and try again." };
  await logSupporter(c.row.id, "admin", "correction_requested", { note, wasPublished: c.row.status === "published" }, user.id);
  await logActivity({ actorUserId: user.id, action: "supporter.correction_requested", targetType: "supporter", targetId: c.row.name, before: c.row.status, after: note });
  refresh();
  return { ok: "Saved. They'll see your note on their management link — share it with them if needed (contact email is above)." };
}

export async function declineSupporter(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const c = await current(f);
  if ("error" in c) return { error: c.error };
  const note = s(f, "note", 1000);
  if (!note) return { error: "Add a reason (shown to the supporter on their management link)." };
  if (c.row.status === "withdrawn") return { error: "They already withdrew it." };
  const r = await save(c.row.id, c.row.version, { status: "declined", adminNote: note, statementPublished: null, benefitPublished: null, statementProposed: null });
  if (!r) return { error: "This record just changed. Reload and try again." };
  await logSupporter(c.row.id, "admin", "declined", { note }, user.id);
  await logActivity({ actorUserId: user.id, action: "supporter.declined", targetType: "supporter", targetId: c.row.name, before: c.row.status, after: note });
  refresh();
  return { ok: "Declined." };
}

export async function publishSupporter(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const c = await current(f);
  if ("error" in c) return { error: c.error };
  const problems = publishProblems(c.row);
  if (problems.length) return { error: problems.join(" ") };
  const r = await save(c.row.id, c.row.version, { status: "published", statementPublished: c.row.statementCurrent, benefitPublished: c.row.benefitCurrent, publishedAt: new Date() });
  if (!r) return { error: "This record just changed. Reload and try again." };
  await logSupporter(c.row.id, "admin", "published", { statement: c.row.statementCurrent }, user.id);
  await logActivity({ actorUserId: user.id, action: "supporter.published", targetType: "supporter", targetId: c.row.name, before: c.row.status, after: "published" });
  refresh();
  return { ok: "Published." };
}

export async function unpublishSupporter(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const c = await current(f);
  if ("error" in c) return { error: c.error };
  if (c.row.status !== "published") return { error: "It isn't published." };
  const r = await save(c.row.id, c.row.version, { status: "approved" });
  if (!r) return { error: "This record just changed. Reload and try again." };
  await logSupporter(c.row.id, "admin", "unpublished", null, user.id);
  await logActivity({ actorUserId: user.id, action: "supporter.unpublished", targetType: "supporter", targetId: c.row.name, before: "published", after: "approved" });
  refresh();
  return { ok: "Unpublished." };
}

/** Suggest different wording. The original is never changed; the supporter must approve on their management link. */
export async function proposeSupporterWording(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const c = await current(f);
  if ("error" in c) return { error: c.error };
  const text = s(f, "statement", 1500);
  if (["declined", "withdrawn"].includes(c.row.status)) return { error: "This record is closed." };
  if (!text || text === c.row.statementCurrent) return { error: "Change the wording first." };
  const r = await save(c.row.id, c.row.version, { statementProposed: text, statementProposedAt: new Date() });
  if (!r) return { error: "This record just changed. Reload and try again." };
  await logSupporter(c.row.id, "admin", "revision_proposed", { from: c.row.statementCurrent, to: text }, user.id);
  await logActivity({ actorUserId: user.id, action: "supporter.revision_proposed", targetType: "supporter", targetId: c.row.name, before: c.row.statementCurrent, after: text });
  refresh();
  return { ok: "Saved. It won't be used until the supporter approves it on their management link — let them know." };
}

export async function cancelSupporterWording(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const c = await current(f);
  if ("error" in c) return { error: c.error };
  const r = await save(c.row.id, c.row.version, { statementProposed: null, statementProposedAt: null });
  if (!r) return { error: "This record just changed. Reload and try again." };
  await logSupporter(c.row.id, "admin", "revision_cancelled", null, user.id);
  refresh();
  return { ok: "Suggested wording removed." };
}

/** Lost link: issue a new management link (the old one stops working). Shown once for the admin to share. */
export async function newSupporterManageLink(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const c = await current(f);
  if ("error" in c) return { error: c.error };
  const token = newToken();
  const r = await save(c.row.id, c.row.version, { manageTokenHash: hashToken(token) });
  if (!r) return { error: "This record just changed. Reload and try again." };
  await logSupporter(c.row.id, "admin", "manage_link_reissued", null, user.id);
  await logActivity({ actorUserId: user.id, action: "supporter.manage_link_reissued", targetType: "supporter", targetId: c.row.name });
  return { ok: `New management link (the old one no longer works — copy it now, it isn't shown again): ${manageLink(token)}` };
}

// ---------- Explainer video on the supporter form (uploaded MP4 or a YouTube/Vimeo link) ----------
async function setExplainer(userId: string, url: string | null) {
  const { platformSettings } = await import("@/db");
  const { EXPLAINER_SETTING } = await import("@/lib/supporters");
  if (url) await db.insert(platformSettings).values({ key: EXPLAINER_SETTING, value: url, updatedBy: userId }).onConflictDoUpdate({ target: platformSettings.key, set: { value: url, updatedBy: userId, updatedAt: new Date() } });
  else await db.delete(platformSettings).where(eq(platformSettings.key, EXPLAINER_SETTING));
  await logActivity({ actorUserId: userId, action: "supporter.explainer_video", targetType: "setting", targetId: EXPLAINER_SETTING, after: url });
  refresh();
}
export async function saveExplainerUpload(urls: string[]): Promise<{ error?: string }> {
  const { user } = await requireAdmin({ owner: true });
  const url = urls[0];
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !u.hostname.endsWith(".public.blob.vercel-storage.com") || !u.pathname.startsWith(`/students/${user.id}/explainer-video/`)) return { error: "Upload didn't complete." };
  } catch { return { error: "Upload didn't complete." }; }
  await setExplainer(user.id, url);
  return {};
}
export async function saveExplainerLink(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const url = s(f, "url", 500);
  const { explainerEmbed } = await import("@/lib/supporters");
  if (!explainerEmbed(url)) return { error: "Paste a YouTube or Vimeo link (https://…), or upload a video file instead." };
  await setExplainer(user.id, url);
  return { ok: "Saved — it now shows at the top of the supporter form." };
}
export async function removeExplainer() {
  const { user } = await requireAdmin({ owner: true });
  await setExplainer(user.id, null);
}
