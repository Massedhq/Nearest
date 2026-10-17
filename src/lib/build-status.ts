import type { professionalProfiles } from "@/db";

type P = typeof professionalProfiles.$inferSelect;

/** Where a profile Nearest built is: building → link sent → claimed → accepted (live once their ID is verified). */
export function buildStatus(p: P): { label: string; tone: "" | "warn" | "ok" | "bad" } {
  if (p.entryPaidAt) {
    if (p.reviewStatus === "approved" && p.searchable && p.identityStatus === "verified") return { label: "Live", tone: "ok" };
    if (!p.searchable) return { label: "Accepted — they went offline", tone: "" };
    return { label: p.identityStatus === "pending" ? "Accepted — ID being checked" : "Accepted — waiting on their ID", tone: "warn" };
  }
  if (p.claimedAt) return { label: "Password set — Terms not accepted yet", tone: "warn" };
  if (p.claimSentAt) return p.claimExpiresAt && p.claimExpiresAt.getTime() < Date.now() ? { label: "Link expired — send a new one", tone: "bad" } : { label: "Link sent", tone: "warn" };
  return { label: "Building", tone: "" };
}
