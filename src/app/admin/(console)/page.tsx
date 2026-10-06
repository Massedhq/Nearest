import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db, users, invitations, activityLog, professionalProfiles, studentProfiles, bookings } from "@/db";
import { money } from "@/lib/time";
import { AdminHead } from "@/components/AdminHead";
import { StatusPanel } from "@/components/StatusPanel";
import { requireAdmin } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { foundingCount, expireStaleInvites } from "@/lib/invites";

export const metadata = { title: "Command Center" };

const count = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;

export default async function CommandCenter() {
  const { user, role } = await requireAdmin();
  await expireStaleInvites();
  const [settings, founding, pros, students, activeCities, pending, recent, toReview, studentsToVerify] = await Promise.all([
    getSettings(),
    foundingCount(),
    count(db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.accountType, "professional"))),
    count(db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.accountType, "student"))),
    count(db.select({ n: sql<number>`count(distinct ${professionalProfiles.cityId})::int` }).from(professionalProfiles).where(sql`${professionalProfiles.entryType} = 'FIRST_IN' and ${professionalProfiles.entryPaidAt} is not null and ${professionalProfiles.cityId} is not null`)),
    count(db.select({ n: sql<number>`count(*)::int` }).from(invitations).where(eq(invitations.status, "invited"))),
    db
      .select({ at: activityLog.createdAt, action: activityLog.action, target: activityLog.targetId, first: users.firstName })
      .from(activityLog)
      .leftJoin(users, eq(users.id, activityLog.actorUserId))
      .orderBy(desc(activityLog.createdAt))
      .limit(5),
    count(db.select({ n: sql<number>`count(*)::int` }).from(professionalProfiles).where(eq(professionalProfiles.reviewStatus, "submitted"))),
    count(db.select({ n: sql<number>`count(*)::int` }).from(studentProfiles).where(eq(studentProfiles.verificationStatus, "pending"))),
  ]);
  // Today (Chicago) and monthly membership income
  const [[{ n: bookingsToday }], [{ cents: mrr, n: payingPros }]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(bookings).where(sql`(${bookings.startsAt} at time zone 'America/Chicago')::date = (now() at time zone 'America/Chicago')::date and ${bookings.status} in ('confirmed','completed')`),
    db.select({ cents: sql<number>`coalesce(sum(coalesce(${professionalProfiles.monthlyRateCents}, 3000)), 0)::int`, n: sql<number>`count(*)::int` }).from(professionalProfiles).where(sql`${professionalProfiles.subscriptionStatus} in ('active','trialing')`),
  ]);
  const [{ n: proIdsToVerify }] = await db.select({ n: sql<number>`count(*)::int` }).from(professionalProfiles).where(eq(professionalProfiles.identityStatus, "pending"));
  const capacity = Number(settings["growth.founding_capacity"]);
  const pct = Math.min(100, Math.round((founding / capacity) * 100));
  const hello = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Chicago" })) < 12 ? "Good morning" : "Good afternoon";
  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" });

  return (
    <>
      <AdminHead eyebrow={`Command center • ${today}`} title={`${hello}, ${user.firstName ?? "there"}`} />
      <div className="kpis">
        <div className="card" style={{ gap: 6 }}><span className="xs muted">First In</span><span className="stat">{founding} / {capacity}</span><span className="bar" style={{ display: "block", marginTop: 6 }}><i style={{ width: `${pct}%` }} /></span></div>
        <div className="card" style={{ gap: 6 }}><span className="xs muted">Professionals</span><span className="stat">{pros}</span></div>
        <div className="card" style={{ gap: 6 }}><span className="xs muted">Students</span><span className="stat">{students}</span></div>
        <Link className="card" href="/admin/bookings" style={{ gap: 6, textDecoration: "none", color: "inherit" }}><span className="xs muted">Bookings today</span><span className="stat">{bookingsToday}</span><span className="xs muted">confirmed or done</span></Link>
        <Link className="card" href="/admin/money" style={{ gap: 6, textDecoration: "none", color: "inherit" }}><span className="xs muted">Professional MRR</span><span className="stat">{money(mrr)}</span><span className="xs muted">{payingPros} paying professional{payingPros === 1 ? "" : "s"}</span></Link>
      </div>
      <div className="acols">
        <div className="col g16">
          <div className="card" style={{ gap: 12 }}>
            <span className="eyebrow">Needs attention</span>
            <div className="grid3">
              <Link className="card" href="/admin/founding" style={{ textDecoration: "none", background: "#0A0A0B", gap: 8 }}><span className="stat">{pending}</span><span className="xs muted">Invitations waiting</span></Link>
              <Link className="card" href="/admin/verification" style={{ textDecoration: "none", background: "#0A0A0B", gap: 8 }}><span className="stat">{toReview + studentsToVerify + proIdsToVerify}</span><span className="xs muted">Students &amp; pros to verify</span></Link>
              <div className="card" style={{ background: "#0A0A0B", gap: 8 }}><span className="stat">{activeCities}</span><span className="xs muted">Cities with a First In pro</span></div>
            </div>
          </div>
          <div className="card" style={{ gap: 10 }}>
            <div className="row between"><span className="eyebrow">Recent admin activity</span><Link className="link small" href="/admin/team">Full activity log</Link></div>
            {recent.length === 0 && <span className="small muted">No admin activity yet.</span>}
            {recent.map((r, i) => (
              <div key={i} className="small"><span className="b">{r.first ?? "System"}</span> {r.action.replace(".", " ")} {r.target} <span className="muted">— {r.at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}</span></div>
            ))}
          </div>
        </div>
        <StatusPanel settings={settings} canEdit={role === "OWNER"} />
      </div>
    </>
  );
}
