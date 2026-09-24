import "server-only";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, professionalProfiles, proServices, proHours, portfolioItems, proCredentials, categories } from "@/db";
import { getViewer, destinationFor } from "./viewer";

/** Use at the top of every pro page and pro server action. */
export async function requirePro() {
  const viewer = await getViewer();
  if (!viewer) redirect("/pro/sign-in");
  if (viewer.user?.accountType !== "professional") redirect(await destinationFor(viewer));
  const profile = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, viewer.user.id) });
  if (!profile) redirect("/pro/onboarding");
  return { viewer, user: viewer.user, profile };
}

export type SetupStep = { key: string; label: string; href: string; done: boolean; optional?: boolean };

/** What's finished and what's left before a pro can submit for review. */
export async function setupSteps(userId: string): Promise<SetupStep[]> {
  const profile = (await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, userId) }))!;
  const [[svc], [hrs], [port], needLicense, [creds]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(proServices).where(and(eq(proServices.userId, userId), eq(proServices.active, true))),
    db.select({ n: sql<number>`count(*)::int` }).from(proHours).where(and(eq(proHours.userId, userId), eq(proHours.kind, "regular"))),
    db.select({ n: sql<number>`count(*)::int` }).from(portfolioItems).where(eq(portfolioItems.userId, userId)),
    db
      .selectDistinct({ id: categories.id })
      .from(proServices)
      .innerJoin(categories, eq(categories.id, proServices.categoryId))
      .where(and(eq(proServices.userId, userId), eq(proServices.active, true), eq(categories.licenseRequired, true))),
    db.select({ n: sql<number>`count(*)::int` }).from(proCredentials).where(eq(proCredentials.userId, userId)),
  ]);
  const steps: SetupStep[] = [
    { key: "profile", label: "Profile", href: "/pro/setup/profile", done: Boolean(profile.businessName && profile.bio) },
    { key: "services", label: "Services & prices", href: "/pro/setup/services", done: svc.n > 0 },
  ];
  if (needLicense.length) steps.push({ key: "credentials", label: "License", href: "/pro/setup/credentials", done: creds.n >= needLicense.length });
  steps.push(
    { key: "location", label: "Location & travel", href: "/pro/setup/location", done: Boolean(profile.cityId && profile.serviceMode) },
    { key: "hours", label: "Hours", href: "/pro/setup/hours", done: hrs.n > 0 },
    { key: "communication", label: "Communication", href: "/pro/setup/communication", done: Array.isArray(profile.languages) && profile.languages.length > 0 },
    { key: "portfolio", label: "Portfolio", href: "/pro/setup/portfolio", done: port.n > 0, optional: true },
  );
  return steps;
}

export const setupComplete = (steps: SetupStep[]) => steps.every((s) => s.done || s.optional);

/** Next page in the setup flow after `key`, or the review page when everything is done. */
export function nextStep(steps: SetupStep[], key: string) {
  const i = steps.findIndex((s) => s.key === key);
  return steps[i + 1]?.href ?? "/pro/setup/review";
}
