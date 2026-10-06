import "server-only";
import { redirect } from "next/navigation";
import { and, eq, sql, ne } from "drizzle-orm";
import { db, professionalProfiles, proServices, proHours, portfolioItems } from "@/db";
import { getViewer, destinationFor, proAccess } from "./viewer";

/**
 * Use at the top of every pro page and pro server action. Professionals build their whole profile first and accept
 * the Professional Terms on the last step (no payment to join). `allowUnpaid` is kept for older callers; it has no effect.
 */
export async function requirePro(_opts: { allowUnpaid?: boolean } = {}) {
  void _opts;
  const viewer = await getViewer();
  if (!viewer) redirect("/pro/sign-in");
  if (!viewer.user || !(await proAccess(viewer))) redirect(await destinationFor(viewer));
  const profile = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, viewer.user!.id) });
  if (!profile) redirect("/pro/onboarding");
  return { viewer, user: viewer.user!, profile };
}

export type SetupStep = { key: string; label: string; href: string; done: boolean; optional?: boolean };

/** What's finished and what's left before a pro can submit for review. */
export async function setupSteps(userId: string): Promise<SetupStep[]> {
  const profile = (await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, userId) }))!;
  const [[svc], [hrs], [port]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(proServices).where(and(eq(proServices.userId, userId), eq(proServices.active, true))),
    db.select({ n: sql<number>`count(*)::int` }).from(proHours).where(and(eq(proHours.userId, userId), eq(proHours.kind, "regular"))),
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
