"use client";
import { useState } from "react";

/** Where the appointment happens. Shown only when the pro travels (or offers both). */
export function WherePicker({ mode, proCity }: { mode: "travel" | "both"; proCity: string }) {
  const [where, setWhere] = useState<"pro" | "student">(mode === "travel" ? "student" : "pro");
  return (
    <div className="card" style={{ gap: 12 }}>
      <span className="eyebrow">Where</span>
      {mode === "both" && (
        <div className="grid2">
          <label className={`check${where === "pro" ? " on" : ""}`}><input type="radio" name="where" value="pro" checked={where === "pro"} onChange={() => setWhere("pro")} />At the pro&apos;s place ({proCity})</label>
          <label className={`check${where === "student" ? " on" : ""}`}><input type="radio" name="where" value="student" checked={where === "student"} onChange={() => setWhere("student")} />They come to me</label>
        </div>
      )}
      {where === "student" && (
        <>
          <div className="field"><label htmlFor="street">Your address</label><input id="street" name="street" autoComplete="street-address" required /></div>
          <div className="grid2">
            <div className="field"><label htmlFor="city">City</label><input id="city" name="city" autoComplete="address-level2" required /></div>
            <div className="field"><label htmlFor="zip">ZIP</label><input id="zip" name="zip" inputMode="numeric" maxLength={5} autoComplete="postal-code" required /></div>
          </div>
          <span className="xs muted">Only your professional sees this, starting at 12:00 AM on the appointment day.</span>
        </>
      )}
      {where === "pro" && <span className="xs muted">The address is shared at 12:00 AM on your appointment day.</span>}
    </div>
  );
}
