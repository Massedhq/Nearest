import "server-only";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, studentProfiles, schools, cities, cityCounties, schoolRequests } from "@/db";
import { getViewer, destinationFor } from "./viewer";

export async function requireStudent() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (viewer.user?.accountType !== "student") redirect(await destinationFor(viewer));
  const profile = (await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, viewer.user.id) }))!;
  return { user: viewer.user, profile };
}

/** Where an unverified student should be in the verification flow. */
export async function verifyStep(userId: string, profile: typeof studentProfiles.$inferSelect) {
  if (profile.verificationStatus === "verified") return null;
  if (profile.verificationStatus === "pending" || profile.verificationStatus === "manual_review" || profile.verificationStatus === "rejected") return "/verify/status";
  if (profile.schoolId) return "/verify/id";
  const req = await db.query.schoolRequests.findFirst({ where: and(eq(schoolRequests.userId, userId), eq(schoolRequests.status, "pending")) });
  return req ? "/verify/id" : "/verify";
}

/** Browsing is only for verified students. Everyone else is sent to their next verification step. */
export async function requireVerifiedStudent() {
  const s = await requireStudent();
  const step = await verifyStep(s.user.id, s.profile);
  if (step) redirect(step);
  const area = s.profile.schoolId ? await schoolArea(s.profile.schoolId) : null;
  return { ...s, area };
}

export async function schoolArea(schoolId: number) {
  const row = await db
    .select({ school: schools.name, cityId: cities.id, city: cities.name, countyId: cityCounties.countyId })
    .from(schools)
    .innerJoin(cities, eq(cities.id, schools.cityId))
    .leftJoin(cityCounties, eq(cityCounties.cityId, cities.id))
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
