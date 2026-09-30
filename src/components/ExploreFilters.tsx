"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";

type Option = { value: string; label: string };

// Survives the box being rebuilt when the results load, so we still scroll down to them.
const SCROLL_KEY = "nearest:scroll-to-results";

/**
 * Explore's one "Find a professional" box. Nothing runs until they tap Search:
 * Search text → Where (my area / all / another city or ZIP) → Category → What service → [Search].
 * Search applies everything at once and scrolls down to the results.
 * The service list is the category's suggested services from Admin → Marketplace.
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
  const [pending, start] = useTransition();
  const [search, setSearch] = useState(cat === "other" ? "" : q ?? "");
  const [where, setWhere] = useState(area ?? "county");
  const [place, setPlace] = useState(loc ?? "");
  const [picked, setPicked] = useState(cat ?? "");
  const [service, setService] = useState(svc ?? "");
  const [other, setOther] = useState(cat === "other" ? q ?? "" : "");
  const [error, setError] = useState("");

  // After a search finishes loading, bring the results into view.
  useEffect(() => {
    let want = false;
    try { want = sessionStorage.getItem(SCROLL_KEY) === "1"; } catch { /* private mode */ }
    if (!pending && want) {
      try { sessionStorage.removeItem(SCROLL_KEY); } catch { /* ignore */ }
      requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [pending]);

  const catName = cats.find((c) => String(c.id) === picked)?.name;
  const inCat = picked && picked !== "other" ? services.filter((s) => String(s.categoryId) === picked) : [];

  const go = (all: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...keep, ...all }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    try { sessionStorage.setItem(SCROLL_KEY, "1"); } catch { /* private mode: just no auto-scroll */ }
    start(() => router.push(s ? `/home?${s}` : "/home", { scroll: false }));
  };
  const whereParams = () => ({ area: where === "county" ? undefined : where, loc: where === "place" ? place.trim().slice(0, 60) : undefined });

  /** Search button in the text box: what they typed + Where. Clears the category so leftovers can't mix in. */
  const searchText = () => {
    setError("");
    if (!search.trim()) { setError("Type a service or a professional's name, then tap Search."); return; }
    if (where === "place" && !place.trim()) { setError("Type a city or a 5-digit ZIP code."); return; }
    setPicked(""); setService("");
    go({ ...whereParams(), q: search.trim().slice(0, 60) });
  };

  /** Search button under the dropdowns: Where + Category + service. Clears typed text so leftovers can't mix in. */
  const searchChoices = () => {
    setError("");
    if (where === "place" && !place.trim()) { setError("Type a city or a 5-digit ZIP code."); return; }
    if (picked === "other" && !other.trim()) { setError("Type what you're looking for."); return; }
    setSearch("");
    go({
      ...whereParams(),
      cat: picked || undefined,
      svc: picked && picked !== "other" && service ? service : undefined,
      q: picked === "other" ? other.trim().slice(0, 60) : undefined,
    });
  };
  const enter = (fn: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); fn(); } };

  return (
    <form className="card" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); searchChoices(); }} role="search">
      <span className="eyebrow">Find a professional</span>

      <div className="search" style={{ paddingRight: 6 }}>
        <Icon name="search" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={enter(searchText)} placeholder="Search a service or professional" aria-label="Search a service or professional" enterKeyHint="search" />
        {search && <button type="button" className="guide-x" aria-label="Clear search text" onClick={() => setSearch("")}><Icon name="x" size="s" /></button>}
        <button type="button" className="btn sm" onClick={searchText} disabled={pending} style={{ flex: "none" }}>Search</button>
      </div>
      <span className="xs muted" style={{ textAlign: "center" }}>or choose below</span>

      <div className="field">
        <label htmlFor="ex-area">Where</label>
        <select id="ex-area" value={where} onChange={(e) => setWhere(e.target.value)}>
          {areaOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {where === "place" && (
        <div className="field">
          <label htmlFor="ex-loc">City or ZIP code</label>
          <input id="ex-loc" value={place} onChange={(e) => setPlace(e.target.value)} onKeyDown={enter(search.trim() && !picked ? searchText : searchChoices)} placeholder="e.g. Plano or 75034" maxLength={60} enterKeyHint="search" />
        </div>
      )}

      <div className="field">
        <label htmlFor="ex-cat">Category</label>
        <select id="ex-cat" value={picked} onChange={(e) => { setPicked(e.target.value); setService(""); setSearch(""); }}>
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          <option value="other">Other — type what you need</option>
        </select>
      </div>
      {catName && (
        <div className="field">
          <label htmlFor="ex-svc">What {catName.toLowerCase()} service?</label>
          <select id="ex-svc" value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">All {catName.toLowerCase()}</option>
            {inCat.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
        </div>
      )}
      {picked === "other" && (
        <div className="field">
          <label htmlFor="ex-other">What are you looking for?</label>
          <input id="ex-other" value={other} onChange={(e) => setOther(e.target.value)} onKeyDown={enter(searchChoices)} placeholder="e.g. henna, piercing, tutoring" maxLength={60} enterKeyHint="search" />
        </div>
      )}

      {error && <p className="err" role="alert">{error}</p>}
      <button className="btn" type="submit" disabled={pending}>
        <Icon name="search" size="s" /> {pending ? "Searching…" : "Search"}
      </button>
    </form>
  );
}
