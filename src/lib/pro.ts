import "server-only";
import { redirect } from "next/navigation";
import { and, eq, sql, ne } from "drizzle-orm";
import { db, professionalProfiles, proServices, proHours, portfolioItems } from "@/db";
import { destinationFor, proAccess } from "./viewer";
import { getProViewer } from "./build-mode";

/**
 * Use at the top of every pro page and pro server action. Professionals build their whole profile first and accept
 * the Professional Terms on the last step (no payment to join). `allowUnpaid` is kept for older callers; it has no effect.
 * While a Nearest owner is building a profile for a professional (Admin → Build a profile), this returns that
 * professional's account. `self: true` marks things only the professional can do themselves (accept Terms, ID selfie,
 * payouts, bookings) — an owner who is building is sent back to the profile instead.
 */
export async function requirePro(opts: { allowUnpaid?: boolean; self?: boolean } = {}) {
  const viewer = await getProViewer();
  if (!viewer) redirect("/pro/sign-in");
  if (!viewer.user || !(await proAccess(viewer))) redirect(await destinationFor(viewer));
  if (opts.self && viewer.building) redirect("/pro/setup/review");
  const profile = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, viewer.user!.id) });
  if (!profile) redirect("/pro/onboarding");
  // Registration on hold (never finished within 30 days): the enrollment-closed page, until an owner releases it.
  // Owners building a profile for someone keep working on it.
  if (!viewer.building && !viewer.admin && !profile.entryPaidAt) {
    const { activeHold } = await import("./enrollment-holds");
    if (await activeHold({ userId: viewer.user!.id })) redirect("/pro/enrollment-closed");
  }
  return { viewer, user: viewer.user!, profile, building: Boolean(viewer.building) };
}

export type SetupStep = { key: string; label: string; href: string; done: boolean; optional?: boolean };

/** What's finished and what's left before a pro can submit for review. */
export async function setupSteps(userId: string): Promise<SetupStep[]> {
  const profile = (await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, userId) }))!;
  const [[svc], [hrs], [port]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(proServices).where(and(eq(proServices.userId, userId), eq(proServices.active, true))),
    db.select({ n: sql<number>`count(*)::int` }).from(proHours).where(eq(proHours.userId, userId)), // regular, after-school or both
    db.select({ n: sql<number>`count(*)::int` }).from(portfolioItems).where(eq(portfolioItems.userId, userId)),
  ]);
  const steps: SetupStep[] = [
    { key: "profile", label: "Profile", href: "/pro/setup/profile", done: Boolean(profile.businessName && profile.bio) },
    { key: "services", label: "Services & prices", href: "/pro/setup/services", done: svc.n > 0 },
  ];
  // Professional status: asked once for the account (self-reported), never per category and never reviewed.
  steps.push({ key: "credentials", label: "Professional status", href: "/pro/setup/credentials", done: Boolean(profile.professionalStatus) });
  steps.push(
    { key: "location", label: "Location & travel", href: "/pro/setup/location", done: Boolean(profile.cityId && profile.serviceMode) },
    { key: "hours", label: "Hours", href: "/pro/setup/hours", done: hrs.n > 0 },
    { key: "communication", label: "Communication", href: "/pro/setup/communication", done: Array.isArray(profile.languages) && profile.languages.length > 0 },
    { key: "portfolio", label: "Portfolio", href: "/pro/setup/portfolio", done: port.n > 0, optional: true },
    // Secures the account: photo ID + selfie, checked by Nearest. Sent (pending) counts as done for submitting.
    { key: "identity", label: "Verify your identity", href: "/pro/setup/identity", done: ["pending", "verified"].includes(profile.identityStatus ?? "") },
  );
  return steps;
}

export const setupComplete = (steps: SetupStep[]) => steps.every((s) => s.done || s.optional);

/** Next page in the setup flow after `key`, or the review page when everything is done. */
export function nextStep(steps: SetupStep[], key: string) {
  const i = steps.findIndex((s) => s.key === key);
  return steps[i + 1]?.href ?? "/pro/setup/review";
}
