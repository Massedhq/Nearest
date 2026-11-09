import Link from "next/link";
import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

/**
 * The partner-side booking look (matches the Nearest Partner demo): black page, the partner's photo and name on top,
 * a "Step N of 3" bar, dark tiles with a blush accent. Used by every /link/<slug>/book… page and the bundle page.
 */
export const P_ACCENT = "#E8C4C0";
export const P_GOLD = "#D4B886";
export const PS = {
  eyebrow: { fontSize: 11, letterSpacing: 2, color: "#B8B2A7", textTransform: "uppercase", fontWeight: 700 } as CSSProperties,
  h1: { margin: 0, fontFamily: "var(--font-display), Georgia, serif", fontWeight: 500, fontSize: 30, lineHeight: 1.1 } as CSSProperties,
  tile: { display: "flex", alignItems: "center", gap: 12, background: "#121214", border: "1px solid #2A2A2E", borderRadius: 14, padding: "10px 12px", color: "#F4F1EA", textAlign: "left", width: "100%", textDecoration: "none", boxSizing: "border-box" } as CSSProperties,
  tileOn: { background: "#1B1A17", border: `1px solid ${P_ACCENT}` } as CSSProperties,
  card: { background: "#121214", border: "1px solid #2A2A2E", borderRadius: 16, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 } as CSSProperties,
  muted: { fontSize: 12, color: "#B8B2A7", lineHeight: 1.5 } as CSSProperties,
  btn: { display: "block", width: "100%", boxSizing: "border-box", textAlign: "center", borderRadius: 999, padding: "15px 16px", font: "800 13px var(--font-body), system-ui, sans-serif", letterSpacing: 1.5, textTransform: "uppercase", background: P_ACCENT, color: "#0B0B0C", border: "none", textDecoration: "none", cursor: "pointer" } as CSSProperties,
  ghost: { display: "block", width: "100%", boxSizing: "border-box", textAlign: "center", borderRadius: 999, padding: "15px 16px", font: "800 13px var(--font-body), system-ui, sans-serif", letterSpacing: 1.5, textTransform: "uppercase", background: "transparent", color: "#F4F1EA", border: "1px solid #3A3A3F", textDecoration: "none" } as CSSProperties,
  choice: (on: boolean) => ({ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 12, padding: "11px 6px", font: "700 13px var(--font-body), system-ui, sans-serif", textDecoration: "none", ...(on ? { background: P_ACCENT, color: "#0B0B0C", border: `1px solid ${P_ACCENT}` } : { background: "#121214", color: "#F4F1EA", border: "1px solid #2A2A2E" }) }) as CSSProperties,
};

export const STEP_LABELS = ["Service", "Day & time", "Review & pay"];

export function PartnerBookShell({ name, photo, back, step, children }: { name: string; photo: string | null; back: string; step?: 1 | 2 | 3; children: ReactNode }) {
  return (
    <div className="pbook" style={{ minHeight: "100dvh", background: "#000", color: "#F4F1EA", fontFamily: "var(--font-body), system-ui, sans-serif" }}>
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "18px 16px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href={back} aria-label="Back" style={{ width: 38, height: 38, borderRadius: 19, border: "1px solid #2A2A2E", display: "flex", alignItems: "center", justifyContent: "center", color: "#F4F1EA", textDecoration: "none", flex: "none" }}>
            <svg aria-hidden="true" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M15 5 8 12l7 7" /></svg>
          </Link>
          {photo
            ? <Image src={photo} alt="" width={38} height={38} style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover", border: `1px solid ${P_ACCENT}`, flex: "none" }} />
            : <span style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${P_ACCENT}`, flex: "none" }} />}
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 19, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
            <span style={{ fontSize: 11, color: "#B8B2A7" }}>Booked and paid securely on Nearest</span>
          </span>
        </div>
        {step && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#B8B2A7", fontWeight: 700 }}>Step {step} of 3 · {STEP_LABELS[step - 1]}</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 4 }}>{[1, 2, 3].map((n) => <span key={n} style={{ height: 4, borderRadius: 2, background: n <= step ? P_ACCENT : "#2A2A2E" }} />)}</div>
          </div>
        )}
        {children}
        <span style={{ textAlign: "center", fontSize: 12, color: "#6F6A62", marginTop: 8 }}>Powered by Nearest</span>
      </main>
    </div>
  );
}
