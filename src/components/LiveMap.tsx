"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { LiveSnapshot } from "@/lib/live/data";

/**
 * Nearest LIVE — animated real-time voting map. Polls /api/live every 8 seconds; every vote that wasn't there before
 * makes a short pulse on its city. Real votes only; city-level only. Votes are interest, not bookings.
 */
const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`;
};

export function LiveMap({ initial, outline, width, height }: { initial: LiveSnapshot; outline: string; width: number; height: number }) {
  const [snap, setSnap] = useState(initial);
  const [pulses, setPulses] = useState<{ id: string; x: number; y: number }[]>([]);
  const [city, setCity] = useState<number | null>(null);
  const seen = useRef(new Set(initial.recent.map((r) => r.key)));

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/live?state=${initial.state}`, { cache: "no-store" });
        if (!r.ok) return;
        const next: LiveSnapshot = await r.json();
        const fresh = next.recent.filter((v) => !seen.current.has(v.key));
        fresh.forEach((v) => seen.current.add(v.key));
        if (!stop) {
          setSnap(next);
          const p = fresh.filter((v) => v.x != null && v.y != null).map((v) => ({ id: `${v.key}-${Date.now()}`, x: v.x!, y: v.y! }));
          if (p.length) {
            setPulses((old) => [...old, ...p]);
            setTimeout(() => setPulses((old) => old.filter((o) => !p.some((q) => q.id === o.id))), 2600);
          }
        }
      } catch { /* try again next tick */ }
    };
    const t = setInterval(tick, 8000);
    return () => { stop = true; clearInterval(t); };
  }, [initial.state]);

  const max = Math.max(1, ...snap.byCity.map((c) => c.votes));
  const trending = useMemo(() => [...snap.byCity].filter((c) => c.last24 > 0).sort((a, b) => b.last24 - a.last24).slice(0, 5), [snap]);
  const sel = snap.byCity.find((c) => c.id === city) ?? null;
  const dayMax = Math.max(1, ...snap.daily.map((d) => d.votes));
  const svcMax = Math.max(1, ...snap.byService.map((s) => s.votes));

  return (
    <div style={{ minHeight: "100vh", background: "#050506", color: "#ECE8E1" }}>
      <style>{`@keyframes nlpulse{0%{r:3;opacity:.95}100%{r:26;opacity:0}} @keyframes nlblink{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
      <div className="col" style={{ gap: 14, maxWidth: 1100, margin: "0 auto", width: "100%", padding: "16px 16px 32px", boxSizing: "border-box" }}>
        <div className="row between" style={{ alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Image src="/brand/nearest-wordmark.png" alt="Nearest" width={130} height={38} style={{ objectFit: "contain" }} priority />
          <span className="row" style={{ gap: 6, alignItems: "center", font: "800 12px var(--font-body), sans-serif", letterSpacing: "0.24em" }}><span style={{ width: 8, height: 8, borderRadius: 99, background: "#E5484D", animation: "nlblink 1.4s infinite" }} />NEAREST LIVE</span>
        </div>
        <h1 className="disp h1" style={{ margin: 0 }}>Your City Is Voting. See What Students Want.</h1>

        <div className="kpis k4">
          <div className="card" style={{ gap: 2 }}><span className="xs muted">Votes</span><span className="stat">{snap.total.toLocaleString()}</span></div>
          <div className="card" style={{ gap: 2 }}><span className="xs muted">Today</span><span className="stat">{snap.today.toLocaleString()}</span></div>
          <div className="card" style={{ gap: 2 }}><span className="xs muted">Cities</span><span className="stat">{snap.cities.toLocaleString()}</span></div>
          <div className="card" style={{ gap: 2 }}><span className="xs muted">Top service</span><span className="stat" style={{ fontSize: 22 }}>{snap.byService[0]?.name ?? "—"}</span></div>
        </div>

        <div className="acols" style={{ gap: 14, alignItems: "flex-start" }}>
          <div id="nlmap" className="card" style={{ padding: 8, flex: "2 1 420px" }}>
            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Map of Texas with student votes by city">
              <defs><radialGradient id="nlglow"><stop offset="0" stopColor="#ECE8E1" stopOpacity=".9" /><stop offset="1" stopColor="#ECE8E1" stopOpacity="0" /></radialGradient></defs>
              <path d={outline} fill="#111113" stroke="#9C9A95" strokeWidth="1.4" />
              {snap.byCity.filter((c) => c.x != null).map((c) => {
                const r = 2.5 + 9 * Math.sqrt(c.votes / max);
                return (
                  <g key={c.id} role="button" tabIndex={0} aria-label={`${c.name}: ${c.votes} votes`} onClick={() => setCity(c.id === city ? null : c.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCity(c.id === city ? null : c.id); } }} style={{ cursor: "pointer", outline: "none" }}>
                    <circle cx={c.x!} cy={c.y!} r={r * 2.2} fill="url(#nlglow)" opacity={0.35} pointerEvents="none" />
                    <circle cx={c.x!} cy={c.y!} r={r} fill={c.id === city ? "#E3C58A" : "#ECE8E1"} fillOpacity={0.85} stroke="#050506" strokeWidth="0.8"><title>{`${c.name}: ${c.votes} vote${c.votes === 1 ? "" : "s"}`}</title></circle>
                    <circle cx={c.x!} cy={c.y!} r={Math.max(16, r * 2.2)} fill="#000" fillOpacity={0} pointerEvents="all" />
                  </g>
                );
              })}
              {pulses.map((p) => <circle key={p.id} cx={p.x} cy={p.y} r="3" fill="none" stroke="#E3C58A" strokeWidth="2" pointerEvents="none" style={{ animation: "nlpulse 2.4s ease-out forwards" }} />)}
            </svg>
            {sel ? (
              <div className="card" style={{ gap: 8, margin: 4, background: "#141416" }}>
                <div className="row between"><span className="b">{sel.name}</span><button type="button" className="link xs" onClick={() => setCity(null)} style={{ background: "none", border: 0, color: "inherit" }}>Close</button></div>
                <span className="stat" style={{ fontSize: 26 }}>{sel.votes.toLocaleString()} <span className="xs muted">votes • {sel.last24} in the last 24 h</span></span>
                <span className="xs muted">Most requested</span>
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{sel.top.map((t) => <span key={t} className="tag">{t}</span>)}</div>
              </div>
            ) : <span className="xs muted" style={{ display: "block", padding: "4px 6px" }}>Tap a city to see what students there want.</span>}
          </div>

          <div className="col" style={{ gap: 14, flex: "1 1 280px" }}>
            <div className="card" style={{ gap: 8 }}>
              <span className="eyebrow">Recent votes</span>
              {snap.recent.length === 0 ? <span className="small muted">No votes yet.</span> : snap.recent.slice(0, 8).map((v) => (
                <div key={v.key} className="row between" style={{ gap: 8 }}><span className="small"><span className="b">{v.city}</span> — {v.services.join(", ")}</span><span className="xs muted" style={{ whiteSpace: "nowrap" }}>{ago(v.at)}</span></div>
              ))}
            </div>
            <div className="card" style={{ gap: 8 }}>
              <span className="eyebrow">Trending cities (24 h)</span>
              {trending.length === 0 ? <span className="small muted">Nothing in the last 24 hours yet.</span> : trending.map((c) => <div key={c.id} className="row between"><span className="small">{c.name}</span><span className="small b">+{c.last24}</span></div>)}
            </div>
          </div>
        </div>

        <div className="acols even" style={{ gap: 14 }}>
          <div className="card" style={{ gap: 8 }}>
            <span className="eyebrow">Most requested services</span>
            {snap.byService.slice(0, 10).map((s) => (
              <div key={s.name} className="col" style={{ gap: 3 }}>
                <div className="row between"><span className="small">{s.name}</span><span className="small b">{s.votes}</span></div>
                <div style={{ height: 6, borderRadius: 99, background: "#1C1C1F" }}><div style={{ width: `${(s.votes / svcMax) * 100}%`, height: "100%", borderRadius: 99, background: "#C9C6C0" }} /></div>
              </div>
            ))}
          </div>
          <div className="card" style={{ gap: 8 }}>
            <span className="eyebrow">Votes by city</span>
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {snap.byCity.slice(0, 30).map((c) => <button key={c.id} type="button" onClick={() => { setCity(c.id); document.getElementById("nlmap")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="row between" style={{ width: "100%", background: "none", border: 0, color: "inherit", padding: "4px 0", cursor: "pointer" }}><span className="small">{c.name}</span><span className="small b">{c.votes}</span></button>)}
            </div>
          </div>
        </div>

        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">Voting activity — last 14 days</span>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 90 }}>
            {snap.daily.map((d) => <div key={d.day} title={`${d.day}: ${d.votes}`} style={{ flex: 1, height: `${Math.max(3, (d.votes / dayMax) * 100)}%`, background: "#ECE8E1", opacity: 0.8, borderRadius: 3 }} />)}
          </div>
        </div>
        <span className="xs muted" style={{ textAlign: "center" }}>Votes show what students want in their city — not bookings. City locations: GeoNames (CC BY 4.0).</span>
      </div>
    </div>
  );
}
