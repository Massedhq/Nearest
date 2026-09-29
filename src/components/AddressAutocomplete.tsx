"use client";
import { useEffect, useRef, useState } from "react";

export type AddressPick = { street: string; city: string; state: string; zip: string };

/** Street address box that suggests full addresses as you type; picking one fills street, city, state and ZIP. */
export function AddressAutocomplete({ id, name, label, defaultValue = "", required, onPick }: { id: string; name: string; label: string; defaultValue?: string; required?: boolean; onPick: (a: AddressPick) => void }) {
  const [v, setV] = useState(defaultValue);
  const [list, setList] = useState<(AddressPick & { label: string })[]>([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skip = useRef(false);
  useEffect(() => {
    if (skip.current) { skip.current = false; return; }
    if (t.current) clearTimeout(t.current);
    if (v.trim().length < 4 || !/\d/.test(v)) { setList([]); return; }
    t.current = setTimeout(async () => {
      try { const r = await fetch(`/api/address?q=${encodeURIComponent(v)}`); const j = await r.json(); setList(j.list ?? []); setOpen(true); setHi(-1); } catch { setList([]); }
    }, 300);
  }, [v]);
  const pick = (a: AddressPick & { label: string }) => { skip.current = true; setV(a.street); setOpen(false); setList([]); onPick(a); };
  return (
    <div className="field" style={{ position: "relative" }}>
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} value={v} required={required} autoComplete="off" role="combobox" aria-expanded={open && list.length > 0} aria-controls={`${id}-list`} aria-autocomplete="list"
        placeholder="Start typing your street address" onChange={(e) => setV(e.target.value)} onFocus={() => list.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || !list.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, list.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter" && hi >= 0) { e.preventDefault(); pick(list[hi]); }
          else if (e.key === "Escape") setOpen(false);
        }} />
      {open && list.length > 0 && (
        <ul id={`${id}-list`} role="listbox" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 30, listStyle: "none", margin: "4px 0 0", padding: 4, background: "#141416", border: "1px solid #2A2A2D", borderRadius: 14, boxShadow: "0 12px 30px rgba(0,0,0,.5)" }}>
          {list.map((a, i) => (
            <li key={a.label} role="option" aria-selected={i === hi} onMouseDown={(e) => { e.preventDefault(); pick(a); }}
              style={{ padding: "10px 12px", borderRadius: 10, cursor: "pointer", background: i === hi ? "#232326" : "transparent", fontSize: 14 }}>{a.label}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
