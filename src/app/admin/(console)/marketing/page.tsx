import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, cities, professionalProfiles, studentProfiles, schools, bookings, searchLog } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { requireAdmin } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { liveProWhere } from "@/lib/search";

export const metadata = { title: "Marketing" };

export default async function Marketing() {
  await requireAdmin();
  const s = await getSettings();
  const target = Number(s["growth.target_per_city"]);
  const since = new Date(Date.now() - 7 * 86400000);
  const [cityList, live, students, searches, misses, booked, topMisses] = await Promise.all([
    db.select().from(cities).where(eq(cities.active, true)),
    db.select({ cityId: professionalProfiles.cityId, n: sql<number>`count(*)::int` }).from(professionalProfiles).where(sql`${sql.join(liveProWhere(null, "all"), sql` and `)}`).groupBy(professionalProfiles.cityId),
    db.select({ cityId: schools.cityId, n: sql<number>`count(*)::int` }).from(studentProfiles).innerJoin(schools, eq(schools.id, studentProfiles.schoolId)).where(eq(studentProfiles.verificationStatus, "verified")).groupBy(schools.cityId),
    db.select({ cityId: searchLog.cityId, n: sql<number>`count(*)::int` }).from(searchLog).where(gte(searchLog.createdAt, since)).groupBy(searchLog.cityId),
    db.select({ cityId: searchLog.cityId, n: sql<number>`count(*)::int` }).from(searchLog).where(and(gte(searchLog.createdAt, since), eq(searchLog.results, 0))).groupBy(searchLog.cityId),
    db.select({ cityId: professionalProfiles.cityId, n: sql<number>`count(*)::int` }).from(bookings).innerJoin(professionalProfiles, eq(professionalProfiles.userId, bookings.proId)).where(gte(bookings.createdAt, since)).groupBy(professionalProfiles.cityId),
    db.select({ q: sql<string>`lower(trim(${searchLog.query}))`, city: cities.name, n: sql<number>`count(*)::int` }).from(searchLog).leftJoin(cities, eq(cities.id, searchLog.cityId))
      .where(and(gte(searchLog.createdAt, since), eq(searchLog.results, 0), sql`coalesce(trim(${searchLog.query}), '') <> ''`)).groupBy(sql`lower(trim(${searchLog.query}))`, cities.name).orderBy(desc(sql`count(*)`)).limit(10),
  ]);
  const n = (rows: { cityId: number | null; n: number }[], id: number) => rows.find((r) => r.cityId === id)?.n ?? 0;
  // Signals use any real demand (verified students or searches), not a large threshold.
  const all = cityList.map((c) => {
    const pros = n(live, c.id), st = n(students, c.id), sr = n(searches, c.id);
    const demand = st + sr;
    const signal = pros < target && demand > 0 ? "Needs pros" : pros > 0 && st === 0 ? "Needs students" : pros === 0 && demand === 0 ? "Not started" : "Balanced";
    return { c, pros, st, searches: sr, misses: n(misses, c.id), booked: n(booked, c.id), signal, demand };
  });
  const table = all.filter((r) => r.pros || r.st || r.searches || r.booked).sort((a, b) => b.misses - a.misses || b.demand - a.demand || b.pros - a.pros);
  const needPros = all.filter((r) => r.signal === "Needs pros").sort((a, b) => b.demand - a.demand || a.pros - b.pros)[0];
  const needStudents = all.filter((r) => r.signal === "Needs students").sort((a, b) => b.pros - a.pros)[0];
  const belowTarget = all.filter((r) => r.pros < target).length;
  const noPros = all.filter((r) => r.pros === 0).length;
  const anyDemand = all.some((r) => r.demand > 0);
  const anyPros = all.some((r) => r.pros > 0);
  const TAG: Record<string, string> = { "Needs pros": "warn", "Needs students": "warn", Balanced: "ok", "Not started": "" };

  return (
    <>
      <AdminHead eyebrow="Where to push next (last 7 days)" title="Marketing" />
      <div className={`card ${belowTarget ? "warn" : "ok"}`} style={{ gap: 6 }}>
        <span className="eyebrow">Professional coverage</span>
        <span className="disp h2">{belowTarget} of {all.length} active cities are below {target} live pros</span>
        <span className="small muted">{noPros} have no live professionals yet.{" "}<a className="link small" href="/admin/coverage?short=1">See cities below target</a></span>
      </div>
      <div className="acols even">
        <div className="card warn" style={{ gap: 8 }}><span className="eyebrow" style={{ color: "#E3C58A" }}>Demand without supply</span>
          {needPros ? <><span className="disp h2">{needPros.c.name}</span><span>{needPros.st} verified students • {needPros.searches} searches • {needPros.pros} live pros</span><span className="small muted">Recruit professionals in {needPros.c.name}.</span></>
            : anyDemand ? <span className="small muted">Every city with student activity has at least {target} live pros.</span>
            : <span className="small muted">No student activity yet. Once students verify and search, the city with the most demand and too few pros shows here.</span>}</div>
        <div className="card warn" style={{ gap: 8 }}><span className="eyebrow" style={{ color: "#E3C58A" }}>Supply without demand</span>
          {needStudents ? <><span className="disp h2">{needStudents.c.name}</span><span>{needStudents.pros} live pros • {needStudents.st} verified students</span><span className="small muted">Push student sign-ups in {needStudents.c.name}.</span></>
            : anyPros ? <span className="small muted">Every city with live pros has verified students.</span>
            : <span className="small muted">No live professionals yet, so there&apos;s no supply to match.</span>}</div>
      </div>
      <div className="acols">
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>City</th><th>Live pros</th><th>Verified students</th><th>Searches</th><th>Found nothing</th><th>Bookings</th><th>Signal</th></tr></thead>
            <tbody>
              {table.length === 0 && <tr><td className="empty" colSpan={7}>No live pros, verified students, searches or bookings in any city yet.</td></tr>}
              {table.map((r) => <tr key={r.c.id}><td className="b">{r.c.name}</td><td>{r.pros}</td><td>{r.st}</td><td>{r.searches}</td><td>{r.misses}</td><td>{r.booked}</td><td><span className={`tag ${TAG[r.signal]}`}>{r.signal}</span></td></tr>)}
            </tbody>
          </table>
        </div>
        <div className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Searched but found nothing</span>
          {topMisses.length === 0 && <span className="small muted">Nothing yet.</span>}
          {topMisses.map((m, i) => <div key={i} className="row between small"><span>&ldquo;{m.q}&rdquo;{m.city ? ` — ${m.city}` : ""}</span><span>{m.n}</span></div>)}
        </div>
      </div>
    </>
  );
}
