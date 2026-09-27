import Link from "next/link";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db, cities, counties, cityCounties, professionalProfiles, studentProfiles, schools, bookings, searchLog } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { requireAdmin } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { liveProWhere } from "@/lib/search";
import { marketName, sortMarkets } from "@/lib/markets";

export const metadata = { title: "Marketing" };
export const dynamic = "force-dynamic";

type Count = { cityId: number | null; n: number };

export default async function Marketing({ searchParams }: { searchParams: Promise<{ market?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const s = await getSettings();
  const target = Number(s["growth.target_per_city"]);
  const since = new Date(Date.now() - 7 * 86400000);
  const byCity = <T,>(q: T) => q;

  const [cityList, links, countyList, live, proSignups, verified, studentSignups, searches, misses, booked, topMisses, [unplacedPros], [unplacedStudents]] = await Promise.all([
    db.select().from(cities).where(eq(cities.active, true)),
    db.select().from(cityCounties),
    db.select({ id: counties.id, market: counties.market }).from(counties),
    byCity(db.select({ cityId: professionalProfiles.cityId, n: sql<number>`count(*)::int` }).from(professionalProfiles).where(sql`${sql.join(liveProWhere(null, "all"), sql` and `)}`).groupBy(professionalProfiles.cityId)),
    byCity(db.select({ cityId: professionalProfiles.cityId, n: sql<number>`count(*)::int` }).from(professionalProfiles).groupBy(professionalProfiles.cityId)),
    byCity(db.select({ cityId: schools.cityId, n: sql<number>`count(*)::int` }).from(studentProfiles).innerJoin(schools, eq(schools.id, studentProfiles.schoolId)).where(eq(studentProfiles.verificationStatus, "verified")).groupBy(schools.cityId)),
    byCity(db.select({ cityId: schools.cityId, n: sql<number>`count(*)::int` }).from(studentProfiles).innerJoin(schools, eq(schools.id, studentProfiles.schoolId)).groupBy(schools.cityId)),
    byCity(db.select({ cityId: searchLog.cityId, n: sql<number>`count(*)::int` }).from(searchLog).where(gte(searchLog.createdAt, since)).groupBy(searchLog.cityId)),
    byCity(db.select({ cityId: searchLog.cityId, n: sql<number>`count(*)::int` }).from(searchLog).where(and(gte(searchLog.createdAt, since), eq(searchLog.results, 0))).groupBy(searchLog.cityId)),
    byCity(db.select({ cityId: professionalProfiles.cityId, n: sql<number>`count(*)::int` }).from(bookings).innerJoin(professionalProfiles, eq(professionalProfiles.userId, bookings.proId)).where(gte(bookings.createdAt, since)).groupBy(professionalProfiles.cityId)),
    db.select({ q: sql<string>`lower(trim(${searchLog.query}))`, cityId: searchLog.cityId, city: cities.name, n: sql<number>`count(*)::int` }).from(searchLog).leftJoin(cities, eq(cities.id, searchLog.cityId))
      .where(and(gte(searchLog.createdAt, since), eq(searchLog.results, 0), sql`coalesce(trim(${searchLog.query}), '') <> ''`)).groupBy(sql`lower(trim(${searchLog.query}))`, searchLog.cityId, cities.name).orderBy(desc(sql`count(*)`)).limit(30),
    db.select({ n: sql<number>`count(*)::int` }).from(professionalProfiles).where(isNull(professionalProfiles.cityId)),
    db.select({ n: sql<number>`count(*)::int` }).from(studentProfiles).where(isNull(studentProfiles.schoolId)),
  ]);

  // Each city belongs to the market of its (first) county: DFW, Houston, Austin, Other Texas…
  const marketOf = new Map<number, string>();
  for (const l of links) if (!marketOf.has(l.cityId)) marketOf.set(l.cityId, countyList.find((c) => c.id === l.countyId)?.market ?? "Other");
  const n = (rows: Count[], id: number) => rows.find((r) => r.cityId === id)?.n ?? 0;

  const all = cityList.map((c) => {
    const pros = n(live, c.id), proUps = n(proSignups, c.id), st = n(verified, c.id), stUps = n(studentSignups, c.id), sr = n(searches, c.id);
    const demand = st + sr;
    const signal = pros < target && demand > 0 ? "Needs pros" : pros > 0 && st === 0 ? "Needs students" : pros === 0 && demand === 0 && proUps + stUps === 0 ? "Not started" : pros === 0 && demand === 0 ? "Signing up" : "Balanced";
    return { c, market: marketOf.get(c.id) ?? "Other", pros, proUps, st, stUps, searches: sr, misses: n(misses, c.id), booked: n(booked, c.id), signal, demand };
  });

  // Markets that have any sign-ups or activity, plus DFW always
  const activeMarkets = sortMarkets([...new Set(["DFW", ...all.filter((r) => r.proUps || r.stUps || r.searches || r.booked).map((r) => r.market)])]);
  const market = sp.market && (sp.market === "all" || activeMarkets.includes(sp.market)) ? sp.market : "all";
  const inView = all.filter((r) => market === "all" || r.market === market);
  const order = (m: string) => activeMarkets.indexOf(m);
  const table = inView.filter((r) => r.proUps || r.stUps || r.searches || r.booked)
    .sort((a, b) => order(a.market) - order(b.market) || b.misses - a.misses || b.demand - a.demand || (b.proUps + b.stUps) - (a.proUps + a.stUps));
  const needPros = inView.filter((r) => r.signal === "Needs pros").sort((a, b) => b.demand - a.demand || a.pros - b.pros)[0];
  const needStudents = inView.filter((r) => r.signal === "Needs students").sort((a, b) => b.pros - a.pros)[0];
  const belowTarget = inView.filter((r) => r.pros < target).length;
  const noPros = inView.filter((r) => r.pros === 0).length;
  const anyDemand = inView.some((r) => r.demand > 0);
  const anyPros = inView.some((r) => r.pros > 0);
  const where = market === "all" ? "all markets" : marketName(market);
  const summary = activeMarkets.map((m) => {
    const rows = all.filter((r) => r.market === m);
    const sum = (k: "pros" | "proUps" | "st" | "stUps" | "searches" | "booked") => rows.reduce((a, r) => a + r[k], 0);
    return { m, cities: rows.filter((r) => r.proUps || r.stUps || r.searches || r.booked).length, proUps: sum("proUps"), pros: sum("pros"), stUps: sum("stUps"), st: sum("st"), searches: sum("searches"), booked: sum("booked") };
  });
  const missesInView = topMisses.filter((m) => market === "all" || (m.cityId !== null && marketOf.get(m.cityId) === market)).slice(0, 10);
  const TAG: Record<string, string> = { "Needs pros": "warn", "Needs students": "warn", Balanced: "ok", "Signing up": "", "Not started": "" };

  return (
    <>
      <AdminHead eyebrow="Where to push next (last 7 days)" title="Marketing" />

      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <Link className={`chip${market === "all" ? " on" : ""}`} href="/admin/marketing">All markets</Link>
        {activeMarkets.map((m) => <Link key={m} className={`chip${market === m ? " on" : ""}`} href={`/admin/marketing?market=${encodeURIComponent(m)}`}>{marketName(m)}</Link>)}
      </div>

      <div className="card" style={{ gap: 10, overflowX: "auto" }}>
        <span className="eyebrow">Markets</span>
        <table className="tbl">
          <thead><tr><th>Market</th><th>Cities with sign-ups</th><th>Pro sign-ups</th><th>Live pros</th><th>Student sign-ups</th><th>Verified students</th><th>Searches</th><th>Bookings</th></tr></thead>
          <tbody>
            {summary.map((r) => (
              <tr key={r.m}>
                <td className="b"><Link href={`/admin/marketing?market=${encodeURIComponent(r.m)}`} style={{ color: "inherit" }}>{marketName(r.m)}</Link></td>
                <td>{r.cities}</td><td>{r.proUps}</td><td>{r.pros}</td><td>{r.stUps}</td><td>{r.st}</td><td>{r.searches}</td><td>{r.booked}</td>
              </tr>
            ))}
            {(unplacedPros.n > 0 || unplacedStudents.n > 0) && (
              <tr><td className="muted">No city yet</td><td>—</td><td>{unplacedPros.n}</td><td>—</td><td>{unplacedStudents.n}</td><td>—</td><td>—</td><td>—</td></tr>
            )}
          </tbody>
        </table>
        {(unplacedPros.n > 0 || unplacedStudents.n > 0) && <span className="xs muted">&ldquo;No city yet&rdquo; = professionals who haven&apos;t reached the Location step and students who haven&apos;t picked a school.</span>}
      </div>

      <div className={`card ${belowTarget ? "warn" : "ok"}`} style={{ gap: 6 }}>
        <span className="eyebrow">Professional coverage — {where}</span>
        <span className="disp h2">{belowTarget} of {inView.length} active cities are below {target} live pros</span>
        <span className="small muted">{noPros} have no live professionals yet.{" "}<Link className="link small" href={`/admin/coverage?short=1${market !== "all" ? `&market=${encodeURIComponent(market)}` : ""}`}>See cities below target</Link></span>
      </div>

      <div className="acols even">
        <div className="card warn" style={{ gap: 8 }}><span className="eyebrow" style={{ color: "#E3C58A" }}>Demand without supply</span>
          {needPros ? <><span className="disp h2">{needPros.c.name}</span><span>{needPros.st} verified students • {needPros.searches} searches • {needPros.pros} live pros</span><span className="small muted">Recruit professionals in {needPros.c.name}.</span></>
            : anyDemand ? <span className="small muted">Every city with student activity has at least {target} live pros.</span>
            : <span className="small muted">No student activity yet in {where}. Once students verify and search, the city with the most demand and too few pros shows here.</span>}</div>
        <div className="card warn" style={{ gap: 8 }}><span className="eyebrow" style={{ color: "#E3C58A" }}>Supply without demand</span>
          {needStudents ? <><span className="disp h2">{needStudents.c.name}</span><span>{needStudents.pros} live pros • {needStudents.st} verified students</span><span className="small muted">Push student sign-ups in {needStudents.c.name}.</span></>
            : anyPros ? <span className="small muted">Every city with live pros has verified students.</span>
            : <span className="small muted">No live professionals yet in {where}, so there&apos;s no supply to match.</span>}</div>
      </div>

      <div className="acols">
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>City</th>{market === "all" && <th>Market</th>}<th>Pro sign-ups</th><th>Live pros</th><th>Student sign-ups</th><th>Verified students</th><th>Searches</th><th>Found nothing</th><th>Bookings</th><th>Signal</th></tr></thead>
            <tbody>
              {table.length === 0 && <tr><td className="empty" colSpan={10}>No sign-ups, searches or bookings in {where} yet.</td></tr>}
              {table.map((r) => (
                <tr key={r.c.id}>
                  <td className="b">{r.c.name}{r.c.state !== "TX" ? `, ${r.c.state}` : ""}</td>{market === "all" && <td className="small">{marketName(r.market)}</td>}
                  <td>{r.proUps}</td><td>{r.pros}</td><td>{r.stUps}</td><td>{r.st}</td><td>{r.searches}</td><td>{r.misses}</td><td>{r.booked}</td>
                  <td><span className={`tag ${TAG[r.signal]}`}>{r.signal}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Searched but found nothing</span>
          {missesInView.length === 0 && <span className="small muted">Nothing yet.</span>}
          {missesInView.map((m, i) => <div key={i} className="row between small"><span>&ldquo;{m.q}&rdquo;{m.city ? ` — ${m.city}` : ""}</span><span>{m.n}</span></div>)}
        </div>
      </div>
    </>
  );
}
