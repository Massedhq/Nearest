"use server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, supporters } from "@/db";
import type { FormState } from "@/components/ActionForm";
import { logSupporter, supporterByManageToken } from "@/lib/supporters";

/**
 * Supporter-side actions through the private management link (no account). Every action re-checks the token.
 * Anything that changes what would be shown publicly takes the record off the public pages until an admin reviews it.
 */

const s = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);

async function tell(title: string, body: string, id: string) {
  try {
    const { notifyAdmins } = await import("@/lib/outreach");
    await notifyAdmins({ kind: "supporter", title, body, href: `/admin/supporters/${id}` });
  } catch (e) { console.error("supporter notify", e); }
}
function refresh() { revalidatePath("/"); revalidatePath("/supporters"); revalidatePath("/admin/supporters", "layout"); }

async function load(f: FormData) {
  const token = s(f, "token", 80);
  const row = await supporterByManageToken(token);
  return { token, row };
}

/** Change publication permissions. Removing statement or name permission unpublishes right away. */
export async function updateSupporterPermissions(_: FormState, f: FormData): Promise<FormState> {
  const { row } = await load(f);
  if (!row) return { error: "This management link isn't valid." };
  if (row.status === "withdrawn") return { error: "You've withdrawn this statement." };
  const next = {
    permStatement: f.get("permStatement") === "on", permName: f.get("permName") === "on",
    permPortrait: Boolean(row.portraitUrl) && f.get("permPortrait") === "on", permAffiliation: f.get("permAffiliation") === "on",
  };
  const unpublish = row.status === "published" && (!next.permStatement || !next.permName);
  await db.update(supporters).set({ ...next, ...(unpublish ? { status: "approved" } : {}), version: sql`${supporters.version} + 1`, updatedAt: new Date() }).where(eq(supporters.id, row.id));
  await logSupporter(row.id, "supporter", "permissions_changed", { before: { statement: row.permStatement, name: row.permName, portrait: row.permPortrait, affiliation: row.permAffiliation }, after: next, unpublished: unpublish });
  await tell(unpublish ? "Supporter removed publication permission — unpublished" : "Supporter changed publication permissions", row.name, row.id);
  refresh();
  return { ok: unpublish ? "Saved. Your statement was removed from Nearest's pages." : "Saved." };
}

/** Correction: a message, and optionally a corrected statement / title / organization in their own words. Goes back to review. */
export async function requestSupporterCorrection(_: FormState, f: FormData): Promise<FormState> {
  const { row } = await load(f);
  if (!row) return { error: "This management link isn't valid." };
  if (["withdrawn", "declined"].includes(row.status)) return { error: "This statement can't be changed anymore." };
  const message = s(f, "message", 1000);
  const statement = s(f, "statement", 1500);
  const title = s(f, "title", 120), organization = s(f, "organization", 160);
  if (!message && statement === row.statementCurrent && title === row.title && organization === row.organization) return { error: "Describe the correction or change your statement." };
  if (statement && statement.length < 20) return { error: "Your statement is too short." };
  const changes = {
    statementCurrent: statement || row.statementCurrent, title: title || row.title, organization: organization || row.organization,
  };
  await db.update(supporters).set({
    ...changes, status: "submitted", adminNote: null, statementProposed: null, statementProposedAt: null,
    version: sql`${supporters.version} + 1`, updatedAt: new Date(),
  }).where(eq(supporters.id, row.id));
  await logSupporter(row.id, "supporter", "correction_submitted", {
    message: message || null,
    before: { statement: row.statementCurrent, title: row.title, organization: row.organization }, after: changes, wasPublished: row.status === "published",
  });
  await tell("Supporter sent a correction", `${row.name}${message ? `: ${message.slice(0, 120)}` : ""}`, row.id);
  refresh();
  return { ok: row.status === "published" ? "Sent. Your statement is off Nearest's pages until the correction is reviewed." : "Sent. Nearest will review it." };
}

/** The admin suggested different wording: the supporter approves it (it becomes their wording) or keeps their own. */
export async function answerSupporterRevision(_: FormState, f: FormData): Promise<FormState> {
  const { row } = await load(f);
  if (!row?.statementProposed) return { error: "There's no wording change waiting." };
  const approve = f.get("answer") === "approve";
  if (approve) {
    await db.update(supporters).set({
      statementCurrent: row.statementProposed, statementProposed: null, statementProposedAt: null,
      ...(row.status === "published" ? { statementPublished: row.statementProposed } : {}),
      version: sql`${supporters.version} + 1`, updatedAt: new Date(),
    }).where(and(eq(supporters.id, row.id), eq(supporters.statementProposed, row.statementProposed)));
  } else {
    await db.update(supporters).set({ statementProposed: null, statementProposedAt: null, version: sql`${supporters.version} + 1`, updatedAt: new Date() }).where(eq(supporters.id, row.id));
  }
  await logSupporter(row.id, "supporter", approve ? "revision_approved" : "revision_declined", { proposed: row.statementProposed, original: row.statementCurrent });
  await tell(approve ? "Supporter approved your wording change" : "Supporter kept their original wording", row.name, row.id);
  refresh();
  return { ok: approve ? "Thanks — the new wording is approved." : "Okay — your own wording stays." };
}

/** Withdraw publication permission entirely. Unpublished immediately; the record is kept (private) for history. */
export async function withdrawSupporter(_: FormState, f: FormData): Promise<FormState> {
  const { row } = await load(f);
  if (!row) return { error: "This management link isn't valid." };
  if (row.status === "withdrawn") return { ok: "Already withdrawn." };
  if (f.get("confirm") !== "on") return { error: "Tick the box to confirm." };
  await db.update(supporters).set({
    status: "withdrawn", withdrawnAt: new Date(), permStatement: false, permName: false, permPortrait: false, permAffiliation: false,
    statementPublished: null, statementProposed: null, version: sql`${supporters.version} + 1`, updatedAt: new Date(),
  }).where(eq(supporters.id, row.id));
  await logSupporter(row.id, "supporter", "withdrawn", { wasPublished: row.status === "published" });
  await tell("Supporter withdrew their statement", `${row.name} — removed from public pages`, row.id);
  refresh();
  return { ok: "Withdrawn. Your statement is no longer shown anywhere on Nearest." };
}
