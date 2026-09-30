import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { db, invitations, cities } from "@/db";
import { getSettings } from "./settings";

export async function expireStaleInvites() {
  await db
    .update(invitations)
    .set({ status: "expired" })
    .where(and(eq(invitations.status, "invited"), lt(invitations.expiresAt, new Date())));
}

/** Paid First In professionals (only successful payments count toward the 750). */
export async function foundingCount(): Promise<number> {
  const { firstInStats } = await import("./entry");
  return (await firstInStats()).registered;
}

/** First In invitations work only while First In is open, the invitation switch is on, and seats remain. */
export async function foundingOpen() {
  const s = await getSettings();
  const { firstInStats } = await import("./entry");
  const st = await firstInStats();
  return { open: s["status.founding_invitations"] === true && st.open, used: st.registered, capacity: st.capacity };
}

export type InviteCheck =
  | { ok: true; invite: typeof invitations.$inferSelect; city: string | null }
  | { ok: false; reason: "not_found" | "expired" | "used" | "revoked" | "closed" };

export async function checkInvite(code: string | null | undefined): Promise<InviteCheck> {
  if (!code) return { ok: false, reason: "not_found" };
  await expireStaleInvites();
  const row = await db
    .select({ invite: invitations, city: cities.name })
    .from(invitations)
    .leftJoin(cities, eq(cities.id, invitations.cityId))
    .where(eq(invitations.code, code.trim().toUpperCase()))
    .limit(1);
  const hit = row[0];
  if (!hit) return { ok: false, reason: "not_found" };
  const st = hit.invite.status;
  if (st === "expired") return { ok: false, reason: "expired" };
  if (st === "registered") return { ok: false, reason: "used" };
  if (st === "revoked" || st === "declined") return { ok: false, reason: "revoked" };
  if (hit.invite.kind === "FIRST_IN") {
    const f = await foundingOpen();
    if (!f.open) return { ok: false, reason: "closed" };
  }
  return { ok: true, invite: hit.invite, city: hit.city };
}

export const INVITE_MESSAGES: Record<string, string> = {
  not_found: "We couldn't find that invitation code.",
  expired: "This invitation has expired. Ask your Nearest rep for a new one.",
  used: "This invitation has already been used.",
  revoked: "This invitation is no longer active.",
  closed: "First In is closed.",
};
