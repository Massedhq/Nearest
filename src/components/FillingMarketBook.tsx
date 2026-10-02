"use client";
import { useState } from "react";

/** City not open yet: a greyed-out Book button that explains briefly when tapped. */
export function FillingMarketBook() {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
      <button className="btn dis sm" type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>Book</button>
      {open && (
        <span role="status" className="card small" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 230, zIndex: 5, gap: 2, boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}>
          <span className="b">We&apos;re currently filling this market.</span>
          <span className="muted">You&apos;ll be the first to know when booking opens.</span>
        </span>
      )}
    </span>
  );
}
