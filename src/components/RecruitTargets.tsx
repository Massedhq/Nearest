import Link from "next/link";
import type { CityTarget, CountedPro, UncountedPro } from "@/lib/recruit-targets";

type Data = { cap: number; cats: { id: number; name: string }[]; cities: CityTarget[]; counties: string[] };
type People = { counted: Record<number, CountedPro[]>; uncounted: Record<number, UncountedPro[]>; noCity: UncountedPro[] };
type Params = { county?: string; cat?: string; show?: string; q?: string; sort?: string };

const stat = { flex: "1 1 140px", minWidth: 0, gap: 2 } as const;
const CSS = `
.rt-head,.rt-row{display:grid;grid-template-columns:minmax(120px,1.4fr) minmax(100px,1fr) minmax(140px,1.4fr) 90px 160px;gap:10px;align-items:center;padding:10px}
.rt-row{cursor:pointer;list-style:none}
.rt-row::-webkit-details-marker{display:none}
.rt-open-l{display:none}
@media (max-width:700px){
  .rt-head{display:none}
  .rt-row{grid-template-columns:1fr auto;grid-template-areas:"city status" "county open" "prog prog";row-gap:6px}
  .rt-city{grid-area:city}.rt-status{grid-area:status;justify-self:end}.rt-county{grid-area:county}.rt-open{grid-area:open;justify-self:end}.rt-prog{grid-area:prog}
  .rt-open-l{display:inline}
}`;

/**
 * "Where to recruit" dashboard for DFW: totals, every category, and every city with what it still needs.
 * Filled cities drop to a closed list so nobody keeps working them. No prospect or recruiting data is shown.
 */
