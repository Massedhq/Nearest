import Link from "next/link";
import { AdminHead } from "@/components/AdminHead";
import { requireAdmin } from "@/lib/admin";
import { BANDS, MIN_FUNNEL, MIN_SAMPLE, filterOptions, money, pricingIntel, type Filters, type Stats } from "@/lib/pricing-intel";

export const metadata = { title: "Student Pricing Intelligence" };
export const dynamic = "force-dynamic";

type SP = { from?: string; to?: string; state?: string; city?: string; category?: string; pro?: string; live?: string };

const ISD = <span className="muted">Insufficient data</span>;
const pc = (v: number | null) => (v == null ? "—" : `${v}%`);

function StatCells({ s, n }: { s: Stats; n?: number }) {
  if (!s) return <><td className="num">{n ?? 0}</td><td colSpan={4}>{ISD}{n ? <span className="xs muted"> (needs {MIN_SAMPLE}+)</span> : null}</td></>;
  return <><td className="num">{s.n}</td><td className="num">{money(s.avg)}</td><td className="num">{money(s.median)}</td><td className="num">{money(s.min)}</td><td className="num">{money(s.max)}</td></>;
}
const StatHead = ({ first }: { first: string }) => <thead><tr><th>{first}</th><th>Count</th><th>Average</th><th>Median</th><th>Min</th><th>Max</th></tr></thead>;

function Section({ n, title, note, children }: { n: number; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ gap: 12, overflowX: "auto" }} aria-labelledby={`s${n}`}>
      <h2 id={`s${n}`} className="b" style={{ fontSize: 17, margin: 0 }}>{n}. {title}</h2>
      {note && <span className="xs muted">{note}</span>}
      {children}
    </section>
  );
}

function GroupTable({ first, groups }: { first: string; groups: { key: string; label: string; count: number; stats: Stats }[] }) {
  if (!groups.length) return <span className="small">{ISD}</span>;
  return <table className="tbl"><StatHead first={first} /><tbody>{groups.map((g) => <tr key={g.key}><td>{g.label}</td><StatCells s={g.stats} n={g.count} /></tr>)}</tbody></table>;
}

