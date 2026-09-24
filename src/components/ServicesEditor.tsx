"use client";
import { useState } from "react";

export type Cat = { id: number; name: string; licenseRequired: boolean; suggestions: string[] };
export type Row = { categoryId: number; name: string; price: string; duration: string };

/** Pick categories, then list each service with a price and length. Sends everything as one JSON field. */
export function ServicesEditor({ categories, initial }: { categories: Cat[]; initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [cats, setCats] = useState<number[]>(() => [...new Set(initial.map((r) => r.categoryId))]);

  const toggleCat = (id: number) => setCats((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const add = (categoryId: number, name = "") => setRows((r) => [...r, { categoryId, name, price: "", duration: "60" }]);
  const remove = (i: number) => setRows((r) => r.filter((_, j) => j !== i));
  const kept = rows.filter((r) => cats.includes(r.categoryId));

  return (
    <div className="col g16">
      <input type="hidden" name="payload" value={JSON.stringify(kept)} />
      <div className="chips">
        {categories.map((c) => (
          <button key={c.id} type="button" className={`chip${cats.includes(c.id) ? " on" : ""}`} aria-pressed={cats.includes(c.id)} onClick={() => toggleCat(c.id)}>{c.name}</button>
        ))}
      </div>
      {categories.filter((c) => cats.includes(c.id)).map((c) => {
        const mine = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.categoryId === c.id);
        const unused = c.suggestions.filter((s) => !mine.some(({ r }) => r.name.toLowerCase() === s.toLowerCase()));
        return (
          <div key={c.id} className="card">
            <div className="row between"><span className="eyebrow">{c.name}</span><span className="xs muted">Price • Minutes</span></div>
            {c.licenseRequired && <span className="tag warn" style={{ alignSelf: "flex-start" }}>License required</span>}
            {mine.map(({ r, i }) => (
              <div key={i} className="row">
                <input className="ainput grow" aria-label="Service name" placeholder="Service name" value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
                <input className="ainput" style={{ width: 70 }} aria-label={`${r.name || "Service"} price in dollars`} placeholder="$" inputMode="decimal" value={r.price} onChange={(e) => update(i, { price: e.target.value })} />
                <input className="ainput" style={{ width: 62 }} aria-label={`${r.name || "Service"} length in minutes`} inputMode="numeric" value={r.duration} onChange={(e) => update(i, { duration: e.target.value })} />
                <button type="button" className="iconbtn" style={{ width: 36, height: 36 }} aria-label={`Remove ${r.name || "service"}`} onClick={() => remove(i)}>×</button>
              </div>
            ))}
            {unused.length > 0 && (
              <div className="chips">{unused.map((s) => <button key={s} type="button" className="chip" style={{ height: 32 }} onClick={() => add(c.id, s)}>+ {s}</button>)}</div>
            )}
            <button type="button" className="link small" style={{ alignSelf: "flex-start" }} onClick={() => add(c.id)}>+ Add custom service</button>
          </div>
        );
      })}
      {cats.length === 0 && <p className="small muted p">Pick at least one category above.</p>}
    </div>
  );
}
