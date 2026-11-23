import "server-only";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, teamAssistants, adminMembers } from "@/db";

/**
 * Owner assistants (2026-11-22). An owner (Avy, Kisses, Lakeesha) invites a personal assistant with their own staff login.
 * The assistant works ONLY that owner's outreach and area at /outreach. Deny by default: every /outreach page and action
 * starts with requireTeamAssistant() or fieldActor(), and every row is re-checked against the owner it belongs to.
 */
export const TEAM_INVITE_DAYS = 7;
export const MAX_TEAM_ASSISTANTS = 3;
export const newTeamToken = () => randomBytes(24).toString("hex");
export const teamTokenShape = (t: string) => /^[0-9a-f]{48}$/.test(t);

export async function teamAssistantFor(userId: string | null | undefined) {
  if (!userId) return null;
  const row = await db.query.teamAssistants.findFirst({ where: and(eq(teamAssistants.userId, userId), eq(teamAssistants.status, "active")) });
  if (!row) return null;
  // The owner must still be an active owner.
  const owner = await db.query.adminMembers.findFirst({ where: and(eq(adminMembers.userId, row.ownerId), eq(adminMembers.role, "OWNER"), eq(adminMembers.active, true)) });
  return owner ? row : null;
}

/** Top of every /outreach page. Anyone who isn't an active owner assistant goes back to where they belong. */
export async function requireTeamAssistant() {
  const { getViewer, destinationFor } = await import("@/lib/viewer");
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?redirect_url=/outreach");
  const row = await teamAssistantFor(viewer.user?.id);
  if (!row || !viewer.user) redirect(viewer.admin ? "/admin" : await destinationFor(viewer));
  return { user: viewer.user, row, ownerId: row.ownerId };
}

/**
 * Who is doing field work and for whom: an owner (main owner = everyone's area) or an owner's assistant (their owner
 * only). Returns null for anyone else. `scope` = the owner id they're limited to, null = all (main owner).
 */
export async function fieldActor() {
  const { getViewer } = await import("@/lib/viewer");
  const viewer = await getViewer();
  if (!viewer?.user) return null;
  if (viewer.admin?.role === "OWNER" && viewer.admin.active) {
    const { isMainOwner } = await import("@/lib/admin");
    const main = await isMainOwner(viewer.user.id);
    return { user: viewer.user, assistant: null, ownerId: viewer.user.id, scope: main ? null : viewer.user.id, main };
  }
  const row = await teamAssistantFor(viewer.user.id);
  if (!row) return null;
  return { user: viewer.user, assistant: row, ownerId: row.ownerId, scope: row.ownerId, main: false };
}
export type FieldActor = NonNullable<Awaited<ReturnType<typeof fieldActor>>>;

/** May this person work on something that belongs to `ownerId`? */
export const mayWork = (a: FieldActor, ownerId: string | null | undefined) => a.scope === null || (!!ownerId && ownerId === a.scope);

/** The owner's first name, used instead of "your owner" in everything an assistant reads (owner's rule, 2026-11-23). */
export async function ownerFirstName(ownerId: string | null | undefined) {
  if (!ownerId) return "Avy";
  const { users } = await import("@/db");
  const u = await db.query.users.findFirst({ where: eq(users.id, ownerId), columns: { firstName: true } });
  return u?.firstName?.trim() || "the owner";
}

/** Swap "your owner" wording in fixed text (guides, training) for the owner's name. */
export function withOwnerName(text: string, name: string) {
  return text
    .replace(/\b[Yy]our owner's\b/g, `${name}'s`).replace(/\b[Yy]our owner\b/g, name)
    .replace(/\b[Tt]he owner's\b/g, `${name}'s`).replace(/\b[Tt]he owner\b/g, name)
    .replace(/\b([Ss])end to owner\b/g, `$1end to ${name}`).replace(/\bNeeds owner OK\b/g, `Needs ${name}'s OK`).replace(/\banother owner's area\b/g, "someone else's area").replace(/\bSent to owner\b/g, `Sent to ${name}`)
    .replace(/\bowner's team\b/g, `${name}'s team`).replace(/\b[Aa]n owner\b/g, name);
}
