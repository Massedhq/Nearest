"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { US_STATES } from "@/lib/markets";

type Opt = { id: number; name: string };
type School = { id: number; name: string; type: string };
export type InitialSchool = { id: number; name: string; type: string; cityId: number; city: string; countyId: number | null; county: string | null; state: string } | null;

const TYPE: Record<string, string> = { high_school: "High school", college: "College", trade: "Trade school" };
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
/** "University of Texas at Arlington" -> "uta", so students can type UTA, UT Arlington or UNT. */
const initials = (name: string) => norm(name).split(" ").filter((w) => !["of", "at", "the", "and"].includes(w)).map((w) => w[0]).join("");
const stateName = (st: string) => US_STATES.find(([a]) => a === st)?.[1] ?? st;

async function get<T>(q: string): Promise<T> {
  const r = await fetch(`/api/places?${q}`);
  return r.ok ? r.json() : ([] as unknown as T);
}

/** State → County → City → type the school. Each list loads from the server only when needed. */
export function SchoolPicker({ initial }: { initial: InitialSchool }) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [states, setStates] = useState<string[]>([]);
  const [st, setSt] = useState(initial?.state ?? "");
  const [counties, setCounties] = useState<Opt[]>([]);
  const [countyId, setCountyId] = useState<number | "">(initial?.countyId ?? "");
  const [cities, setCities] = useState<Opt[]>([]);
  const [cityId, setCityId] = useState<number | "">(initial?.cityId ?? "");
  const [inCity, setInCity] = useState<School[]>([]);
  const [selected, setSelected] = useState<{ id: number; name: string; type: string } | null>(initial ? { id: initial.id, name: initial.name, type: initial.type } : null);
  const [loading, setLoading] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    get<string[]>("list=states").then((s) => { setStates(s); if (!st && s.length === 1) setSt(s[0]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!st) { setCounties([]); return; }
    setLoading("counties");
    get<Opt[]>(`list=counties&state=${st}`).then((c) => { setCounties(c); setLoading(""); });
  }, [st]);
  useEffect(() => {
    if (countyId === "") { setCities([]); return; }
    setLoading("cities");
    get<Opt[]>(`list=cities&county=${countyId}`).then((c) => { setCities(c); setLoading(""); });
  }, [countyId]);
  useEffect(() => {
    if (cityId === "") { setInCity([]); return; }
    setLoading("schools");
    get<School[]>(`list=schools&city=${cityId}`).then((s) => { setInCity(s); setLoading(""); });
  }, [cityId]);

  const matches = useMemo(() => {
    const words = norm(q).split(" ").filter(Boolean);
    return inCity
      .filter((s) => words.every((w) => `${norm(s.name)} ${initials(s.name)}`.includes(w)))
      .sort((a, b) => (words[0] ? Number(!norm(a.name).startsWith(words[0])) - Number(!norm(b.name).startsWith(words[0])) : 0) || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [q, inCity]);

  const choose = (s: School) => { setSelected(s); setQ(""); setOpen(false); };
  const countyName = counties.find((c) => c.id === countyId)?.name ?? initial?.county ?? "";
  const cityName = cities.find((c) => c.id === cityId)?.name ?? initial?.city ?? "";

  return (
    <div className="col g16">
      {states.length > 1 && (
        <div className="field">
          <label htmlFor={`${listId}-state`}>State</label>
          <select id={`${listId}-state`} value={st} required onChange={(e) => { setSt(e.target.value); setCountyId(""); setCityId(""); setSelected(null); setQ(""); }}>
            <option value="" disabled>Choose state</option>
            {states.map((x) => <option key={x} value={x}>{stateName(x)}</option>)}
          </select>
        </div>
      )}
      <div className="grid2">
        <div className="field">
          <label htmlFor={`${listId}-county`}>County</label>
          <select id={`${listId}-county`} value={countyId} required disabled={!st} onChange={(e) => { setCountyId(e.target.value ? Number(e.target.value) : ""); setCityId(""); setSelected(null); setQ(""); }}>
            <option value="" disabled>{!st ? "Pick state first" : loading === "counties" ? "Loading…" : "Choose county"}</option>
            {counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            {countyId !== "" && !counties.some((c) => c.id === countyId) && initial?.county && <option value={countyId}>{initial.county}</option>}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${listId}-city`}>City</label>
          <select id={`${listId}-city`} value={cityId} required disabled={countyId === ""} onChange={(e) => { setCityId(e.target.value ? Number(e.target.value) : ""); setSelected(null); setQ(""); setTimeout(() => input.current?.focus(), 0); }}>
            <option value="" disabled>{countyId === "" ? "Pick county first" : loading === "cities" ? "Loading…" : "Choose city"}</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            {cityId !== "" && !cities.some((c) => c.id === cityId) && initial?.city && <option value={cityId}>{initial.city}</option>}
          </select>
        </div>
      </div>

      {selected ? (
        <div className="card pearl" style={{ gap: 8 }}>
          <input type="hidden" name="schoolId" value={selected.id} />
          <div className="row between"><span className="eyebrow">Selected</span><button type="button" className="link small" onClick={() => { setSelected(null); setTimeout(() => input.current?.focus(), 0); }}>Change</button></div>
          <div className="row between"><span>School</span><span className="b" style={{ textAlign: "right" }}>{selected.name}</span></div>
          <div className="row between"><span>City</span><span className="b">{cityName}</span></div>
          <div className="row between"><span>County</span><span className="b">{countyName}</span></div>
        </div>
      ) : (
        <div className="field" style={{ position: "relative" }}>
          <label htmlFor={`${listId}-input`}>School</label>
          <div className="search" style={{ height: 50, borderRadius: 14, opacity: cityId === "" ? 0.5 : 1 }}>
            <Icon name="search" />
            <input
              ref={input}
              id={`${listId}-input`}
              role="combobox"
              aria-expanded={open && matches.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
              autoComplete="off"
              disabled={cityId === ""}
              placeholder={cityId === "" ? "Pick your county and city first" : loading === "schools" ? "Loading schools…" : "Type your school's name"}
              value={q}
              onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={(e) => {
                if (!matches.length) return;
                if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                if (e.key === "Enter") { e.preventDefault(); choose(matches[active]); }
              }}
            />
          </div>
          {open && matches.length > 0 && (
            <ul id={listId} role="listbox" className="card" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, margin: "6px 0 0", padding: 6, gap: 0, listStyle: "none", maxHeight: 320, overflowY: "auto" }}>
              {matches.map((s, i) => (
                <li key={s.id} id={`${listId}-${s.id}`} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); choose(s); }} onMouseEnter={() => setActive(i)} className={`opt${i === active ? " active" : ""}`}>
                  <div className="b small">{s.name}</div>
                  <div className="xs muted">{cityName}{countyName ? ` • ${countyName} County` : ""} • {TYPE[s.type]}</div>
                </li>
              ))}
            </ul>
          )}
          {cityId !== "" && loading !== "schools" && (inCity.length === 0 || (q.trim().length >= 3 && matches.length === 0)) && (
            <p className="xs muted p">{inCity.length === 0 ? "No schools listed in this city yet." : `No school in this city matches “${q.trim()}”.`} Use <span className="b">Can&apos;t find my school?</span> below.</p>
          )}
        </div>
      )}
    </div>
  );
}
