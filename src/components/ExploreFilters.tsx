"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";

type Option = { value: string; label: string };

/**
 * Explore's one "Find a professional" box, top to bottom:
 * Search (service or pro name) → Where (my area / all / another city or ZIP) → Category → What service.
 * Dropdowns only, so adding categories never adds clutter. The service list is the category's
 * suggested services from Admin → Marketplace. Category "Other" opens a box to type the service.
 */
export function ExploreFilters({ cats, services, cat, svc, q, area, loc, areaOptions, keep }: {
  cats: { id: number; name: string }[];
  services: { id: number; categoryId: number; name: string }[];
  cat?: string;
  svc?: string;
  q?: string;
  area?: string;
  loc?: string;
  areaOptions: Option[];
  keep: Record<string, string | undefined>; // other active filters to carry along (today, after, under, asl, sort)
}) {
  const router = useRouter();
  const [picked, setPicked] = useState(cat ?? "");
  const [where, setWhere] = useState(area ?? "county");
  const [search, setSearch] = useState(cat === "other" ? "" : q ?? "");
  const [place, setPlace] = useState(loc ?? "");
  const [text, setText] = useState(cat === "other" ? q ?? "" : "");

  const go = (patch: Record<string, string | undefined>) => {
    const all = { ...keep, area, loc: area === "place" ? loc : undefined, cat: cat === "other" ? undefined : cat, svc, q: cat === "other" ? undefined : q, ...patch };
    const p = new URLSearchParams(Object.entries(all).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    router.push(s ? `/home?${s}` : "/home");
  };

  const onWhere = (v: string) => {
    setWhere(v);
    if (v === "place") return; // wait for the city or ZIP
    go({ area: v === "county" ? undefined : v, loc: undefined });
  };

  const onCategory = (v: string) => {
    setPicked(v);
    if (v === "other") return; // wait for them to type what they need
    go({ cat: v || undefined, svc: undefined, q: cat === "other" ? undefined : q });
  };

  const catName = cats.find((c) => String(c.id) === picked)?.name;
  const inCat = picked && picked !== "other" ? services.filter((s) => String(s.categoryId) === picked) : [];

  return (
    <div className="card" style={{ gap: 12 }}>
      <span className="eyebrow">Find a professional</span>

      <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); go({ q: search.trim().slice(0, 60) || undefined, ...(cat === "other" ? { cat: undefined } : {}) }); }}>
        <Icon name="search" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a service or professional" aria-label="Search a service or professional" enterKeyHint="search" />
        {search && <button type="button" className="guide-x" aria-label="Clear search" onClick={() => { setSearch(""); if (q && cat !== "other") go({ q: undefined }); }}><Icon name="x" size="s" /></button>}
      </form>

      <div className="field">
        <label htmlFor="ex-area">Where</label>
        <select id="ex-area" value={where} onChange={(e) => onWhere(e.target.value)}>
          {areaOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {where === "place" && (
        <form className="row" style={{ gap: 8, alignItems: "flex-end" }} onSubmit={(e) => { e.preventDefault(); if (place.trim()) go({ area: "place", loc: place.trim().slice(0, 60) }); }}>
          <div className="field grow">
            <label htmlFor="ex-loc">City or ZIP code</label>
            <input id="ex-loc" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Plano or 75034" maxLength={60} autoFocus={!loc} enterKeyHint="search" />
          </div>
          <button className="btn sm" type="submit" disabled={!place.trim()}>Go</button>
        </form>
      )}

      <div className="field">
        <label htmlFor="ex-cat">Category</label>
        <select id="ex-cat" value={picked} onChange={(e) => onCategory(e.target.value)}>
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          <option value="other">Other — type what you need</option>
        </select>
      </div>
      {catName && (
        <div className="field">
          <label htmlFor="ex-svc">What {catName.toLowerCase()} service?</label>
          <select id="ex-svc" value={svc ?? ""} onChange={(e) => go({ svc: e.target.value || undefined })}>
            <option value="">All {catName.toLowerCase()}</option>
            {inCat.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
        </div>
      )}
      {picked === "other" && (
        <form
          className="col"
          style={{ gap: 10 }}
          onSubmit={(e) => { e.preventDefault(); if (text.trim()) go({ cat: "other", svc: undefined, q: text.trim().slice(0, 60) }); }}
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
