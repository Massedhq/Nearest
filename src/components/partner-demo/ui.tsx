"use client";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/** Shared look for the two Nearest Partner demos (sample data only — nothing here touches the database). */
export const ACCENT = "#E8C4C0";
export const GOLD = "#D4B886";
export const IMG = (n: string) => `/partner-demo/${n}.jpg`;
export const money = (d: number) => `$${d}`;

export const C = {
  eyebrow: { fontSize: 11, letterSpacing: 2, color: "#B8B2A7", textTransform: "uppercase", fontWeight: 700 } as CSSProperties,
  h1: { margin: 0, fontFamily: "var(--font-display), Georgia, serif", fontWeight: 500, fontSize: 30, lineHeight: 1.1 } as CSSProperties,
  tile: { display: "flex", alignItems: "center", gap: 12, background: "#121214", border: "1px solid #2A2A2E", borderRadius: 14, padding: "10px 12px", color: "#F4F1EA", textAlign: "left", width: "100%", font: "inherit", cursor: "pointer" } as CSSProperties,
  card: { background: "#121214", border: "1px solid #2A2A2E", borderRadius: 16, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 } as CSSProperties,
  input: { background: "#121214", border: "1px solid #2A2A2E", borderRadius: 12, padding: "12px 14px", color: "#F4F1EA", font: "500 15px var(--font-body), system-ui, sans-serif", width: "100%", boxSizing: "border-box" } as CSSProperties,
  muted: { fontSize: 12, color: "#B8B2A7", lineHeight: 1.5 } as CSSProperties,
};

