import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin, isMainOwner } from "@/lib/admin";
import { areaMap, SIDE_LABEL } from "@/lib/areas";
import { dfwTargets } from "@/lib/recruit-targets";
import { applyAreaSplit, setCityArea, setZipArea } from "@/app/field-actions";

export const metadata = { title: "Areas" };
export const dynamic = "force-dynamic";

const sel = { height: 34, borderRadius: 8, background: "#0E0E10", color: "#ECE8E1", border: "1px solid #2A2A2D", padding: "0 6px" } as const;

/**
 * Areas (2026-11-22, owner): which owner works which DFW city (and which Dallas ZIP codes). The main owner sets them;
 * other owners see their own. Prospects the main owner adds or imports go to the area's owner; organizations, pop-ups,
 * Field team and their assistants follow the area.
 */
export default async function Areas({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { user, role } = await requireAdmin();
  if (role !== "OWNER") { const { notFound } = await import("next/navigation"); notFound(); }
  const main = await isMainOwner(user.id);
  const [{ cities: rows, zips, owners, setup }, t, sp] = await Promise.all([areaMap(), dfwTargets(), searchParams]);
  const owned = new Map(rows.map((r) => [r.cityId, r.ownerId]));
  const name = (id: string | null | undefined) => owners.find((o) => o.id === id)?.name ?? "—";
  const q = (sp.q ?? "").toLowerCase();
  // One row per city: some cities exist twice (older records); they share one area and are saved together.
  const merged = new Map<string, (typeof t.cities)[number]>();
  for (const c of t.cities) {
    const k = c.name.toLowerCase();
    const m = merged.get(k);
    if (!m) merged.set(k, { ...c, counties: [...c.counties] });
    else { for (const x of c.counties) if (!m.counties.includes(x)) m.counties.push(x); if (!owned.has(m.id) && owned.has(c.id)) merged.set(k, { ...m, id: c.id }); }
  }
  const list = [...merged.values()].filter((c) => (!q || c.name.toLowerCase().includes(q) || c.counties.some((k) => k.toLowerCase().includes(q))) && (main || owned.get(c.id) === user.id || zips.some((z) => z.ownerId === user.id && z.cityId === c.id)));
  const counts = owners.map((o) => ({ ...o, cities: rows.filter((r) => r.ownerId === o.id).length, zips: zips.filter((z) => z.ownerId === o.id).length }));
  const guess = (n: string) => owners.find((o) => o.name.toLowerCase().startsWith(n))?.id ?? "";
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title={main ? "Areas" : "My area"} />
      {!setup.ok && <div className="card warn small">The North / South / East split couldn&apos;t be put in place by itself. {setup.problem} Choose who has each side under &ldquo;Start over with the original split&rdquo; below and press Apply.</div>}
      <div className="card" style={{ gap: 8 }}>
        <span className="small">The split you approved is already in place — North (Collin, Denton, north Dallas County and northeast Tarrant/Wise) is {name(owners.find((o) => /^(avy|avr)/i.test(o.name))?.id)}, South is {name(owners.find((o) => /^(lak|kee)/i.test(o.name))?.id)}, East is {name(owners.find((o) => /^(kis|aub)/i.test(o.name))?.id)}. Nothing to set up. Each city belongs to one owner. The City of Dallas is split by ZIP code (North, South, East). A ZIP code always wins over its city. {main ? "Only change a city here when someone else should work it." : "Ask Avy to change your area."}</span>
        <div className="row" style={{ gap: 18, flexWrap: "wrap" }}>{counts.map((o) => <span key={o.id} className="small"><b>{o.name}</b>: {o.cities} cities, {o.zips} ZIP codes</span>)}</div>
      </div>

      {main && (
        <details className="card" style={{ gap: 10 }} open={!setup.ok}>
          <summary className="small b" style={{ cursor: "pointer" }}>Start over with the original split</summary>
          <span className="xs muted">Sets every DFW city: North = Collin, Denton and north Dallas County; South = south Dallas County and Ellis; East = east Dallas County, Rockwall, Kaufman and Hunt. The West is split three ways — {SIDE_LABEL.westNorth} goes to North, {SIDE_LABEL.westCentral} to East, {SIDE_LABEL.westSouth} to South — and the City of Dallas by ZIP. This replaces every area row.</span>
          <ActionForm action={applyAreaSplit} submitLabel="Apply the starting split">
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              {(["north", "south", "east"] as const).map((k, i) => (
                <div key={k} className="field" style={{ minWidth: 180 }}><label>{["North", "South", "East"][i]}</label>
                  <select name={k} defaultValue={guess(["avy", "lak", "kis"][i]) || guess(["avr", "kee", "aub"][i])}><option value="">Choose</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
              ))}
            </div>
          </ActionForm>
        </details>
      )}

      <div className="card" style={{ gap: 10 }}>
        <div className="row between" style={{ flexWrap: "wrap", gap: 8 }}>
          <span className="eyebrow">DFW cities</span>
          <form className="row" style={{ gap: 6 }}><input name="q" defaultValue={sp.q ?? ""} placeholder="City or county" style={{ ...sel, height: 36, width: 200 }} /><button className="btn ghost sm" style={{ width: "auto" }}>Find</button></form>
        </div>
        <table className="tbl"><thead><tr><th>City</th><th>County</th><th>Owner</th></tr></thead>
          <tbody>{list.length === 0 ? <tr><td className="empty" colSpan={3}>No cities.</td></tr> : list.map((c) => (
            <tr key={c.id}><td className="b">{c.name}{zips.some((z) => z.cityId === c.id) && <div className="xs muted">Split by ZIP code — see below</div>}</td><td className="small">{c.counties.join(", ")}</td>
              <td>{main ? (
                <form action={setCityArea} className="row" style={{ gap: 6 }}>
                  <input type="hidden" name="cityId" value={c.id} />
                  <select name="ownerId" defaultValue={owned.get(c.id) ?? ""} style={sel}><option value="">Nobody</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                  <button className="link xs">Save</button>
                </form>) : name(owned.get(c.id))}</td></tr>
          ))}</tbody></table>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">ZIP codes</span>
        <table className="tbl"><thead><tr><th>ZIP</th><th>Owner</th></tr></thead>
          <tbody>{zips.filter((z) => main || z.ownerId === user.id).length === 0 ? <tr><td className="empty" colSpan={2}>No ZIP codes.</td></tr> : owners.map((o) => {
            const z = zips.filter((x) => x.ownerId === o.id && (main || x.ownerId === user.id));
            return z.length ? <tr key={o.id}><td className="small">{z.map((x) => x.zip).join(", ")}</td><td className="b">{o.name}</td></tr> : null;
          })}</tbody></table>
        {main && (
          <ActionForm action={setZipArea} submitLabel="Save ZIP codes">
            <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "end" }}>
              <div className="field" style={{ flex: "2 1 260px" }}><label>ZIP codes (spaces or commas)</label><input name="zips" required placeholder="75230 75240" /></div>
              <div className="field" style={{ flex: "1 1 140px" }}><label>City</label><input name="city" defaultValue="Dallas" /></div>
              <div className="field" style={{ flex: "1 1 160px" }}><label>Owner</label><select name="ownerId" defaultValue=""><option value="">Remove (follow the city)</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
            </div>
          </ActionForm>
        )}
      </div>
    </>
  );
}
