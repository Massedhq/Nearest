import Link from "next/link";
import { asc, eq, ne, sql, and } from "drizzle-orm";
import { db, categories, cities, counties, cityCounties, professionalProfiles, studentProfiles, schools } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { openCityBooking } from "@/app/admin/city-actions";
import { requireAdmin } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { liveProWhere } from "@/lib/search";
import { firstInStats, nextEntryStats } from "@/lib/entry";
import { marketName, sortMarkets } from "@/lib/markets";

export const metadata = { title: "Service coverage" };

/**
 * Recruiting map: for every city, how many professionals Nearest has in each category, against the
 * target (5 per category per city by default — Rules & Settings → Growth). Counts professionals who have
 * joined (paid, or free/managed accounts) and offer at least one active service in that category; "live"
 * is the subset students can book right now.
 */
export default async function ServiceCoverage({ searchParams }: { searchParams: Promise<{ market?: string; city?: string; all?: string }> }) {
  const { role } = await requireAdmin();
  const sp = await searchParams;
  const s = await getSettings();
  const firstInSpots = Number(s["growth.target_per_category"] ?? 5); // First In spots per category, per city
  const target = Math.max(firstInSpots, Number(s["growth.cap_per_category"] ?? 10)); // total spots, then waitlist
  const goal = Number(s["growth.market_goal"] ?? 1500);

  const joined = sql`(${professionalProfiles.entryPaidAt} is not null or ${professionalProfiles.subscriptionStatus} in ('active','trialing','past_due') or exists (select 1 from admin_members a where a.user_id = ${professionalProfiles.userId} and a.role = 'OWNER' and a.active))`;
  const live = sql.join(liveProWhere(null, "all"), sql` and `);

  const next750 = await nextEntryStats();
  const [cats, countyList, cityList, links, counts, prosByCity, students, fi, waitlist] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).where(and(eq(categories.active, true), ne(categories.name, "Other"))).orderBy(asc(categories.sort), asc(categories.name)),
    db.select().from(counties),
    db.select().from(cities).orderBy(asc(cities.name)),
    db.select().from(cityCounties),
    // pros per city × category (a pro with services in 3 categories counts once in each)
    db.execute<{ city_id: number | null; category_id: number; signed: number; live: number }>(sql`
      select x.city_id, x.category_id,
             count(distinct ${professionalProfiles.userId})::int as signed,
             count(distinct ${professionalProfiles.userId}) filter (where ${live})::int as live
      from (
        select ps.user_id, pp.city_id, ps.category_id from pro_services ps join professional_profiles pp on pp.user_id = ps.user_id where ps.active
        union
        select pp.user_id, pp.slot_city_id, pp.slot_category_id from professional_profiles pp where pp.slot_city_id is not null and pp.slot_category_id is not null
      ) x
      join ${professionalProfiles} on ${professionalProfiles.userId} = x.user_id
      where ${joined}
      group by 1, 2`).then((r) => r.rows),
    db.execute<{ city_id: number | null; n: number }>(sql`select ${professionalProfiles.cityId} as city_id, count(*)::int as n from ${professionalProfiles} where ${joined} group by 1`).then((r) => r.rows),
    db.select({ cityId: schools.cityId, n: sql<number>`count(*)::int` }).from(studentProfiles).innerJoin(schools, eq(schools.id, studentProfiles.schoolId)).where(eq(studentProfiles.verificationStatus, "verified")).groupBy(schools.cityId),
    firstInStats(),
    db.execute<{ city_id: number; category_id: number; n: number; first_at: string }>(sql`select city_id, category_id, count(*)::int as n, min(created_at)::text as first_at from pro_waitlist group by 1, 2 order by 3 desc`).then((r) => r.rows),
  ]);

  // Market + its cities
  const markets = sortMarkets(countyList.map((c) => c.market));
  const market = sp.market && markets.includes(sp.market) ? sp.market : markets.includes("DFW") ? "DFW" : markets[0];
  const countyIds = new Set(countyList.filter((c) => c.market === market).map((c) => c.id));
  const marketCityIds = new Set(links.filter((l) => countyIds.has(l.countyId)).map((l) => l.cityId));
  const studentsIn = (id: number) => students.find((x) => x.cityId === id)?.n ?? 0;
  const prosIn = (id: number) => prosByCity.find((x) => x.city_id === id)?.n ?? 0;
  const cell = (cityId: number, catId: number) => counts.find((x) => x.city_id === cityId && x.category_id === catId) ?? { signed: 0, live: 0 };

  // Working set: launched (active) cities plus any city that already has pros or students. "Show every city" lists all.
  const inMarket = cityList.filter((c) => marketCityIds.has(c.id));
  const working = sp.all ? inMarket : inMarket.filter((c) => c.active || prosIn(c.id) > 0 || studentsIn(c.id) > 0);
  working.sort((a, b) => studentsIn(b.id) - studentsIn(a.id) || prosIn(b.id) - prosIn(a.id) || a.name.localeCompare(b.name));
  const marketPros = inMarket.reduce((t, c) => t + prosIn(c.id), 0);
  const seatsTotal = working.length * cats.length * target;
  const seatsFilled = working.reduce((t, c) => t + cats.reduce((u, k) => u + Math.min(target, cell(c.id, k.id).signed), 0), 0);

  const city = sp.city ? working.find((c) => String(c.id) === sp.city) ?? inMarket.find((c) => String(c.id) === sp.city) : null;

  // Who to recruit next: biggest gaps in the cities with the most verified students.
  const priorities = working
    .flatMap((c) => cats.map((k) => ({ city: c, cat: k, have: cell(c.id, k.id).signed, need: Math.max(0, target - cell(c.id, k.id).signed), students: studentsIn(c.id) })))
    .filter((x) => x.need > 0)
    .sort((a, b) => b.students - a.students || b.need - a.need || a.city.name.localeCompare(b.city.name))
    .slice(0, 30);

  const tone = (n: number) => (n >= target ? "ok" : n > 0 ? "warn" : "bad");
  const pct = (a: number, b: number) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);
  const qs = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams(Object.entries({ market: market === "DFW" ? undefined : market, all: sp.all, ...p }).filter(([, v]) => v) as [string, string][]);
    const t = u.toString();
    return t ? `?${t}` : "";
  };

  return (
    <>
      <AdminHead eyebrow="Recruiting" title="Service coverage" />
      <p className="small muted" style={{ maxWidth: 820 }}>
        How many professionals Nearest has in each category, city by city. Each city has <b>{target} spots per category</b>: the first {firstInSpots} are First In ($11), spots {firstInSpots + 1}–{target} pay the next entry rate, and after {target} new professionals join a waitlist (change both numbers in Rules &amp; Settings → Growth).
        Counts include everyone who has joined; <b>live</b> means students can book them right now. A pro who offers services in more than one category counts in each.
      </p>

      <div className="kpis k4">
        <div className="card" style={{ gap: 6 }}><span className="xs muted">First In (paid)</span><span className="stat">{fi.registered} / {fi.capacity}</span><div className="bar"><i style={{ width: `${pct(fi.registered, fi.capacity)}%` }} /></div></div>
        <div className="card" style={{ gap: 6 }}><span className="xs muted">{marketName(market)} professionals</span><span className="stat">{marketPros} / {goal.toLocaleString()}</span><div className="bar"><i style={{ width: `${pct(marketPros, goal)}%` }} /></div></div>
        <div className="card" style={{ gap: 6 }}><span className="xs muted">Category spots filled</span><span className="stat">{seatsFilled.toLocaleString()} / {seatsTotal.toLocaleString()}</span><span className="xs muted">{working.length} cities × {cats.length} categories × {target}</span></div>
        <div className="card" style={{ gap: 6 }}><span className="xs muted">The next {next750.capacity} (DFW, $17)</span><span className="stat">{next750.registered} / {next750.capacity}</span><div className="bar"><i style={{ width: `${next750.capacity ? Math.min(100, Math.round((next750.registered / next750.capacity) * 100)) : 0}%` }} /></div></div>
      </div>

      <form className="card row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        {markets.length > 1 && (
          <div className="field" style={{ minWidth: 160 }}><label htmlFor="sc-m">Market</label>
            <select id="sc-m" name="market" defaultValue={market}>{markets.map((m) => <option key={m} value={m}>{marketName(m)}</option>)}</select>
          </div>
        )}
        <div className="field" style={{ minWidth: 220, flex: 1 }}><label htmlFor="sc-c">City</label>
          <select id="sc-c" name="city" defaultValue={city ? String(city.id) : ""}>
            <option value="">All cities (overview)</option>
            {(sp.all ? inMarket : working).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <label className="check small"><input type="checkbox" name="all" value="1" defaultChecked={Boolean(sp.all)} /> Show every city in the market</label>
        <button className="btn sm" type="submit">Show</button>
      </form>

      {city ? (
        <div className="card" style={{ gap: 12 }}>
          <div className={`card ${city.bookingOpenAt ? "ok" : "warn"}`} style={{ gap: 8 }}>
            {city.bookingOpenAt ? (
              <span className="small"><span className="b">Booking is open in {city.name}</span> since {city.bookingOpenAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" })}. Students can book, and new professionals here pay when they join.</span>
            ) : (
              <>
                <span className="small"><span className="b">Booking isn&apos;t open in {city.name} yet.</span> Professionals here have saved a card but aren&apos;t charged; students can see them but can&apos;t book.</span>
                <span className="xs muted">Opening booking: starts every waiting professional&apos;s membership today on their saved card, moves anyone who already paid to 30 days from today, releases spots for profiles never submitted (no charge), and tells verified students here.</span>
                {role === "OWNER" ? (
                  <ActionForm action={openCityBooking} submitLabel={`Open booking in ${city.name}`} buttonClass="btn sm" className="col g4">
                    <input type="hidden" name="cityId" value={city.id} />
                    <label className="check xs"><input type="checkbox" name="confirm" /><span>I&apos;m ready — start memberships in {city.name} today.</span></label>
                  </ActionForm>
                ) : <span className="xs muted">Only an owner can open booking.</span>}
              </>
            )}
          </div>
          <div className="row between" style={{ flexWrap: "wrap", gap: 8 }}>
            <span className="disp h2">{city.name}</span>
            <span className="small muted">{prosIn(city.id)} professional{prosIn(city.id) === 1 ? "" : "s"} • {studentsIn(city.id)} verified student{studentsIn(city.id) === 1 ? "" : "s"}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Category</th><th>Joined</th><th>Live now</th><th>Still needed</th><th /></tr></thead>
              <tbody>
                {cats.map((k) => {
                  const c = cell(city.id, k.id);
                  const need = Math.max(0, target - c.signed);
                  return (
                    <tr key={k.id}>
                      <td>{k.name}</td>
                      <td className="num">{c.signed} / {target}</td>
                      <td className="num">{c.live}</td>
                      <td className="num b">{need || "—"}</td>
                      <td><span className={`tag ${tone(c.signed)}`}>{c.signed >= target ? "Full — waitlist" : c.signed >= firstInSpots ? "First In taken" : c.signed === 0 ? "None yet" : "First In open"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Link className="link small" href={`/admin/service-coverage${qs({})}`}>← All cities</Link>
        </div>
      ) : (
        <div className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Every city at a glance</span>
          <span className="xs muted">Joined professionals per category. Green = {target}+ • amber = some • red = none. Tap a city for its details.</span>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr><th>City</th><th>Students</th><th>Pros</th>{cats.map((k) => <th key={k.id} style={{ whiteSpace: "nowrap" }}>{k.name}</th>)}</tr>
              </thead>
              <tbody>
                {working.length === 0 && <tr><td className="empty" colSpan={cats.length + 3}>No launched cities with professionals or students yet. Tick &ldquo;Show every city&rdquo; to see them all.</td></tr>}
                {working.map((c) => (
                  <tr key={c.id}>
                    <td><Link className="link" href={`/admin/service-coverage${qs({ city: String(c.id) })}`}>{c.name}</Link>{c.bookingOpenAt ? <span className="tag ok" style={{ marginLeft: 6 }}>Open</span> : null}</td>
                    <td className="num">{studentsIn(c.id)}</td>
                    <td className="num">{prosIn(c.id)}</td>
                    {cats.map((k) => {
                      const n = cell(c.id, k.id).signed;
                      return <td key={k.id} className="num"><span className={`tag ${tone(n)}`}>{n}</span></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Recruit next</span>
        <span className="xs muted">The biggest gaps in the cities with the most verified students.</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>City</th><th>Category</th><th>Have</th><th>Need</th><th>Students there</th></tr></thead>
            <tbody>
              {priorities.length === 0 && <tr><td className="empty" colSpan={5}>Every category is covered in these cities.</td></tr>}
              {priorities.map((x) => (
                <tr key={`${x.city.id}-${x.cat.id}`}>
                  <td><Link className="link" href={`/admin/service-coverage${qs({ city: String(x.city.id) })}`}>{x.city.name}</Link></td>
                  <td>{x.cat.name}</td><td className="num">{x.have}</td><td className="num b">{x.need}</td><td className="num">{x.students}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Waitlist</span>
        <span className="xs muted">Professionals waiting because their city and category is full. Raise the total spots in Rules &amp; Settings, or invite them with a First In invitation (invitations always get in).</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>City</th><th>Category</th><th>Waiting</th><th>Waiting since</th></tr></thead>
            <tbody>
              {waitlist.length === 0 && <tr><td className="empty" colSpan={4}>Nobody is waiting.</td></tr>}
              {waitlist.map((w) => (
                <tr key={`${w.city_id}-${w.category_id}`}>
                  <td>{cityList.find((c) => c.id === w.city_id)?.name ?? "—"}</td>
                  <td>{cats.find((k) => k.id === w.category_id)?.name ?? "—"}</td>
                  <td className="num b">{w.n}</td>
                  <td>{new Date(w.first_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">{marketName(market)} totals by category</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Category</th><th>Joined</th><th>Live now</th><th>Cities covered ({target}+)</th><th>Cities with none</th></tr></thead>
            <tbody>
              {cats.map((k) => {
                const rows = counts.filter((x) => x.category_id === k.id && x.city_id != null && marketCityIds.has(x.city_id));
                const signed = rows.reduce((t, x) => t + x.signed, 0);
                const liveN = rows.reduce((t, x) => t + x.live, 0);
                const covered = working.filter((c) => cell(c.id, k.id).signed >= target).length;
                const none = working.filter((c) => cell(c.id, k.id).signed === 0).length;
                return <tr key={k.id}><td>{k.name}</td><td className="num">{signed}</td><td className="num">{liveN}</td><td className="num">{covered} / {working.length}</td><td className="num">{none}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
