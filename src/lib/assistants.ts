import "server-only";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { and, desc, eq, inArray, like, sql } from "drizzle-orm";
import { db, partnerAssistants, partnerPages, users, professionalProfiles, activityLog } from "@/db";
import { logActivity } from "./log";
import type { Viewer } from "./viewer";

/**
 * Partner assistants (2026-11-18, owner). A Nearest Partner invites an assistant by email; the assistant makes their
 * OWN login (never the partner's password). While managing, /pro pages act as the partner — but only the pages and
 * actions that opt in with requirePro({ assistant: true }): Model Calls, services & prices, photos & looks, the partner
 * page, appointments and client messages. Everything else (payouts, earnings, ID, Terms, account settings, the
 * assistant list itself) refuses and sends them back to /pro/assistant. Deny by default.
 */
export const ASSIST_COOKIE = "nearest_assist";
export const ASSISTANT_INVITE_DAYS = 7;
export const MAX_ASSISTANTS = 5;
export const newAssistantToken = () => randomBytes(24).toString("hex"); // 48 hex characters
export const assistantTokenShape = (t: string) => /^[0-9a-f]{48}$/.test(t);
const UUID = /^[0-9a-f-]{36}$/;

/** The partners this login is an active assistant for (with their names for the picker). */
export async function assistantRows(userId: string) {
  return db.select({ id: partnerAssistants.id, partnerId: partnerAssistants.partnerId, businessName: professionalProfiles.businessName, displayName: professionalProfiles.displayName, firstName: users.firstName, photoUrl: professionalProfiles.photoUrl })
    .from(partnerAssistants)
    .innerJoin(partnerPages, eq(partnerPages.userId, partnerAssistants.partnerId))
    .innerJoin(users, eq(users.id, partnerAssistants.partnerId))
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, partnerAssistants.partnerId))
    .where(and(eq(partnerAssistants.userId, userId), eq(partnerAssistants.status, "active")));
}

/** One active assistant link (this login → this partner), or null. Partners only: the partner must still have a partner page. */
export async function activeAssistant(userId: string, partnerId: string) {
  if (!UUID.test(partnerId)) return null;
  return (await db.select({ a: partnerAssistants }).from(partnerAssistants)
    .innerJoin(partnerPages, eq(partnerPages.userId, partnerAssistants.partnerId))
    .where(and(eq(partnerAssistants.userId, userId), eq(partnerAssistants.partnerId, partnerId), eq(partnerAssistants.status, "active"))).limit(1))[0]?.a ?? null;
}

/**
 * For getProViewer: a staff login carrying the assist cookie for a partner they actively assist → that partner's
 * account, marked `assisting`. Re-checked on every request, so removing an assistant ends access right away.
 */
export async function assistViewer(viewer: Viewer): Promise<Viewer | null> {
  if (!viewer.user || viewer.user.accountType !== "staff" || viewer.admin) return null;
  const partnerId = (await cookies()).get(ASSIST_COOKIE)?.value ?? "";
  if (!partnerId) return null;
  const row = await activeAssistant(viewer.user.id, partnerId);
  if (!row) return null;
  const partner = await db.query.users.findFirst({ where: eq(users.id, partnerId) });
  if (!partner || partner.status === "deactivated") return null;
  const assistantName = [viewer.user.firstName, viewer.user.lastName].filter(Boolean).join(" ") || "Assistant";
  return { clerkUserId: viewer.clerkUserId, user: partner, admin: null, assisting: { assistantUserId: viewer.user.id, assistantName, rowId: row.id } };
}

/** Record what an assistant changed, so the partner sees who did what (Business → Partner page → My assistants). */
export async function noteAssistant(viewer: Viewer, what: string, detail?: string) {
  if (!viewer.assisting || !viewer.user) return;
  await logActivity({ actorUserId: viewer.assisting.assistantUserId, action: `assistant.${what}`, targetType: "partner", targetId: viewer.user.id, after: { by: viewer.assisting.assistantName, detail: detail ?? null } });
}

/** A partner's assistants (any status except removed long ago) for their own list. */
export function partnerAssistantList(partnerId: string) {
  return db.select().from(partnerAssistants).where(eq(partnerAssistants.partnerId, partnerId)).orderBy(desc(partnerAssistants.createdAt));
}

/** The latest changes assistants made in this partner's account. */
export async function assistantActivity(partnerId: string, limit = 25) {
  return db.select({ action: activityLog.action, after: activityLog.after, at: activityLog.createdAt }).from(activityLog)
    .where(and(like(activityLog.action, "assistant.%"), eq(activityLog.targetType, "partner"), eq(activityLog.targetId, partnerId)))
    .orderBy(desc(activityLog.createdAt)).limit(limit);
}

/** Plain words for the activity list. */
export const ASSIST_WORDS: Record<string, string> = {
  "assistant.model_call_posted": "Posted a Model Call",
  "assistant.model_call_cancelled": "Closed a Model Call",
  "assistant.model_call_edited": "Edited a Model Call",
  "assistant.model_call_deleted": "Deleted a Model Call",
  "assistant.services_saved": "Updated services & prices",
  "assistant.photos_added": "Added photos",
  "assistant.video_added": "Added a video",
  "assistant.look_updated": "Updated a look",
  "assistant.photo_removed": "Removed a photo",
  "assistant.photo_featured": "Changed featured photos",
  "assistant.photo_tagged": "Tagged a photo with a service",
  "assistant.partner_page_saved": "Updated the partner page",
  "assistant.message_sent": "Messaged a client",
  "assistant.appointment_started": "Started an appointment",
  "assistant.appointment_finished": "Finished an appointment",
  "assistant.no_show": "Marked a no-show",
  "assistant.started": "Started managing your account",
};

/** Anyone left managing a partner who removed them? Count for the partner's own page. */
export async function activeAssistantCount(partnerId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(partnerAssistants).where(and(eq(partnerAssistants.partnerId, partnerId), inArray(partnerAssistants.status, ["invited", "active"])));
  return r?.n ?? 0;
}

/** From a server action: if a partner's assistant is the one acting, record it (one line, no-op for everyone else). */
export async function noteIfAssistant(what: string, detail?: string) {
  const { getProViewer } = await import("./build-mode");
  const v = await getProViewer();
  if (v?.assisting) await noteAssistant(v, what, detail);
}
