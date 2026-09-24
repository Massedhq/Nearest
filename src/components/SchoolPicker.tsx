"use client";
import { useId, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";

export type SchoolOption = { id: number; name: string; city: string; cityId: number; type: string };
type Place = { id: number; name: string };
const TYPE: Record<string, string> = { high_school: "High school", college: "College", trade: "Trade school" };
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
/** "University of Texas at Arlington" -> "uta", so students can type UTA, UT Arlington or UNT. */
const initials = (name: string) => norm(name).split(" ").filter((w) => !["of", "at", "the", "and"].includes(w)).map((w) => w[0]).join("");

/** County → City → type to search the schools in that city. */
export function SchoolPicker({ schools, counties, cities, links, initialId }: {
  schools: SchoolOption[]; counties: Place[]; cities: Place[]; links: { cityId: number; countyId: number }[]; initialId?: number | null;
}) {
  const initial = schools.find((s) => s.id === initialId) ?? null;
  const [countyId, setCountyId] = useState<number | "">(() => (initial ? links.find((l) => l.cityId === initial.cityId)?.countyId ?? "" : ""));
  const [cityId, setCityId] = useState<number | "">(initial?.cityId ?? "");
  const [selected, setSelected] = useState<SchoolOption | null>(initial);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const citiesInCounty = useMemo(
    () => (countyId === "" ? [] : cities.filter((c) => links.some((l) => l.cityId === c.id && l.countyId === countyId))),
    [countyId, cities, links],
  );
  const inCity = useMemo(() => (cityId === "" ? [] : schools.filter((s) => s.cityId === cityId)), [cityId, schools]);
  const matches = useMemo(() => {
    const words = norm(q).split(" ").filter(Boolean);
    return inCity
      .filter((s) => words.every((w) => `${norm(s.name)} ${initials(s.name)}`.includes(w)))
      .sort((a, b) => (words[0] ? Number(!norm(a.name).startsWith(words[0])) - Number(!norm(b.name).startsWith(words[0])) : 0) || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [q, inCity]);

  const choose = (s: SchoolOption) => { setSelected(s); setQ(""); setOpen(false); };

  return (
    <div className="col g16">
      <div className="grid2">
        <div className="field">
          <label htmlFor={`${listId}-county`}>County</label>
          <select id={`${listId}-county`} value={countyId} required onChange={(e) => { setCountyId(e.target.value ? Number(e.target.value) : ""); setCityId(""); setSelected(null); setQ(""); }}>
            <option value="" disabled>Choose county</option>
            {counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${listId}-city`}>City</label>
          <select id={`${listId}-city`} value={cityId} required disabled={countyId === ""} onChange={(e) => { setCityId(e.target.value ? Number(e.target.value) : ""); setSelected(null); setQ(""); setTimeout(() => input.current?.focus(), 0); }}>
            <option value="" disabled>{countyId === "" ? "Pick county first" : "Choose city"}</option>
            {citiesInCounty.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {selected ? (
        <div className="card pearl" style={{ gap: 8 }}>
          <input type="hidden" name="schoolId" value={selected.id} />
          <div className="row between"><span className="eyebrow">Selected</span><button type="button" className="link small" style={{ color: "#F4EFE6" }} onClick={() => { setSelected(null); setTimeout(() => input.current?.focus(), 0); }}>Change</button></div>
          <div className="row between"><span>School</span><span className="b" style={{ textAlign: "right" }}>{selected.name}</span></div>
          <div className="row between"><span>City</span><span className="b">{selected.city}</span></div>
          <div className="row between"><span>County</span><span className="b">{counties.find((c) => c.id === countyId)?.name ?? ""}</span></div>
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
              placeholder={cityId === "" ? "Pick your county and city first" : "Type your school's name"}
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
                <li
                  key={s.id}
                  id={`${listId}-${s.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => { e.preventDefault(); choose(s); }}
                  onMouseEnter={() => setActive(i)}
                  className={`opt${i === active ? " active" : ""}`}
                >
                  <div className="b small">{s.name}</div>
                  <div className="xs muted">{s.city} • {counties.find((c) => c.id === countyId)?.name} County • {TYPE[s.type]}</div>
                </li>
              ))}
            </ul>
          )}
          {cityId !== "" && (inCity.length === 0 || (q.trim().length >= 3 && matches.length === 0)) && (
            <p className="xs muted p">{inCity.length === 0 ? "No schools listed in this city yet." : `No school in this city matches “${q.trim()}”.`} Use <span className="b">Can&apos;t find my school?</span> below.</p>
          )}
        </div>
      )}
    </div>
  );
}
