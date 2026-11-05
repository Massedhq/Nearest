import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, categories, cities, coverageNotices, professionalProfiles, proServices, schools, studentProfiles, users } from "@/db";
import { liveProWhere } from "./search";
import { inbox } from "./inbox";
import { proTitle } from "./pro-titles";

/**
 * Student demand (2026-11-05): students tell us what they're most interested in at sign-up (studentProfiles.interests =
 * category names). Their city is their school's city. This shows the team where students are waiting for a service with
 * no professional yet, gives students a "Coming soon to your city" note, and tells them once when the first
 * professional for that service goes live in their city (coverage_notices). Counts only — never names.
 */

/** Every city + service category that has at least one live professional (same rule students search with). */
export async function liveCoverage() {
  const rows = await db.selectDistinct({ cityId: professionalProfiles.cityId, category: categories.name })
    .from(professionalProfiles)
    .innerJoin(proServices, and(eq(proServices.userId, professionalProfiles.userId), eq(proServices.active, true)))
    .innerJoin(categories, eq(categories.id, proServices.categoryId))
    .where(and(...liveProWhere(null, "place"), sql`${professionalProfiles.cityId} is not null`));
  return rows.filter((r): r is { cityId: number; category: string } => r.cityId != null);
}

const key = (cityId: number, category: string) => `${cityId}|${category}`;

/** Students waiting, by city and service: signed up / verified, and how many live professionals that service has there. */
export async function demandByCity() {
  const [rows] = await Promise.all([
    db.execute(sql`select s.city_id as "cityId", c.name as city, i.cat as category,
        count(*)::int as students,
        count(*) filter (where sp.verification_status = 'verified')::int as verified
      from student_profiles sp
      join schools s on s.id = sp.school_id
      join cities c on c.id = s.city_id
      cross join lateral unnest(coalesce(sp.interests, '{}'::text[])) as i(cat)
      group by s.city_id, c.name, i.cat
      order by students desc`),
  ]);
  const proCount = new Map<string, number>();
  const counts = await db.select({ cityId: professionalProfiles.cityId, category: categories.name, n: sql<number>`count(distinct ${professionalProfiles.userId})::int` })
    .from(professionalProfiles)
    .innerJoin(proServices, and(eq(proServices.userId, professionalProfiles.userId), eq(proServices.active, true)))
    .innerJoin(categories, eq(categories.id, proServices.categoryId))
    .where(and(...liveProWhere(null, "place")))
    .groupBy(professionalProfiles.cityId, categories.name);
  for (const c of counts) if (c.cityId != null) proCount.set(key(c.cityId, c.category), c.n);
  return (rows.rows as { cityId: number; city: string; category: string; students: number; verified: number }[])
    .map((r) => ({ ...r, pros: proCount.get(key(r.cityId, r.category)) ?? 0 }));
}

/** A ready-to-paste line for recruiters: "38 students in Lewisville are looking for a lash tech on Nearest." */
export function recruitLine(r: { city: string; category: string; students: number }) {
  const who = proTitle(r.category).replace(/s$/, "");
  return `${r.students} student${r.students === 1 ? " is" : "s are"} in ${r.city} looking for ${/^[aeiou]/i.test(who) ? "an" : "a"} ${who.toLowerCase()} on Nearest.`;
}

/** The services this student picked that have no live professional in their city yet ("Coming soon"). */
export async function comingSoonFor(userId: string) {
  const sp = await db.select({ interests: studentProfiles.interests, cityId: schools.cityId, city: cities.name })
    .from(studentProfiles).leftJoin(schools, eq(schools.id, studentProfiles.schoolId)).leftJoin(cities, eq(cities.id, schools.cityId))
    .where(eq(studentProfiles.userId, userId)).limit(1);
  const me = sp[0];
  if (!me?.cityId || !me.interests?.length) return { city: me?.city ?? null, soon: [] as string[] };
  const live = new Set((await liveCoverage()).filter((r) => r.cityId === me.cityId).map((r) => r.category));
  return { city: me.city, soon: me.interests.filter((c) => !live.has(c)) };
}

/**
 * Cron: when a city + service gets its first live professional, tell every student in that city who picked that service
 * (app notice + email), once. The first run only records what's already covered, so nobody gets old news.
 */
export async function notifyNewCoverage() {
  const live = await liveCoverage();
  const known = await db.select({ cityId: coverageNotices.cityId, category: coverageNotices.category }).from(coverageNotices);
  const seen = new Set(known.map((k) => key(k.cityId, k.category)));
  const fresh = live.filter((r) => !seen.has(key(r.cityId, r.category)));
  if (!fresh.length) return { newPlaces: 0, notified: 0 };
  if (!known.length) {
    await db.insert(coverageNotices).values(fresh.map((r) => ({ cityId: r.cityId, category: r.category, silent: true }))).onConflictDoNothing();
    return { newPlaces: 0, notified: 0, recorded: fresh.length };
  }
  const { sendEmail } = await import("./email");
  const base = process.env.APP_URL || "https://www.usenearest.com";
  let notified = 0;
  for (const r of fresh.slice(0, 50)) {
    // Claim it first so two runs never notify twice.
    const [claimed] = await db.insert(coverageNotices).values({ cityId: r.cityId, category: r.category }).onConflictDoNothing().returning({ id: coverageNotices.id });
    if (!claimed) continue;
    const city = (await db.query.cities.findFirst({ where: eq(cities.id, r.cityId) }))?.name ?? "your city";
    const who = proTitle(r.category).replace(/s$/, "");
    const students = await db.select({ id: users.id, email: users.email, first: users.firstName })
      .from(studentProfiles).innerJoin(users, eq(users.id, studentProfiles.userId)).innerJoin(schools, eq(schools.id, studentProfiles.schoolId))
      .where(and(eq(schools.cityId, r.cityId), sql`${r.category} = any(${studentProfiles.interests})`));
    for (const s of students) {
      await inbox(s.id, { kind: "coverage", title: `${r.category} is now on Nearest in ${city}`, body: `You told us you were interested in ${r.category}. ${/^[aeiou]/i.test(who) ? "An" : "A"} ${who.toLowerCase()} in ${city} is now taking bookings.`, href: `/home?q=${encodeURIComponent(r.category)}` });
      if (s.email) await sendEmail({ to: s.email, subject: `${r.category} is now on Nearest in ${city}`, heading: `${r.category} is here, ${s.first ?? "there"}`, lines: [`You told us you were interested in ${r.category}. ${/^[aeiou]/i.test(who) ? "An" : "A"} ${who.toLowerCase()} in ${city} is now taking bookings on Nearest.`, "Open Nearest to see their work and book."], button: { label: "See who's booking", url: `${base}/home` } }).catch(() => {});
    }
    await db.update(coverageNotices).set({ studentsNotified: students.length }).where(eq(coverageNotices.id, claimed.id));
    notified += students.length;
  }
  return { newPlaces: fresh.length, notified };
}
