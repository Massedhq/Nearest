"use client";
import { useMemo, useState } from "react";

type City = { id: number; name: string; state?: string };

/**
 * Pick a city by typing it — no scrolling a list of every state. The state is chosen beside it (Texas first and
 * selected by default). The chosen city is sent as a hidden `name` field (the city id), so forms read it as before.
 */
export function CityPicker({ cities, value, onChange, name = "cityId", id = "city-q", label = "City" }: { cities: City[]; value: string; onChange: (id: string) => void; name?: string; id?: string; label?: string }) {
  const chosen = useMemo(() => cities.find((c) => String(c.id) === value) ?? null, [cities, value]);
  const states = useMemo(() => {
    const s = Array.from(new Set(cities.map((c) => c.state || "TX")));
    return s.sort((a, b) => (a === "TX" ? -1 : b === "TX" ? 1 : a.localeCompare(b)));
  }, [cities]);
  const [pickedState, setState] = useState("");
  const state = pickedState || chosen?.state || "TX";
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    const inState = cities.filter((c) => (c.state || "TX") === state);
    if (!t) return inState.slice(0, 8);
    const starts = inState.filter((c) => c.name.toLowerCase().startsWith(t));
    const has = inState.filter((c) => !c.name.toLowerCase().startsWith(t) && c.name.toLowerCase().includes(t));
    return [...starts, ...has].slice(0, 8);
  }, [cities, state, q]);

  const choose = (c: City) => { onChange(String(c.id)); setQ(""); setOpen(false); (document.activeElement as HTMLElement | null)?.blur(); };

  return (
    <div className="field" style={{ gridColumn: "1 / -1" }}>
      <label htmlFor={id}>{label}</label>
      <input type="hidden" name={name} value={value} />
      <div className="row" style={{ gap: 8, alignItems: "stretch" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <input id={id} autoComplete="off" placeholder={`Start typing a ${state === "TX" ? "Texas " : ""}city`} maxLength={60}
            value={open ? q : chosen ? `${chosen.name}, ${chosen.state || "TX"}` : q}
            onFocus={() => { setQ(""); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 150)}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (matches[0]) choose(matches[0]); } }} />
          {open && (
            <div role="listbox" style={{ position: "absolute", zIndex: 20, left: 0, right: 0, top: "calc(100% + 4px)", background: "#0E0E10", border: "1px solid #2A2A2D", borderRadius: 12, overflow: "hidden" }}>
              {matches.length ? matches.map((c) => (
                <button key={c.id} type="button" role="option" aria-selected={String(c.id) === value} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(c)}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "transparent", border: 0, color: "inherit", cursor: "pointer" }}>
                  {c.name}<span className="muted">, {c.state || "TX"}</span>
                </button>
              )) : <span className="small muted" style={{ display: "block", padding: "10px 14px" }}>No {state} city by that name yet.</span>}
            </div>
          )}
        </div>
        <select aria-label="State" value={state} style={{ flex: "0 0 96px", width: 96 }} onChange={(e) => { setState(e.target.value); setQ(""); if (chosen && (chosen.state || "TX") !== e.target.value) onChange(""); setOpen(true); }}>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
}
