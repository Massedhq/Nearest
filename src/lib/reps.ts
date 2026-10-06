import "server-only";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db, salesReps, users, professionalProfiles, studentProfiles, repLinkClicks } from "@/db";

export const REP_COOKIE = "nearest_rep";
export const REP_INVITE_DAYS = 14;

/** A short code for the rep's link (letters and numbers only, no look-alikes). */
export function newRepCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = randomBytes(6);
  return "R" + Array.from(b, (x) => abc[x % abc.length]).join("");
}
export const newRepToken = () => randomBytes(24).toString("hex");

export const repLinks = (origin: string, code: string) => ({
  pro: `${origin}/r/${code}`, // tap counted, then the professional page (old ?rep= links still credit)
  student: `${origin}/r/${code}/students`,
});

/** The rep whose link this person came through (remembered for 30 days) — only active, verified reps get credit. */
export async function repIdFromCookie(): Promise<string | null> {
  const code = (await cookies()).get(REP_COOKIE)?.value?.toUpperCase();
  if (!code || !/^[A-Z0-9]{3,12}$/.test(code)) return null;
  const r = await db.query.salesReps.findFirst({ where: and(eq(salesReps.code, code), eq(salesReps.status, "active"), eq(salesReps.verificationStatus, "approved")) });
  return r?.id ?? null;
}

/** The signed-in person's active rep record, if they're a sales rep. */
export async function repForUser(userId: string | null | undefined) {
  if (!userId) return null;
  return (await db.query.salesReps.findFirst({ where: and(eq(salesReps.userId, userId), eq(salesReps.status, "active")) })) ?? null;
}

export type RepStats = {
  total: number; pros: number; prosJoined: number; students: number; studentsVerified: number; thisMonth: number;
  proClicks: number; studentClicks: number; prosLive: number; prosActive: number; studentsBooked: number;
};
export type RepPeriod = "week" | "month" | "all";

/**
 * What each ambassador's links produced in a period (sign-ups counted by sign-up date):
 * clicks → pros signed up → profile submitted (prosJoined) → live → membership activated; students → verified → booked.
 */
export async function repStats(repIds: string[], period: RepPeriod = "all"): Promise<Map<string, RepStats>> {
  const out = new Map<string, RepStats>();
  if (!repIds.length) return out;
  const monthStart = sql`date_trunc('month', now() at time zone 'America/Chicago') at time zone 'America/Chicago'`;
  const since = period === "week" ? sql`now() - interval '7 days'` : period === "month" ? monthStart : sql`'-infinity'::timestamptz`;
  const sinceDay = period === "week" ? sql`(now() at time zone 'America/Chicago')::date - 6` : period === "month" ? sql`date_trunc('month', now() at time zone 'America/Chicago')::date` : sql`'-infinity'::date`;
  const rows = await db
    .select({
      repId: users.repId,
      total: sql<number>`count(*)::int`,
      pros: sql<number>`count(*) filter (where ${users.accountType} = 'professional')::int`,
      prosJoined: sql<number>`count(*) filter (where ${users.accountType} = 'professional' and (${professionalProfiles.entryPaidAt} is not null or ${professionalProfiles.subscriptionStatus} in ('active','trialing','past_due')))::int`,
      prosLive: sql<number>`count(*) filter (where ${users.accountType} = 'professional' and ${professionalProfiles.reviewStatus} = 'approved' and ${professionalProfiles.searchable})::int`,
      prosActive: sql<number>`count(*) filter (where ${users.accountType} = 'professional' and ${professionalProfiles.subscriptionStatus} in ('active','trialing'))::int`,
      students: sql<number>`count(*) filter (where ${users.accountType} = 'student')::int`,
      studentsVerified: sql<number>`count(*) filter (where ${users.accountType} = 'student' and ${studentProfiles.verificationStatus} = 'verified')::int`,
      studentsBooked: sql<number>`count(*) filter (where ${users.accountType} = 'student' and exists (select 1 from bookings b where b.student_id = ${users.id} and b.status in ('confirmed','completed')))::int`,
      thisMonth: sql<number>`count(*) filter (where ${users.createdAt} >= ${monthStart})::int`,
    })
    .from(users)
    .leftJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
    .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .where(and(isNotNull(users.repId), inArray(users.repId, repIds), sql`${users.createdAt} >= ${since}`))
    .groupBy(users.repId);
  const clicks = await db.select({ repId: repLinkClicks.repId, kind: repLinkClicks.kind, n: sql<number>`sum(${repLinkClicks.clicks})::int` })
    .from(repLinkClicks).where(and(inArray(repLinkClicks.repId, repIds), sql`${repLinkClicks.day} >= ${sinceDay}`)).groupBy(repLinkClicks.repId, repLinkClicks.kind);
  for (const id of repIds) out.set(id, { total: 0, pros: 0, prosJoined: 0, students: 0, studentsVerified: 0, thisMonth: 0, proClicks: 0, studentClicks: 0, prosLive: 0, prosActive: 0, studentsBooked: 0 });
  for (const r of rows) if (r.repId) Object.assign(out.get(r.repId)!, { total: r.total, pros: r.pros, prosJoined: r.prosJoined, prosLive: r.prosLive, prosActive: r.prosActive, students: r.students, studentsVerified: r.studentsVerified, studentsBooked: r.studentsBooked, thisMonth: r.thisMonth });
  for (const c of clicks) { const o = out.get(c.repId); if (o) { if (c.kind === "pro") o.proClicks = c.n; else o.studentClicks = c.n; } }
  return out;
}

/** The rep's recent sign-ups. Students are never named (many are minors) — just "Student" and their status. */
export async function repRecent(repId: string, limit = 25) {
  const rows = await db
    .select({
      type: users.accountType, first: users.firstName, last: users.lastName, createdAt: users.createdAt,
      businessName: professionalProfiles.businessName, paid: professionalProfiles.entryPaidAt, sub: professionalProfiles.subscriptionStatus,
      verified: studentProfiles.verificationStatus,
    })
    .from(users)
    .leftJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
    .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .where(eq(users.repId, repId))
    .orderBy(desc(users.createdAt))
    .limit(limit);
  return rows.map((r) => {
    if (r.type === "professional") {
      const joined = Boolean(r.paid) || ["active", "trialing", "past_due"].includes(r.sub ?? "");
      const who = r.businessName || [r.first, r.last ? `${r.last[0]}.` : ""].filter(Boolean).join(" ") || "Professional";
      return { who, kind: "Professional", status: joined ? "Joined" : "Signed up", ok: joined, createdAt: r.createdAt };
    }
    return { who: "Student", kind: "Student", status: r.verified === "verified" ? "Verified" : "Signed up", ok: r.verified === "verified", createdAt: r.createdAt };
  });
}
