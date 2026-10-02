import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db, cities, counties, cityCounties, professionalProfiles, studentProfiles, schools } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { PlaceFields } from "@/components/PlaceFields";
import { requireAdmin } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { liveProWhere } from "@/lib/search";
import { marketName, sortMarkets } from "@/lib/markets";
import { toggleCity } from "@/app/admin/coverage-actions";
import { addPlace, setCountyMarket } from "@/app/admin/place-actions";

export const metadata = { title: "Coverage" };

export default async function Coverage({ searchParams }: { searchParams: Promise<{ market?: string; county?: string; short?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const s = await getSettings();
  const target = Number(s["growth.target_per_city"]);
  const [countyList, cityList, links, live, allPros, students] = await Promise.all([
    db.select().from(counties).orderBy(asc(counties.state), asc(counties.name)),
    db.select().from(cities).orderBy(asc(cities.name)),
    db.select().from(cityCounties),
    db.select({ cityId: professionalProfiles.cityId, n: sql<number>`count(*)::int` }).from(professionalProfiles).where(sql`${sql.join(liveProWhere(null, "all"), sql` and `)}`).groupBy(professionalProfiles.cityId),
    db.select({ cityId: professionalProfiles.cityId, n: sql<number>`count(*)::int` }).from(professionalProfiles).groupBy(professionalProfiles.cityId),
    db.select({ cityId: schools.cityId, n: sql<number>`count(*)::int` }).from(studentProfiles).innerJoin(schools, eq(schools.id, studentProfiles.schoolId)).where(eq(studentProfiles.verificationStatus, "verified")).groupBy(schools.cityId),
  ]);
  const n = (rows: { cityId: number | null; n: number }[], id: number) => rows.find((r) => r.cityId === id)?.n ?? 0;
  const markets = sortMarkets(countyList.map((c) => c.market));
  const market = sp.market && markets.includes(sp.market) ? sp.market : markets.includes("DFW") ? "DFW" : markets[0];
  const inMarket = countyList.filter((c) => c.market === market);
  const cityIdsIn = (countyIds: number[]) => new Set(links.filter((l) => countyIds.includes(l.countyId)).map((l) => l.cityId));
  const marketCities = cityIdsIn(inMarket.map((c) => c.id));
  const countiesWithCities = inMarket.filter((c) => links.some((l) => l.countyId === c.id));
  const countyId = sp.county ? Number(sp.county) : null;
  let rows = cityList.filter((c) => (countyId ? cityIdsIn([countyId]) : marketCities).has(c.id));
  if (sp.short) rows = rows.filter((c) => n(live, c.id) < target);
  const active = cityList.filter((c) => c.active && marketCities.has(c.id));
  const withPro = active.filter((c) => n(live, c.id) > 0).length;
  const met = active.filter((c) => n(live, c.id) >= target).length;
  const qs = (o: Record<string, string | undefined>) => { const p = new URLSearchParams(Object.entries({ market, county: sp.county, short: sp.short, ...o }).filter(([, v]) => v) as [string, string][]).toString(); return p ? `?${p}` : ""; };
  const countyName = (id: number) => { const c = countyList.find((k) => k.id === id); return c ? `${c.name}${c.state !== "TX" ? `, ${c.state}` : ""}` : ""; };

  return (
    <>
      <AdminHead eyebrow={`${markets.length} markets • target ${target} live professionals per city`} title="Coverage" />
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {markets.map((m) => <Link key={m} className={`chip${m === market ? " on" : ""}`} href={`/admin/coverage?market=${encodeURIComponent(m)}`}>{marketName(m)}</Link>)}
      </div>
      <div className="kpis k4">
        <div className="card" style={{ gap: 6 }}><span className="xs muted">Active cities — {marketName(market)}</span><span className="stat">{active.length}</span></div>
        <div className="card" style={{ gap: 6 }}><span className="xs muted">Cities with a live pro</span><span className="stat">{withPro}</span></div>
        <div className="card" style={{ gap: 6 }}><span className="xs muted">Cities at {target} / {target}</span><span className="stat">{met}</span></div>
        <div className="card" style={{ gap: 6 }}><span className="xs muted">Counties in this market</span><span className="stat">{inMarket.length}</span></div>
      </div>
      <div className="acols narrowleft">
        <div className="card" style={{ gap: 2, maxHeight: 560, overflowY: "auto" }}>
          <span className="eyebrow" style={{ paddingBottom: 6 }}>Counties with cities</span>
          <Link className={`nav${!countyId ? " on" : ""}`} href={`/admin/coverage${qs({ county: undefined })}`}>All of {marketName(market)}</Link>
          {countiesWithCities.map((c) => <Link key={c.id} className={`nav${countyId === c.id ? " on" : ""}`} href={`/admin/coverage${qs({ county: String(c.id) })}`}>{countyName(c.id)}</Link>)}
          {countiesWithCities.length === 0 && <span className="xs muted" style={{ padding: 8 }}>No cities added in this market yet. Use Add city below.</span>}
        </div>
        <div className="card" style={{ gap: 12, overflowX: "auto" }}>
          <div className="row between"><span className="eyebrow">Cities</span>
            <div className="row"><Link className={`chip${!sp.short ? " on" : ""}`} href={`/admin/coverage${qs({ short: undefined })}`}>All</Link><Link className={`chip${sp.short ? " on" : ""}`} href={`/admin/coverage${qs({ short: "1" })}`}>Below target</Link></div></div>
          <table className="tbl">
            <thead><tr><th>City</th><th>Code</th><th>County</th><th>Live pros</th><th>Target</th><th>All pros</th><th>Verified students</th><th>Active</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td className="empty" colSpan={8}>No cities here yet.</td></tr>}
              {rows.map((c) => {
                const l = n(live, c.id);
                return (
                  <tr key={c.id} style={{ opacity: c.active ? 1 : 0.5 }}>
                    <td className="b">{c.name}{c.state !== "TX" ? `, ${c.state}` : ""}</td><td className="num">{c.abbreviation}</td>
                    <td className="small">{links.filter((x) => x.cityId === c.id).map((x) => countyName(x.countyId)).join(", ")}</td>
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
      <div className="acols even">
        <div className="card">
          <span className="eyebrow">+ Add city</span>
          <span className="small muted">Pick the state and enter a ZIP — we fill in the city and county. New counties are added automatically.</span>
          <ActionForm action={addPlace} submitLabel="Add city" buttonClass="btn sm"><PlaceFields id="cov" /></ActionForm>
        </div>
        <div className="card">
          <span className="eyebrow">Move a county to a market</span>
          <span className="small muted">Every county belongs to one market. Type an existing market or a new one (for example &ldquo;Killeen–Temple&rdquo; or &ldquo;Oklahoma City&rdquo;).</span>
          <form action={setCountyMarket} className="col" style={{ gap: 10 }}>
            <div className="field"><label htmlFor="mv_county">County</label>
              <select id="mv_county" name="countyId" required defaultValue="">
                <option value="" disabled>Choose a county</option>
                {sortMarkets(countyList.map((c) => c.state)).map((st) => (
                  <optgroup key={st} label={st}>{countyList.filter((c) => c.state === st).map((c) => <option key={c.id} value={c.id}>{c.name} — now {marketName(c.market)}</option>)}</optgroup>
                ))}
              </select>
            </div>
            <div className="field"><label htmlFor="mv_market">Market</label><input id="mv_market" name="market" list="markets" required placeholder="e.g. Austin" /></div>
            <datalist id="markets">{markets.map((m) => <option key={m} value={m} />)}</datalist>
            <button className="btn ghost sm" type="submit">Move county</button>
          </form>
        </div>
      </div>
    </>
  );
}