export function RecruitTargets({ data, sp, basePath, people }: { data: Data; sp: Params; basePath: string; people?: People }) {
  const catId = Number(sp.cat) || null;
  const cat = data.cats.find((c) => c.id === catId) ?? null;
  const show = sp.show === "filled" || sp.show === "all" ? sp.show : "open";
  const q = (sp.q ?? "").trim().toLowerCase();
  // Everyone sees who's already on Nearest so nobody recruits them twice; only admins get a link to the account.
  const admin = basePath.startsWith("/admin");
  const who = (p: { userId: string; name: string; business: string | null }) => (
    <>{admin ? <Link className="link" href={`/admin/professionals/${p.userId}`}>{p.name}</Link> : <span className="b">{p.name}</span>}{p.business ? ` (${p.business})` : ""}</>
  );
  const isFilled = (c: CityTarget) => (cat ? c.cats.find((x) => x.id === cat.id)!.open === 0 : c.status === "filled");
  const openOf = (c: CityTarget) => (cat ? c.cats.find((x) => x.id === cat.id)!.open : c.openSpots);
  const inScope = data.cities.filter((c) => (!sp.county || c.counties.includes(sp.county)) && (!q || c.name.toLowerCase().includes(q)));
  const sorted = [...inScope].sort((a, b) =>
    sp.sort === "name" ? a.name.localeCompare(b.name)
    : sp.sort === "county" ? a.counties[0].localeCompare(b.counties[0]) || a.name.localeCompare(b.name)
    : sp.sort === "closest" ? openOf(a) - openOf(b) || a.name.localeCompare(b.name)
    : openOf(b) - openOf(a) || a.name.localeCompare(b.name));
  const open = sorted.filter((c) => !isFilled(c));
  const filled = sorted.filter(isFilled);
  const rows = show === "filled" ? filled : show === "all" ? sorted : open;
  const totalOpen = inScope.reduce((t, c) => t + openOf(c), 0);
  const href = (patch: Params) => { const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]); const s = p.toString(); return s ? `${basePath}?${s}` : basePath; };
  const bar = (part: number, whole: number) => (
    <div style={{ height: 6, borderRadius: 3, background: "#1F1F22", overflow: "hidden" }} aria-hidden="true"><div style={{ width: `${whole ? Math.round((part / whole) * 100) : 0}%`, height: "100%", background: part >= whole ? "#5FB58A" : "#E3C58A" }} /></div>
  );

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <div className="card" style={stat}><span className="xs muted">DFW cities{sp.county ? ` in ${sp.county} County` : ""}</span><span className="disp h2" style={{ margin: 0 }}>{inScope.length}</span></div>
        <div className="card" style={stat}><span className="xs muted">Still need professionals{cat ? ` (${cat.name})` : ""}</span><span className="disp h2" style={{ margin: 0 }}>{open.length}</span></div>
        <div className="card" style={stat}><span className="xs muted">Filled — closed</span><span className="disp h2" style={{ margin: 0 }}>{filled.length}</span></div>
        <div className="card" style={stat}><span className="xs muted">Open spots{cat ? ` (${cat.name})` : ""}</span><span className="disp h2" style={{ margin: 0 }}>{totalOpen.toLocaleString()}</span></div>
      </div>

      <form className="card" method="get" action={basePath} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, alignItems: "end" }}>
        <div className="field"><label htmlFor="rt-county">County</label><select id="rt-county" name="county" defaultValue={sp.county ?? ""}><option value="">All DFW counties</option>{data.counties.map((c) => <option key={c} value={c}>{c} County</option>)}</select></div>
        <div className="field"><label htmlFor="rt-cat">Service category</label><select id="rt-cat" name="cat" defaultValue={cat ? String(cat.id) : ""}><option value="">All categories</option>{data.cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="field"><label htmlFor="rt-show">Show</label><select id="rt-show" name="show" defaultValue={show}><option value="open">Cities that still need professionals</option><option value="filled">Filled cities (closed)</option><option value="all">All cities</option></select></div>
        <div className="field"><label htmlFor="rt-sort">Sort</label><select id="rt-sort" name="sort" defaultValue={sp.sort ?? ""}><option value="">Most open spots first</option><option value="closest">Closest to filled first</option><option value="name">City A–Z</option><option value="county">County, then city</option></select></div>
        <div className="field"><label htmlFor="rt-q">Find a city</label><input id="rt-q" name="q" defaultValue={sp.q ?? ""} placeholder="City name" /></div>
        <button className="btn sm" type="submit">Apply</button>
      </form>

      {people && people.noCity.length > 0 && (
        <details className="card warn small" style={{ gap: 6 }}>
          <summary style={{ cursor: "pointer" }}><span className="b">{people.noCity.length} professional{people.noCity.length === 1 ? " isn't" : "s aren't"} counted in any city yet</span> — they haven&apos;t chosen their city. Tap to see who.</summary>
          <div className="col" style={{ gap: 4, marginTop: 6 }}>
            {people.noCity.map((p) => <span key={p.userId}>{who(p)}{p.cats.length ? ` — signing up for ${p.cats.join(", ")}` : ""} — {p.reason}</span>)}
          </div>
        </details>
      )}

      <section className="card" style={{ gap: 10 }} aria-labelledby="rt-cats">
        <h2 id="rt-cats" className="eyebrow" style={{ margin: 0 }}>Categories{sp.county ? ` — ${sp.county} County` : " — all of DFW"}</h2>
        <span className="xs muted">Each city has {data.cap} spots in every category. Choose a category above to see only the cities that still need it.</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Category</th><th>Cities filled</th><th>Cities still open</th><th>Open spots</th></tr></thead>
            <tbody>
              {data.cats.map((k) => {
                const per = inScope.map((c) => c.cats.find((x) => x.id === k.id)!);
                const done = per.filter((x) => x.open === 0).length;
                return (
                  <tr key={k.id} style={k.id === cat?.id ? { background: "#17150F" } : undefined}>
                    <td><Link className="link" href={href({ cat: String(k.id) })}>{k.name}</Link></td>
                    <td>{done} of {per.length}</td>
                    <td>{per.length - done}</td>
                    <td>{per.reduce((t, x) => t + x.open, 0).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={{ gap: 8 }} aria-labelledby="rt-cities">
        <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}>
          <h2 id="rt-cities" className="eyebrow" style={{ margin: 0 }}>{show === "filled" ? "Filled cities — closed for recruiting" : show === "all" ? "All cities" : "Cities to target"}{cat ? ` — ${cat.name}` : ""} ({rows.length})</h2>
          {cat && <Link className="link xs" href={href({ cat: "" })}>Show all categories</Link>}
        </div>
        <span className="xs muted">{cat ? `A city closes for ${cat.name} when its ${data.cap} spots are taken.` : `A city closes when every category's ${data.cap} spots are taken.`} Open a city to see exactly which categories it still needs.</span>
        <style>{CSS}</style>
        <div>
          <div>
            <div className="xs muted rt-head" style={{ borderBottom: "1px solid #232326", textTransform: "uppercase", letterSpacing: ".08em" }}>
              <span>City</span><span>County</span><span>{cat ? `${cat.name} spots` : "Categories filled"}</span><span>Open spots</span><span>Status</span>
            </div>
            {rows.length === 0 && <div className="small muted" style={{ padding: 12 }}>{show === "filled" ? "No cities are filled yet." : "Every city here is filled — nice work."}</div>}
            {rows.map((c) => {
              const k = cat ? c.cats.find((x) => x.id === cat.id)! : null;
              const done = isFilled(c);
              return (
                <details key={c.id} style={{ borderBottom: "1px solid #1C1C1F" }}>
                  <summary className="rt-row">
                    <span className="b rt-city">{c.name}</span>
                    <span className="small muted rt-county">{c.counties.join(", ")} County</span>
                    <span className="col rt-prog" style={{ gap: 4 }}>
                      <span className="xs">{k ? `${k.taken} of ${data.cap} ${k.name} spots taken` : `${c.filledCats} of ${c.cats.length} categories filled`}</span>
                      {k ? bar(k.taken, data.cap) : bar(c.filledCats, c.cats.length)}
                    </span>
                    <span className="b rt-open"><span className="rt-open-l xs muted" style={{ fontWeight: 400 }}>Open spots </span>{openOf(c)}</span>
                    <span className={`tag rt-status${done ? " ok" : c.status === "started" ? " warn" : ""}`} style={{ justifySelf: "start" }}>{done ? "Filled — move on" : c.status === "started" ? "In progress" : "Needs professionals"}</span>
                  </summary>
                  <div style={{ padding: "4px 10px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "6px 16px" }}>
                    {c.cats.map((x) => (
                      <div key={x.id} className="row between small" style={{ gap: 8, padding: "4px 0", borderBottom: "1px dashed #1F1F22" }}>
                        <span>{x.name}</span>
                        <span className={x.open === 0 ? "xs muted" : "xs b"}>{x.open === 0 ? "Filled" : `${x.open} needed (${x.taken}/${data.cap})`}</span>
                      </div>
                    ))}
                  </div>
                  {people && (
                    <div className="col small" style={{ gap: 4, padding: "0 10px 14px" }}>
                      <span className="eyebrow" style={{ margin: 0 }}>Already on Nearest here — don&apos;t recruit again</span>
                      {(people.counted[c.id] ?? []).length === 0 && <span className="xs muted">No professionals count in {c.name} yet.</span>}
                      {(people.counted[c.id] ?? []).map((p) => <span key={p.userId}>{who(p)} — takes a spot in {p.cats.join(", ")}</span>)}
                      {(people.uncounted[c.id] ?? []).length > 0 && <span className="eyebrow" style={{ margin: "6px 0 0" }}>Signed up in {c.name}, still finishing — not counted yet, don&apos;t recruit again</span>}
                      {(people.uncounted[c.id] ?? []).map((p) => <span key={p.userId}>{who(p)}{p.cats.length ? ` — signing up for ${p.cats.join(", ")}` : ""} — {p.reason}</span>)}
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
