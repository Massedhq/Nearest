import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db, cities, counties, cityCounties, professionalProfiles, studentProfiles, schools } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { liveProWhere } from "@/lib/search";
import { addCity, toggleCity } from "@/app/admin/coverage-actions";

export const metadata = { title: "DFW Coverage" };

export default async function Coverage({ searchParams }: { searchParams: Promise<{ county?: string; short?: string }> }) {
  await requireAdmin();
  const { county, short } = await searchParams;
  const s = await getSettings();
  const target = Number(s["growth.target_per_city"]);
  const [countyList, cityList, links, live, allPros, students] = await Promise.all([
    db.select().from(counties).orderBy(asc(counties.name)),
    db.select().from(cities).orderBy(asc(cities.name)),
    db.select().from(cityCounties),
    db.select({ cityId: professionalProfiles.cityId, n: sql<number>`count(*)::int` }).from(professionalProfiles).where(sql`${sql.join(liveProWhere(null, "all"), sql` and `)}`).groupBy(professionalProfiles.cityId),
    db.select({ cityId: professionalProfiles.cityId, n: sql<number>`count(*)::int` }).from(professionalProfiles).groupBy(professionalProfiles.cityId),
    db.select({ cityId: schools.cityId, n: sql<number>`count(*)::int` }).from(studentProfiles).innerJoin(schools, eq(schools.id, studentProfiles.schoolId)).where(eq(studentProfiles.verificationStatus, "verified")).groupBy(schools.cityId),
  ]);
  const n = (rows: { cityId: number | null; n: number }[], id: number) => rows.find((r) => r.cityId === id)?.n ?? 0;
  const countyId = county ? Number(county) : null;
  let rows = cityList.filter((c) => !countyId || links.some((l) => l.cityId === c.id && l.countyId === countyId));
  if (short) rows = rows.filter((c) => n(live, c.id) < target);
  const active = cityList.filter((c) => c.active);
  const withPro = active.filter((c) => n(live, c.id) > 0).length;
  const met = active.filter((c) => n(live, c.id) >= target).length;
  const qs = (o: Record<string, string | undefined>) => { const p = new URLSearchParams(Object.entries({ county, short, ...o }).filter(([, v]) => v) as [string, string][]).toString(); return p ? `?${p}` : ""; };

  return (
    <>
      <AdminHead eyebrow={`${countyList.length} counties • target ${target} live professionals per city`} title="DFW Coverage" />
      <div className="kpis k4">
        <div className="card" style={{ gap: 6 }}><span className="xs muted">Active cities</span><span className="stat">{active.length}</span></div>
        <div className="card" style={{ gap: 6 }}><span className="xs muted">Cities with a live pro</span><span className="stat">{withPro}</span></div>
        <div className="card" style={{ gap: 6 }}><span className="xs muted">Cities at {target} / {target}</span><span className="stat">{met}</span></div>
        <div className="card" style={{ gap: 6 }}><span className="xs muted">Cities with zero</span><span className="stat">{active.length - withPro}</span></div>
      </div>
      <div className="acols" style={{ gridTemplateColumns: "240px minmax(0,1fr)" }}>
        <div className="card" style={{ gap: 2 }}>
          <span className="eyebrow" style={{ paddingBottom: 6 }}>Counties</span>
          <Link className={`nav${!countyId ? " on" : ""}`} href={`/admin/coverage${qs({ county: undefined })}`}>All counties</Link>
          {countyList.map((c) => <Link key={c.id} className={`nav${countyId === c.id ? " on" : ""}`} href={`/admin/coverage${qs({ county: String(c.id) })}`}>{c.name}</Link>)}
        </div>
        <div className="card" style={{ gap: 12, overflowX: "auto" }}>
          <div className="row between"><span className="eyebrow">Cities</span>
            <div className="row"><Link className={`chip${!short ? " on" : ""}`} href={`/admin/coverage${qs({ short: undefined })}`}>All</Link><Link className={`chip${short ? " on" : ""}`} href={`/admin/coverage${qs({ short: "1" })}`}>Below target</Link></div></div>
          <table className="tbl">
            <thead><tr><th>City</th><th>Code</th><th>County</th><th>Live pros</th><th>Target</th><th>All pros</th><th>Verified students</th><th>Active</th></tr></thead>
            <tbody>
              {rows.map((c) => {
                const l = n(live, c.id);
                return (
                  <tr key={c.id} style={{ opacity: c.active ? 1 : 0.5 }}>
                    <td className="b">{c.name}</td><td className="num">{c.abbreviation}</td>
                    <td className="small">{links.filter((x) => x.cityId === c.id).map((x) => countyList.find((k) => k.id === x.countyId)?.name).join(", ")}</td>
                    <td>{l} / {target}</td>
                    <td><span className={`tag ${l >= target ? "ok" : l > 0 ? "warn" : "bad"}`}>{l >= target ? "Met" : l > 0 ? `Short ${target - l}` : "No pros"}</span></td>
                    <td>{n(allPros, c.id)}</td><td>{n(students, c.id)}</td>
                    <td><form action={toggleCity}><input type="hidden" name="id" value={c.id} /><button className={`toggle${c.active ? " on" : ""}`} type="submit" aria-pressed={c.active} aria-label={`${c.name} active`} /></form></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 560 }}>
        <span className="eyebrow">+ Add city</span>
        <ActionForm action={addCity} submitLabel="Add city" buttonClass="btn sm">
          <div className="field"><label htmlFor="cname">City name</label><input id="cname" name="name" required /></div>
          <span className="lbl">County (pick all that apply)</span>
          <div className="chips">{countyList.map((c) => <label key={c.id} className="chip chipradio"><input type="checkbox" name="countyId" value={c.id} />{c.name}</label>)}</div>
        </ActionForm>
      </div>
    </>
  );
}
