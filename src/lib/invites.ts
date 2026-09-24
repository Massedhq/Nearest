import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { db, invitations, cities, professionalProfiles } from "@/db";
import { getSettings } from "./settings";

export async function expireStaleInvites() {
  await db
    .update(invitations)
    .set({ status: "expired" })
    .where(and(eq(invitations.status, "invited"), lt(invitations.expiresAt, new Date())));
}

export async function foundingCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(professionalProfiles)
    .where(eq(professionalProfiles.cohort, "FOUNDING"));
  return row?.n ?? 0;
}

/** Founding is open only while the switch is on and capacity isn't reached. */
export async function foundingOpen() {
  const s = await getSettings();
  const used = await foundingCount();
  const capacity = Number(s["growth.founding_capacity"]);
  return { open: s["status.founding_invitations"] === true && used < capacity, used, capacity };
}

export type InviteCheck =
  | { ok: true; invite: typeof invitations.$inferSelect; city: string }
  | { ok: false; reason: "not_found" | "expired" | "used" | "revoked" | "closed" };

export async function checkInvite(code: string | null | undefined): Promise<InviteCheck> {
  if (!code) return { ok: false, reason: "not_found" };
  await expireStaleInvites();
  const row = await db
    .select({ invite: invitations, city: cities.name })
    .from(invitations)
    .innerJoin(cities, eq(cities.id, invitations.cityId))
    .where(eq(invitations.code, code.trim().toUpperCase()))
    .limit(1);
  const hit = row[0];
  if (!hit) return { ok: false, reason: "not_found" };
  const st = hit.invite.status;
  if (st === "expired") return { ok: false, reason: "expired" };
  if (st === "registered") return { ok: false, reason: "used" };
  if (st === "revoked" || st === "declined") return { ok: false, reason: "revoked" };
  const f = await foundingOpen();
  if (!f.open) return { ok: false, reason: "closed" };
  return { ok: true, invite: hit.invite, city: hit.city };
}

export const INVITE_MESSAGES: Record<string, string> = {
  not_found: "We couldn't find that invitation code.",
  expired: "This invitation has expired. Ask your Nearest rep for a new one.",
  used: "This invitation has already been used.",
  revoked: "This invitation is no longer active.",
  closed: "Founding registration is closed.",
};
