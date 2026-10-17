import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { db, users, professionalProfiles } from "@/db";
import { getViewer, type Viewer } from "./viewer";

/**
 * "Build a profile" (Admin → Outreach): a Nearest owner sets up a professional's profile for them, with their
 * permission, using the exact same setup pages the professional would use. While building, the owner's browser
 * carries this cookie and the /pro pages act as that professional. It only works for an owner, and only for a
 * profile Nearest built that hasn't been claimed yet — once the professional sets their password it stops working.
 */
export const BUILD_COOKIE = "nearest_build";
const MANAGED_PREFIX = "managed_";
const UUID = /^[0-9a-f-]{36}$/;

/** Placeholder sign-in id for a built account that nobody can sign in to yet (replaced when it's claimed). */
export const managedClerkId = () => `${MANAGED_PREFIX}${randomBytes(12).toString("hex")}`;
export const isManagedClerkId = (id: string | null | undefined) => Boolean(id?.startsWith(MANAGED_PREFIX));

/** A built profile that's still Nearest's to edit: built by an owner, not claimed, Terms not accepted. */
export async function buildTarget(userId: string) {
  if (!UUID.test(userId)) return null;
  const row = (await db.select({ u: users, p: professionalProfiles }).from(users)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
    .where(and(eq(users.id, userId), eq(users.accountType, "professional"), isNull(professionalProfiles.claimedAt), isNull(professionalProfiles.entryPaidAt)))
    .limit(1))[0];
  if (!row || !row.p.builtBy || !isManagedClerkId(row.u.clerkUserId)) return null;
  return row;
}

/**
 * The viewer for /pro pages. Normally the signed-in person. While an owner is building a profile, it's that
 * professional's account (with no owner powers), so every setup page saves to their profile, not the owner's.
 */
export async function getProViewer(): Promise<Viewer | null> {
  const viewer = await getViewer();
  if (!viewer?.user || viewer.admin?.role !== "OWNER") return viewer;
  const id = (await cookies()).get(BUILD_COOKIE)?.value ?? "";
  if (!id) return viewer;
  const target = await buildTarget(id);
  if (!target) return viewer;
  return { clerkUserId: viewer.clerkUserId, user: target.u, admin: null, building: { adminUserId: viewer.user.id } };
}

/** One-time claim link token: the link carries the token, the database only keeps its hash. */
export function newClaimToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashClaimToken(token) };
}
export const hashClaimToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** Claim links last 14 days; sending a new one replaces the old one. */
export const CLAIM_DAYS = 14;

/** The built profile a claim link opens, if the link is still good. */
export async function claimTarget(token: string) {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return null;
  const row = (await db.select({ u: users, p: professionalProfiles }).from(professionalProfiles)
    .innerJoin(users, eq(users.id, professionalProfiles.userId))
    .where(and(eq(professionalProfiles.claimTokenHash, hashClaimToken(token)), isNull(professionalProfiles.claimedAt))).limit(1))[0];
  if (!row || !row.p.claimExpiresAt || row.p.claimExpiresAt.getTime() < Date.now()) return null;
  return row;
}

