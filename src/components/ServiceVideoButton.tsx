"use client";
import { useEffect, useState } from "react";

/**
 * "360° view available" on a service in a list. Tapping it opens the service's 360° video in a small pop-up
 * (Close, or tap outside / Escape). Optional Book button inside the pop-up.
 */
export function ServiceVideoButton({ url, name, bookHref, accent = "#E3C58A" }: { url: string; name: string; bookHref?: string | null; accent?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`360° view available — play the video of ${name}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, alignSelf: "flex-start", background: "transparent", color: accent, border: `1px solid ${accent}`, borderRadius: 999, padding: "3px 9px", font: "800 11px var(--font-body), sans-serif", cursor: "pointer", marginTop: 3 }}>
        <span aria-hidden="true" style={{ width: 0, height: 0, borderLeft: `7px solid ${accent}`, borderTop: "4px solid transparent", borderBottom: "4px solid transparent" }} />
        360° view available
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={`360° video of ${name}`} onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#0B0B0C", color: "#F4F1EA", border: "1px solid #2A2A2E", borderRadius: 18, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <b style={{ fontSize: 14 }}>{name} — 360° view</b>
              <button type="button" onClick={() => setOpen(false)} style={{ background: "transparent", border: "1px solid #2A2A2E", color: "#F4F1EA", borderRadius: 999, padding: "6px 12px", font: "700 12px var(--font-body), sans-serif", cursor: "pointer" }}>Close</button>
            </div>
            <video src={url} controls autoPlay playsInline muted loop style={{ width: "100%", maxHeight: "70vh", borderRadius: 12, background: "#000" }} />
            {bookHref && <a href={bookHref} style={{ textAlign: "center", background: accent, color: "#0B0B0C", borderRadius: 12, padding: "12px 14px", fontWeight: 800, textDecoration: "none" }}>Book {name}</a>}
          </div>
        </div>
      )}
    </>
  );
}