export function Btn({ children, onClick, kind = "solid", disabled, style }: { children: ReactNode; onClick?: () => void; kind?: "solid" | "ghost" | "outline"; disabled?: boolean; style?: CSSProperties }) {
  const base: CSSProperties = { width: "100%", borderRadius: 999, padding: "15px 16px", font: "800 13px var(--font-body), system-ui, sans-serif", letterSpacing: 1.5, textTransform: "uppercase", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1 };
  const look: CSSProperties = kind === "solid" ? { background: ACCENT, color: "#0B0B0C", border: "none" } : kind === "outline" ? { background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}` } : { background: "transparent", color: "#F4F1EA", border: "1px solid #3A3A3F" };
  return <button type="button" onClick={disabled ? undefined : onClick} style={{ ...base, ...look, ...style }}>{children}</button>;
}

export function Choice({ on, onClick, children, style }: { on: boolean; onClick: () => void; children: ReactNode; style?: CSSProperties }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} style={{ borderRadius: 12, padding: "11px 6px", font: "700 13px var(--font-body), system-ui, sans-serif", cursor: "pointer", ...(on ? { background: ACCENT, color: "#0B0B0C", border: `1px solid ${ACCENT}` } : { background: "#121214", color: "#F4F1EA", border: "1px solid #2A2A2E" }), ...style }}>{children}</button>
  );
}

export function Row({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={on} style={{ ...C.tile, ...(on ? { background: "#1B1A17", border: `1px solid ${ACCENT}` } : {}) }}>{children}</button>;
}

export function Check({ on }: { on: boolean }) {
  return <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 6, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, ...(on ? { background: ACCENT, color: "#0B0B0C" } : { border: "1.5px solid #6F6A62", color: "transparent" }) }}>✓</span>;
}

export function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} style={{ width: 46, height: 28, borderRadius: 14, flex: "none", display: "flex", alignItems: "center", padding: 3, border: "none", cursor: "pointer", background: on ? ACCENT : "#3A3A3F", justifyContent: on ? "flex-end" : "flex-start" }}>
      <span style={{ width: 22, height: 22, borderRadius: 11, background: "#0B0B0C" }} />
    </button>
  );
}

export function Stars() {
  return <span aria-hidden="true" style={{ color: GOLD, letterSpacing: 2, fontSize: 15 }}>★★★★★</span>;
}

export function Ico({ d, size = 18 }: { d: ReactNode; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">{d}</svg>;
}

export function Done({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 16 }}>
      <div style={{ width: 64, height: 64, borderRadius: 32, background: ACCENT, color: "#0B0B0C", display: "flex", alignItems: "center", justifyContent: "center" }}><Ico size={30} d={<path d="m5 12.5 4.5 4.5L19 7.5" />} /></div>
      <h2 style={{ ...C.h1, fontSize: 32 }}>{title}</h2>
      <span style={{ fontSize: 15, color: "#D9D4CA", lineHeight: 1.5 }}>{text}</span>
      {children}
    </div>
  );
}

/** Full-screen demo shell: header, tab bar, a scrolling screen that fits any phone or computer, Back/Next at the bottom. */
export function DemoShell({ title, other, tabs, tab, setTab, children, finish = { label: "Become a partner", href: "/partners#apply" }, banner }: {
  title: string; other: { label: string; href: string }; tabs: string[]; tab: number; setTab: (n: number) => void; children: ReactNode;
  finish?: { label: string; href: string }; banner?: string;
}) {
  const nav = useRef<HTMLElement>(null);
  useEffect(() => { nav.current?.querySelector<HTMLElement>("[aria-current]")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }, [tab]);
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#000", color: "#F4F1EA", fontFamily: "var(--font-body), system-ui, sans-serif" }}>
      <header style={{ flex: "none", borderBottom: "1px solid #1E1E21", background: "#0B0B0C" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "10px 16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <a href="/partners" style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 20, color: "#F4F1EA", textDecoration: "none" }}>Nearest</a>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: GOLD }}>{title}</span>
            <a href={other.href} style={{ fontSize: 12, fontWeight: 700, color: "#F4F1EA" }}>{other.label}</a>
          </div>
          <nav ref={nav} aria-label="Demo steps" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none" }}>
            {tabs.map((t, i) => (
              <button key={t} type="button" onClick={() => setTab(i)} aria-current={i === tab ? "step" : undefined} style={{ flex: "none", borderRadius: 999, padding: "8px 13px", font: "700 12px var(--font-body), system-ui, sans-serif", cursor: "pointer", whiteSpace: "nowrap", ...(i === tab ? { background: ACCENT, color: "#0B0B0C", border: `1px solid ${ACCENT}` } : { background: "transparent", color: "#D9D4CA", border: "1px solid #2A2A2E" }) }}>{i + 1}. {t}</button>
            ))}
          </nav>
        </div>
      </header>
      {banner && <div role="note" style={{ flex: "none", background: "#2B2410", color: "#E9CF8E", textAlign: "center", fontSize: 12, fontWeight: 800, padding: "6px 12px" }}>{banner}</div>}
      <main key={tab} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "18px 16px 24px", display: "flex", flexDirection: "column", gap: 18, minHeight: "100%", boxSizing: "border-box" }}>
          {children}
        </div>
      </main>
      <footer style={{ flex: "none", borderTop: "1px solid #1E1E21", background: "#0B0B0C" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "10px 16px calc(10px + env(safe-area-inset-bottom, 0px))", display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" onClick={() => setTab(Math.max(0, tab - 1))} disabled={tab === 0} style={{ flex: 1, background: "transparent", color: "#F4F1EA", border: "1px solid #3A3A3F", borderRadius: 999, padding: 12, font: "700 13px var(--font-body), system-ui, sans-serif", opacity: tab === 0 ? 0.35 : 1, cursor: "pointer" }}>Back</button>
          <span style={{ fontSize: 12, color: "#8E897F", minWidth: 44, textAlign: "center" }}>{tab + 1} of {tabs.length}</span>
          {tab < tabs.length - 1
            ? <button type="button" onClick={() => setTab(tab + 1)} style={{ flex: 1, background: ACCENT, color: "#0B0B0C", border: "none", borderRadius: 999, padding: 12, font: "800 13px var(--font-body), system-ui, sans-serif", cursor: "pointer" }}>Next: {tabs[tab + 1]}</button>
            : <a href={finish.href} style={{ flex: 1, textAlign: "center", background: ACCENT, color: "#0B0B0C", borderRadius: 999, padding: 12, font: "800 13px var(--font-body), system-ui, sans-serif", textDecoration: "none" }}>{finish.label}</a>}
        </div>
      </footer>
    </div>
  );
}
