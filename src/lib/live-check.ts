import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, users, professionalProfiles } from "@/db";
import { setupSteps } from "./pro";
import { hasPaidEntry, isOwnerBusiness } from "./entry";
import { proStanding } from "./enforcement";
import { fmtDate } from "./time";

type Profile = typeof professionalProfiles.$inferSelect;

/**
 * Every reason a professional is hidden from customers — the same checks as liveProWhere() in search.ts.
 * Payouts are NOT a blocker: pros can go live first; money they earn is held until they connect.
 * Keep the two in step: anything added there must be explained here.
 */
export async function proBlockers(p: Profile): Promise<string[]> {
  const [owner, steps, standing] = await Promise.all([isOwnerBusiness(p.userId), setupSteps(p.userId), proStanding(p.userId)]);
  const paid = owner || hasPaidEntry(p);
  const subActive = ["active", "trialing"].includes(p.subscriptionStatus ?? "");
  return [
    !paid && "Hasn't paid their entry (Join)",
    ...steps.filter((s) => !s.done && !s.optional).map((s) => `Setup not finished: ${s.label}`),
    p.reviewStatus !== "approved" && (p.reviewStatus === "submitted" ? "Waiting for approval (Verification Queue)" : p.reviewStatus === "rejected" ? "Profile was sent back for changes" : "Profile not submitted for review yet"),
    p.reviewStatus === "approved" && !p.searchable && "Approved but not searchable — approve again in Verification Queue to turn search on",
    p.identityStatus !== "verified" && (p.identityStatus === "pending" ? "ID waiting for a check (Verification Queue)" : "ID not verified yet"),
    !owner && !subActive && `Membership not active (${p.subscriptionStatus ?? "not started"})`,
    p.vacationMode && "Vacation mode is on",
    p.membershipPausedAt && "Membership paused by Nearest",
    p.listingPausedAt && "Listing paused by Nearest",
    standing.suspendedUntil && `Suspended until ${fmtDate(standing.suspendedUntil)}`,
    standing.overdue.length > 0 && "Overdue fine (hidden from search until paid)",
    !p.countyId && "Location has no county — students searching by area won't see them (re-save Location & travel)",
  ].filter(Boolean) as string[];
}

/** Every professional with the reasons they're hidden — for the owner view when customers see nobody. */
export async function hiddenPros() {
  const rows = await db
    .select({ p: professionalProfiles, first: users.firstName, last: users.lastName })
    .from(professionalProfiles)
    .innerJoin(users, eq(users.id, professionalProfiles.userId))
    .orderBy(asc(professionalProfiles.createdAt))
    .limit(25);
  const out = await Promise.all(
    rows.map(async ({ p, first, last }) => ({
      userId: p.userId,
      name: p.businessName || `${first ?? ""} ${last ?? ""}`.trim() || "Unnamed professional",
      blockers: await proBlockers(p),
    })),
  );
  return out.filter((r) => r.blockers.length > 0);
}