export default async function Pricing({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const f: Filters = { from: sp.from || undefined, to: sp.to || undefined, state: sp.state || undefined, cityId: sp.city ? Number(sp.city) : undefined, categoryId: sp.category ? Number(sp.category) : undefined, proId: sp.pro || undefined, liveOnly: sp.live === "1" };
  const [d, opt] = await Promise.all([pricingIntel(f), filterOptions()]);
  const maxH = Math.max(1, ...d.histogram.map((h) => h.n));
  const field = { height: 40, borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px", font: "500 13px var(--font-body),system-ui,sans-serif" } as const;

  return (
    <>
      <AdminHead eyebrow="Internal only — read-only analysis of real records" title="Student Pricing Intelligence" />
      <span className="small muted">
        Describes listed prices and what students actually book. It changes nothing: no prices, rules, rankings or public scores. The $150 limit is not affected.
        Listed prices are what students see (the professional&apos;s price plus Nearest&apos;s booking fee when added). Model Calls and free launch-campaign rewards are left out of price analysis
        ({d.totals.excludedModelCalls} Model Call and {d.totals.excludedCampaign} campaign bookings in range). A higher price is not treated as unaffordable.
      </span>

      <form className="card" method="get" style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }} aria-label="Filters">
        <label className="xs muted col g4">Booked from<input type="date" name="from" defaultValue={sp.from} style={field} /></label>
        <label className="xs muted col g4">to<input type="date" name="to" defaultValue={sp.to} style={field} /></label>
        <label className="xs muted col g4">State<select name="state" defaultValue={sp.state ?? ""} style={field}><option value="">All</option>{opt.states.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label className="xs muted col g4">City<select name="city" defaultValue={sp.city ?? ""} style={field}><option value="">All</option>{opt.cities.map((c) => <option key={c.id} value={c.id}>{c.name}, {c.state}</option>)}</select></label>
        <label className="xs muted col g4">Category<select name="category" defaultValue={sp.category ?? ""} style={field}><option value="">All</option>{opt.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="xs muted col g4">Professional<select name="pro" defaultValue={sp.pro ?? ""} style={field}><option value="">All</option>{opt.pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="xs muted row" style={{ gap: 6, height: 40 }}><input type="checkbox" name="live" value="1" defaultChecked={sp.live === "1"} />Live professionals only</label>
        <button className="btn sm" type="submit" style={{ width: "auto" }}>Apply</button>
        <Link className="btn ghost sm" href="/admin/pricing" style={{ width: "auto" }}>Reset</Link>
        <span className="xs muted" style={{ flexBasis: "100%" }}>The date range applies to bookings (by request date) and the price-change log. Listed prices are always the current menu.</span>
      </form>

      <div className="kpis">
        <div className="card"><span className="lbl">Listed services</span><span className="stat">{d.totals.services}</span><span className="xs muted">{d.totals.pros} professionals</span></div>
        <div className="card"><span className="lbl">Median listed</span><span className="stat">{d.listed.all ? money(d.listed.all.median) : "—"}</span><span className="xs muted">student price</span></div>
        <div className="card"><span className="lbl">Booking requests</span><span className="stat">{d.totals.bookings}</span><span className="xs muted">in range</span></div>
        <div className="card"><span className="lbl">Completed</span><span className="stat">{d.totals.completed}</span><span className="xs muted">{pc(d.funnelAll.completeRate)} of requests</span></div>
        <div className="card"><span className="lbl">Median completed spend</span><span className="stat">{d.spend.total ? money(d.spend.total.median) : "—"}</span><span className="xs muted">per booking</span></div>
      </div>

      <Section n={10} title="Automated insights" note="Rule-based summaries of the numbers below. Descriptive only — they don't change anything.">
        <ul className="small" style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          {d.insights.map((i, k) => <li key={k}>{i.tone === "watch" ? <span className="b">Watch: </span> : null}{i.text}</li>)}
        </ul>
      </Section>

      <Section n={1} title="Price distribution — all listed services" note="Each bar is a $10 range of the student price. Hover a bar for its count.">
        {d.totals.services === 0 ? <span className="small">{ISD}</span> : (
          <div role="img" aria-label={`Histogram of ${d.totals.services} listed prices`} style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 140, paddingTop: 8 }}>
            {d.histogram.map((h) => (
              <div key={h.from} title={`${h.from === 15000 ? "$150" : `${money(h.from)}–${money(h.from + 999)}`}: ${h.n} service${h.n === 1 ? "" : "s"}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                <span className="xs muted num">{h.n || ""}</span>
                <div style={{ width: "100%", height: `${(h.n / maxH) * 100}%`, minHeight: h.n ? 3 : 0, background: "#ECE8E1", borderRadius: "4px 4px 0 0" }} />
                <span className="xs muted num" style={{ fontSize: 10 }}>{h.from === 15000 ? "150" : h.from / 100}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section n={3} title="Price bands — counts and percentages" note="Listed = current menu. Completed = the service price students actually booked (booking fee included; add-ons and travel excluded).">
        <table className="tbl">
          <thead><tr><th>Band</th><th>Listed services</th><th>% of listed</th><th>Completed bookings</th><th>% of completed</th></tr></thead>
          <tbody>{d.listedBands.map((b) => { const c = d.completedBands.find((x) => x.key === b.key); return <tr key={b.key}><td>{b.label}</td><td className="num">{b.n}</td><td className="num">{pc(b.pct)}</td><td className="num">{c?.n ?? 0}</td><td className="num">{pc(c?.pct ?? null)}</td></tr>; })}</tbody>
        </table>
      </Section>

      <Section n={2} title="Average, median, minimum and maximum" note={`Groups with fewer than ${MIN_SAMPLE} records show "Insufficient data". Listed and completed prices are kept separate.`}>
        <table className="tbl"><StatHead first="All" /><tbody>
          <tr><td>Listed — student price</td><StatCells s={d.listed.all} n={d.totals.services} /></tr>
          <tr><td>Listed — professional&apos;s own price</td><StatCells s={d.listed.proAll} /></tr>
          <tr><td>Completed — booked service price</td><StatCells s={d.completedPrices.all} n={d.totals.completed} /></tr>
        </tbody></table>
        <div className="acols even">
          <div className="col g4"><span className="lbl">Listed by category</span><GroupTable first="Category" groups={d.listed.byCategory} /></div>
          <div className="col g4"><span className="lbl">Completed by category</span><GroupTable first="Category" groups={d.completedPrices.byCategory} /></div>
          <div className="col g4"><span className="lbl">Listed by city</span><GroupTable first="City" groups={d.listed.byCity} /></div>
          <div className="col g4"><span className="lbl">Completed by city</span><GroupTable first="City" groups={d.completedPrices.byCity} /></div>
          <div className="col g4"><span className="lbl">Listed by state</span><GroupTable first="State" groups={d.listed.byState} /></div>
          <div className="col g4"><span className="lbl">Completed by state</span><GroupTable first="State" groups={d.completedPrices.byState} /></div>
        </div>
      </Section>

      <Section n={4} title="Individual vs bundled (Bundle Me)" note={`Like-for-like comparison uses the same professional's same service booked both ways; it needs at least 3 such services.`}>
        <table className="tbl">
          <thead><tr><th></th><th>Requests</th><th>Accepted</th><th>Completed</th><th>Completion rate</th><th>Median booked price</th><th>Median spend</th></tr></thead>
          <tbody>{(["individual", "bundled"] as const).map((k) => { const s = d.bundles[k]; return (
            <tr key={k}><td>{k === "individual" ? "Individual" : "Bundled"}</td><td className="num">{s.funnel.requests}</td><td className="num">{s.funnel.accepted}</td><td className="num">{s.funnel.completed}</td>
              <td className="num">{s.funnel.completeRate == null ? ISD : `${s.funnel.completeRate}%`}</td><td className="num">{s.price ? money(s.price.median) : ISD}</td><td className="num">{s.spend ? money(s.spend.median) : ISD}</td></tr>); })}</tbody>
        </table>
        <span className="small">{d.bundles.matchedAvgDiffCents == null ? <>Like-for-like: {ISD} ({d.bundles.matchedServices} matched service{d.bundles.matchedServices === 1 ? "" : "s"}).</> : <>Like-for-like across {d.bundles.matchedServices} services: bundled averaged {money(Math.abs(d.bundles.matchedAvgDiffCents))} {d.bundles.matchedAvgDiffCents < 0 ? "less" : "more"} than individual.</>}</span>
      </Section>

      <Section n={5} title="Requests, accepted and completed by price range" note={`Views are not tracked by the platform, so they aren't shown. Rates need ${MIN_FUNNEL}+ requests. Accepted includes direct bookings; a declined request isn't accepted.`}>
        <table className="tbl">
          <thead><tr><th>Booked service price</th><th>Requests</th><th>Accepted</th><th>Paid</th><th>Completed</th><th>Accept rate</th><th>Completion rate</th></tr></thead>
          <tbody>
            {d.funnelByBand.map((b) => <tr key={b.key}><td>{b.label}</td><td className="num">{b.requests}</td><td className="num">{b.accepted}</td><td className="num">{b.paid}</td><td className="num">{b.completed}</td><td className="num">{b.acceptRate == null ? ISD : `${b.acceptRate}%`}</td><td className="num">{b.completeRate == null ? ISD : `${b.completeRate}%`}</td></tr>)}
            <tr><td className="b">All</td><td className="num b">{d.funnelAll.requests}</td><td className="num b">{d.funnelAll.accepted}</td><td className="num b">{d.funnelAll.paid}</td><td className="num b">{d.funnelAll.completed}</td><td className="num b">{pc(d.funnelAll.acceptRate)}</td><td className="num b">{pc(d.funnelAll.completeRate)}</td></tr>
          </tbody>
        </table>
      </Section>

      <Section n={6} title="Student spend per completed booking" note="Spend = what the student paid for the booking (card or Nearest credit), after any invite discount. The service portion is the professional's price, separated from Nearest's booking fee.">
        <table className="tbl"><StatHead first="Component" /><tbody>
          <tr><td className="b">Total spend</td><StatCells s={d.spend.total} n={d.totals.completed} /></tr>
          <tr><td>Service (professional&apos;s price)</td><StatCells s={d.spend.service} n={d.totals.completed} /></tr>
          <tr><td>Nearest booking fee</td><StatCells s={d.spend.fee} /></tr>
          <tr><td>Add-ons</td><StatCells s={d.spend.addons} /></tr>
          <tr><td>Travel fee</td><StatCells s={d.spend.travel} /></tr>
          <tr><td>Invite discount</td><StatCells s={d.spend.discount} /></tr>
        </tbody></table>
        <span className="small">Bookings with an add-on: {pc(d.spend.addonAttach)} · with a travel fee: {pc(d.spend.travelShare)}</span>
      </Section>

      <Section n={7} title="What produces completed bookings">
        <div className="acols even">
          <div className="col g4"><span className="lbl">By category</span>
            {d.leaders.categories.length ? <table className="tbl"><thead><tr><th>Category</th><th>Completed</th><th>%</th></tr></thead><tbody>{d.leaders.categories.map((c) => <tr key={c.key}><td>{c.label}</td><td className="num">{c.count}</td><td className="num">{pc(c.pct)}</td></tr>)}</tbody></table> : ISD}
          </div>
          <div className="col g4"><span className="lbl">Top category × price range</span>
            {d.leaders.cells.length ? <table className="tbl"><thead><tr><th>Category</th><th>Price range</th><th>Completed</th><th>%</th></tr></thead><tbody>{d.leaders.cells.map((c, i) => <tr key={i}><td>{c.category}</td><td>{c.band}</td><td className="num">{c.n}</td><td className="num">{pc(c.pct)}</td></tr>)}</tbody></table> : ISD}
          </div>
        </div>
      </Section>

      <Section n={8} title="Price changes over time" note="Booked prices come from booking snapshots (real history). Listed-price edits are recorded from this release on — earlier edits weren't logged.">
        <div className="acols even">
          <div className="col g4"><span className="lbl">Median booked service price by month</span>
            {d.byMonth.filter((m) => m.stats).length >= 2 ? <table className="tbl"><StatHead first="Month" /><tbody>{d.byMonth.map((m) => <tr key={m.month}><td>{m.month}</td><StatCells s={m.stats} n={m.n} /></tr>)}</tbody></table> : <span className="small">{ISD} — needs two months with {MIN_SAMPLE}+ completed bookings.</span>}
          </div>
          <div className="col g4"><span className="lbl">Listed price changes ({d.history.length})</span>
            {d.history.length ? <table className="tbl"><thead><tr><th>When</th><th>Service</th><th>From</th><th>To</th></tr></thead><tbody>{d.history.slice(0, 25).map((h, i) => <tr key={i}><td className="xs">{h.at.toISOString().slice(0, 10)}</td><td>{h.name}</td><td className="num">{h.from == null ? "—" : money(h.from)}</td><td className="num">{h.to == null ? "—" : money(h.to)}</td></tr>)}</tbody></table> : <span className="small">{ISD} — no price edits recorded yet.</span>}
          </div>
        </div>
      </Section>

      <Section n={9} title="City and state comparisons" note={`Shown only where at least two cities or states each have ${MIN_SAMPLE}+ records.`}>
        {d.cityCompare ? <div className="col g4"><span className="lbl">Cities</span><GroupTable first="City (completed)" groups={d.completedPrices.byCity.filter((g) => g.stats)} /><GroupTable first="City (listed)" groups={d.listed.byCity.filter((g) => g.stats)} /></div> : <span className="small">Cities: {ISD}</span>}
        {d.stateCompare ? <div className="col g4"><span className="lbl">States</span><GroupTable first="State (completed)" groups={d.completedPrices.byState.filter((g) => g.stats)} /><GroupTable first="State (listed)" groups={d.listed.byState.filter((g) => g.stats)} /></div> : <span className="small">States: {ISD}</span>}
      </Section>

      <span className="xs muted">Bands: {BANDS.filter((b) => b.key !== "gt150").map((b) => b.label).join(" · ")}. Category for older bookings is matched to the professional&apos;s current service by name when the original service row was replaced.</span>
    </>
  );
}
