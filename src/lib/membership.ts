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

/**
 * No monthly membership (2026-10-17): Nearest earns only its per-booking service fee (services AND Model Calls).
 * With this off, nobody is asked to activate, nobody is billed, pay-from-bookings dues aren't collected, and a past
 * membership's payment status never hides a professional. Kept as one switch so a paid plan could return later —
 * turning it back on would also need new Terms.
 */
export const MEMBERSHIP_ENABLED = false as boolean;

export function membershipState(p: Profile, owner = false): MembershipState {
  if (!MEMBERSHIP_ENABLED) return "active";
  if (owner || isManagedEntry(p.entryType)) return "active";
  if (["active", "trialing"].includes(p.subscriptionStatus ?? "")) return "active";
  if (!p.subscriptionId) return "not_activated";
  return "payment_issue";
}

export const MEMBERSHIP_LABEL: Record<MembershipState, string> = {
  not_activated: "Membership not yet activated",
  active: MEMBERSHIP_ENABLED ? "Active member" : "Joined — no monthly fee",
  payment_issue: "Membership payment issue",
};

/** Profile state for admin: incomplete until they submit and Nearest approves. */
export function profileState(p: Profile) {
  return p.reviewStatus === "approved" ? "Profile complete" : p.reviewStatus === "submitted" ? "Profile submitted — in review" : "Profile incomplete";
}
