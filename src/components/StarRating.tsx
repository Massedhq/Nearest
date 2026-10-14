"use client";
import { useState } from "react";

const STAR = "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z";
const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** Tap 1–5 stars. Nothing is preselected — the supporter picks their own honest rating. */
export function StarRating({ name = "rating", defaultValue = 0, required = true }: { name?: string; defaultValue?: number; required?: boolean }) {
  const [v, setV] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const shown = hover || v;
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="row" role="radiogroup" aria-label="Star rating" style={{ gap: 6 }} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} style={{ cursor: "pointer", lineHeight: 0 }} onMouseEnter={() => setHover(n)}>
            <input type="radio" name={name} value={n} required={required} checked={v === n} onChange={() => setV(n)} style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} aria-label={`${n} star${n > 1 ? "s" : ""}`} />
            <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden="true"><path d={STAR} fill={n <= shown ? "#ECE8E1" : "none"} stroke="#ECE8E1" strokeWidth="1.4" strokeLinejoin="round" /></svg>
          </label>
        ))}
      </div>
      <span className="xs muted">{shown ? `${shown} star${shown > 1 ? "s" : ""} — ${LABELS[shown]}` : "Tap to rate"}</span>
    </div>
  );
}
