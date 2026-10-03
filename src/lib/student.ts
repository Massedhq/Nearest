import "server-only";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, studentProfiles, schools, cities, cityCounties, schoolRequests, counties } from "@/db";
import { getViewer, destinationFor } from "./viewer";

export async function requireStudent() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  // Owners can browse and book as customers: they get a customer profile without the school check.
  if (viewer.user && viewer.admin?.role === "OWNER") {
    let profile = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, viewer.user.id) });
    if (!profile) {
      [profile] = await db.insert(studentProfiles).values({ userId: viewer.user.id, verificationStatus: "verified", verifiedAt: new Date(), onboardingCompletedAt: new Date() }).onConflictDoNothing().returning();
      profile ??= (await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, viewer.user.id) }))!;
    }
    return { user: viewer.user, profile: { ...profile, verificationStatus: "verified" as const, reverifyBy: null } };
  }
  if (viewer.user?.accountType !== "student") redirect(await destinationFor(viewer));
  const profile = (await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, viewer.user.id) }))!;
  return { user: viewer.user, profile };
}

/** Where an unverified student should be in the verification flow. */
export async function verifyStep(userId: string, profile: typeof studentProfiles.$inferSelect) {
  if (profile.verificationStatus === "verified") return null;
  // Verified their school email with a code: temporary access while the owner reviews.
  if ((profile.verificationStatus === "pending" || profile.verificationStatus === "manual_review") && profile.schoolEmailVerifiedAt) return null;
  if (profile.verificationStatus === "pending" || profile.verificationStatus === "manual_review") return profile.onboardingCompletedAt ? "/verify/status" : "/verify/interests";
  if (profile.verificationStatus === "rejected") return "/verify/status";
  if (profile.selfieOnlyAt) return "/verify/finish"; // took the selfie, still needs the school ID or school email
  if (profile.schoolId) return "/verify/id";
  const req = await db.query.schoolRequests.findFirst({ where: and(eq(schoolRequests.userId, userId), eq(schoolRequests.status, "pending")) });
  return req ? "/verify/id" : "/verify";
}

/** Browsing is only for verified students. Everyone else is sent to their next verification step. */
export async function requireVerifiedStudent() {
  const s = await requireStudent();
  // Verified once, verified for good: no yearly school re-check. Graduates become Nearest Alumni (see isAlumni).
  const step = await verifyStep(s.user.id, s.profile);
  if (step) redirect(step);
  // Students 13–17: their parent or guardian must approve by email before they can use Nearest.
  const { needsGuardian } = await import("./guardian");
  if (needsGuardian(s.user) && s.profile.guardianStatus !== "approved") redirect("/verify/parent");
  const area = s.profile.schoolId ? await schoolArea(s.profile.schoolId) : null;
  return { ...s, area };
}

export async function schoolArea(schoolId: number) {
  const row = await db
    .select({ school: schools.name, cityId: cities.id, city: cities.name, countyId: cityCounties.countyId, market: counties.market })
    .from(schools)
    .innerJoin(cities, eq(cities.id, schools.cityId))
    .leftJoin(cityCounties, eq(cityCounties.cityId, cities.id))
    .leftJoin(counties, eq(counties.id, cityCounties.countyId))
    .where(eq(schools.id, schoolId))
    .limit(1);
  return row[0] ?? null;
}

/** Next August 31 after today (Chicago) — students reverify every school year. */
export function nextAug31(from = new Date()) {
  const y = from.getUTCFullYear();
  const thisYear = new Date(Date.UTC(y, 7, 31));
  return `${from <= thisYear ? y : y + 1}-08-31`;
}

/** Nearest Alumni: a verified student whose graduation year has passed (after June 30 of that year). Same access as students. */
export function isAlumni(p: { verificationStatus: string; graduationYear: number | null }, now = new Date()) {
  if (p.verificationStatus !== "verified" || !p.graduationYear) return false;
  return now.getTime() > Date.UTC(p.graduationYear, 5, 30, 23, 59);
}

/**
 * Browsing (Explore, profiles, Model Calls, favorites) opens as soon as the student's account exists.
 * Booking still needs verification (and parent approval under 18) — `finishStep` says where to finish.
 */
export async function requireBrowsingStudent() {
  const s = await requireStudent();
  let finishStep = await verifyStep(s.user.id, s.profile);
  if (!finishStep) {
    const { needsGuardian } = await import("./guardian");
    if (needsGuardian(s.user) && s.profile.guardianStatus !== "approved") finishStep = "/verify/parent";
  }
  const area = s.profile.schoolId ? await schoolArea(s.profile.schoolId) : null;
  return { ...s, area, finishStep, canBook: !finishStep };
}
