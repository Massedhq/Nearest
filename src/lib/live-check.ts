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
    p.reviewStatus === "approved" && !p.searchable && "Went offline — their Go live switch is off (they turn it back on from Today or Business)",
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

export type ReadyItem = { label: string; href?: string };

/**
 * The same checks as proBlockers(), worded for the professional, minus their own Go live switch.
 * Empty list = they can tap Go live. Payouts are never required — earnings are held until they connect.
 */
export async function proReadiness(p: Profile): Promise<ReadyItem[]> {
  const [owner, steps, standing] = await Promise.all([isOwnerBusiness(p.userId), setupSteps(p.userId), proStanding(p.userId)]);
  const paid = owner || hasPaidEntry(p);
  const subActive = ["active", "trialing"].includes(p.subscriptionStatus ?? "");
  const out: (ReadyItem | false | null | undefined)[] = [
    !paid && { label: "Pay your entry to join", href: "/pro/join" },
    ...steps.filter((s) => !s.done && !s.optional).map((s) => ({ label: `Finish setup: ${s.label}`, href: `${s.href}?edit=1` })),
    p.reviewStatus !== "approved" && (p.reviewStatus === "submitted"
      ? { label: "Nearest is reviewing your profile — usually within a day" }
      : p.reviewStatus === "rejected"
        ? { label: "Make the requested changes and resubmit", href: "/pro/setup/review" }
        : { label: "Submit your profile for review", href: "/pro/setup/review" }),
    p.identityStatus !== "verified" && (p.identityStatus === "pending" ? { label: "Nearest is checking your ID" } : { label: "Finish your ID check", href: "/pro/payments" }),
    !owner && !subActive && { label: "Start your membership", href: "/pro/payments" },
    p.vacationMode && { label: "Turn off vacation mode", href: "/pro/calendar" },
    p.membershipPausedAt && { label: "Your membership is paused by Nearest" },
    p.listingPausedAt && { label: "Your listing is paused by Nearest" },
    standing.suspendedUntil && { label: `Suspended until ${fmtDate(standing.suspendedUntil)}`, href: "/pro/account-status" },
    standing.overdue.length > 0 && { label: "Pay your overdue fine", href: "/pro/account-status" },
    !p.countyId && { label: "Re-save your location so students in your area can find you", href: "/pro/setup/location?edit=1" },
  ];
  return out.filter(Boolean) as ReadyItem[];
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
