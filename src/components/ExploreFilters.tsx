"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Option = { value: string; label: string };

/**
 * Explore's "Find a professional" card: Where + Category dropdowns.
 * Category "Other" opens a box to type the service; the text searches every service by name.
 */
export function ExploreFilters({ cats, cat, q, area, areaOptions, keep }: {
  cats: { id: number; name: string }[];
  cat?: string;
  q?: string;
  area?: string;
  areaOptions: Option[];
  keep: Record<string, string | undefined>; // other active filters to carry along (today, after, under, asl, sort)
}) {
  const router = useRouter();
  const [picked, setPicked] = useState(cat ?? "");
  const [text, setText] = useState(cat === "other" ? q ?? "" : "");

  const go = (patch: Record<string, string | undefined>) => {
    const all = { ...keep, area, cat: cat === "other" ? undefined : cat, q: cat === "other" ? undefined : q, ...patch };
    const p = new URLSearchParams(Object.entries(all).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    router.push(s ? `/home?${s}` : "/home");
  };

  const onCategory = (v: string) => {
    setPicked(v);
    if (v === "other") return; // wait for them to type what they need
    go({ cat: v || undefined, q: cat === "other" ? undefined : q });
  };

  return (
    <div className="card" style={{ gap: 12 }}>
      <span className="eyebrow">Find a professional</span>
      <div className="grid2" style={{ gap: 10 }}>
        {areaOptions.length > 0 && (
          <div className="field">
            <label htmlFor="ex-area">Where</label>
            <select id="ex-area" value={area ?? "county"} onChange={(e) => go({ area: e.target.value === "county" ? undefined : e.target.value })}>
              {areaOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
        <div className="field" style={areaOptions.length ? undefined : { gridColumn: "1 / -1" }}>
          <label htmlFor="ex-cat">Category</label>
          <select id="ex-cat" value={picked} onChange={(e) => onCategory(e.target.value)}>
            <option value="">All categories</option>
            {cats.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            <option value="other">Other — type what you need</option>
          </select>
        </div>
      </div>
      {picked === "other" && (
        <form
          className="col"
          style={{ gap: 10 }}
          onSubmit={(e) => { e.preventDefault(); if (text.trim()) go({ cat: "other", q: text.trim().slice(0, 60) }); }}
        >
          <div className="field">
            <label htmlFor="ex-other">What are you looking for?</label>
            <input id="ex-other" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. henna, piercing, tutoring" maxLength={60} autoFocus />
          </div>
          <button className="btn" type="submit" disabled={!text.trim()}>Search</button>
        </form>
      )}
    </div>
  );
}
