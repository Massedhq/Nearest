import "server-only";
import { professionalProfiles } from "@/db";
import { isManagedEntry } from "./entry";

type Profile = typeof professionalProfiles.$inferSelect;

/**
 * Membership is separate from profile completion:
 *  not_activated — enrolled and agreed to the terms, no payment yet (activates when they accept their first booking)
 *  active        — paying membership (or Nearest-managed: Ambassador / pay-from-bookings, or an owner's business)
 *  payment_issue — had a membership and the payment failed / it lapsed (existing subscription rules hide them)
 */
export type MembershipState = "not_activated" | "active" | "payment_issue";

export function membershipState(p: Profile, owner = false): MembershipState {
  if (owner || isManagedEntry(p.entryType)) return "active";
  if (["active", "trialing"].includes(p.subscriptionStatus ?? "")) return "active";
  if (!p.subscriptionId) return "not_activated";
  return "payment_issue";
}

export const MEMBERSHIP_LABEL: Record<MembershipState, string> = {
  not_activated: "Membership not yet activated",
  active: "Active member",
  payment_issue: "Membership payment issue",
};

/** Profile state for admin: incomplete until they submit and Nearest approves. */
export function profileState(p: Profile) {
  return p.reviewStatus === "approved" ? "Profile complete" : p.reviewStatus === "submitted" ? "Profile submitted — in review" : "Profile incomplete";
}
