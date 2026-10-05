"use client";
import { useState } from "react";

/** Scrollable Professional Terms — the "I agree" box unlocks once they've scrolled to the end. */
export function ProTermsAgreement({ sections, version }: { sections: { h: string; p: string[] }[]; version: string }) {
  const [read, setRead] = useState(false);
  return (
    <div className="col" style={{ gap: 8 }}>
      <span className="small b">Nearest Professional Terms</span>
      <div
        role="region" aria-label="Nearest Professional Terms" tabIndex={0}
        onScroll={(e) => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) setRead(true); }}
        style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #2A2A2D", borderRadius: 12, padding: "12px 14px", background: "#0E0E10", fontSize: 13, lineHeight: 1.55 }}
      >
        {sections.map((s) => (
          <div key={s.h} style={{ marginBottom: 12 }}>
            <div className="b" style={{ marginBottom: 4 }}>{s.h}</div>
            {s.p.map((x, i) => <p key={i} style={{ margin: "0 0 6px" }}>{x}</p>)}
          </div>
        ))}
        <p className="xs muted" style={{ margin: 0 }}>Version {version}</p>
      </div>
      {!read && <span className="xs muted">Scroll to the end of the terms to continue.</span>}
      <label className="check xs" style={{ alignItems: "flex-start", opacity: read ? 1 : 0.5 }}>
        <input type="checkbox" name="acceptTerms" required disabled={!read} />
        <span>I&apos;ve read and agree to the Nearest Professional Terms, including the membership rate above, which activates when I accept my first booking.</span>
      </label>
      <input type="hidden" name="termsVersion" value={version} />
    </div>
  );
}
