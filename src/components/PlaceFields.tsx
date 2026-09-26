"use client";
import { useState } from "react";
import { US_STATES } from "@/lib/markets";
import { zipLookup } from "@/app/admin/place-actions";

/** State → ZIP → Find fills in city and county (both still editable). Works for any US state. */
export function PlaceFields({ id = "p", city: city0 = "", state: state0 = "TX" }: { id?: string; city?: string; state?: string }) {
  const [state, setState] = useState(state0);
  const [zip, setZip] = useState("");
  const [city, setCity] = useState(city0);
  const [county, setCounty] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [busy, setBusy] = useState(false);

  async function find() {
    setBusy(true); setMsg({});
    const r = await zipLookup(zip);
    setBusy(false);
    if ("error" in r) { setMsg({ err: r.error }); return; }
    setState(r.state); setCity(r.city); setCounty(r.county ?? "");
    setMsg({ ok: `Found ${r.city}${r.county ? `, ${r.county} County` : ""}, ${r.state}${r.county ? "" : " — type the county"}` });
  }

  return (
    <>
      <div className="grid2">
        <div className="field"><label htmlFor={`${id}_state`}>State</label>
          <select id={`${id}_state`} name="state" value={state} onChange={(e) => setState(e.target.value)}>
            {US_STATES.map(([a, n]) => <option key={a} value={a}>{n}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor={`${id}_zip`}>ZIP code</label>
          <div className="row" style={{ gap: 6 }}>
            <input id={`${id}_zip`} inputMode="numeric" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} placeholder="78701" style={{ flex: 1 }} />
            <button type="button" className="btn ghost sm" onClick={find} disabled={busy || zip.length !== 5}>{busy ? "…" : "Find"}</button>
          </div>
        </div>
      </div>
      {msg.ok && <span className="okmsg small">{msg.ok}</span>}
      {msg.err && <span className="err small">{msg.err}</span>}
      <div className="grid2">
        <div className="field"><label htmlFor={`${id}_city`}>City</label><input id={`${id}_city`} name="city" value={city} onChange={(e) => setCity(e.target.value)} required /></div>
        <div className="field"><label htmlFor={`${id}_county`}>County</label><input id={`${id}_county`} name="county" value={county} onChange={(e) => setCounty(e.target.value)} placeholder="e.g. Travis" required /></div>
      </div>
    </>
  );
}
