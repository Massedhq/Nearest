"use client";
import { useState } from "react";
import { AddressAutocomplete } from "./AddressAutocomplete";

/** Where the appointment happens. Shown only when the pro travels (or offers both). */
export function WherePicker({ mode, proCity, travelFee = 0 }: { mode: "travel" | "both"; proCity: string; travelFee?: number }) {
  const [where, setWhere] = useState<"pro" | "student">(mode === "travel" ? "student" : "pro");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  return (
    <div className="card" style={{ gap: 12 }}>
      <span className="eyebrow">Where</span>
      {mode === "both" && (
        <div className="grid2">
          <label className={`check${where === "pro" ? " on" : ""}`}><input type="radio" name="where" value="pro" checked={where === "pro"} onChange={() => setWhere("pro")} />At the pro&apos;s place ({proCity})</label>
          <label className={`check${where === "student" ? " on" : ""}`}><input type="radio" name="where" value="student" checked={where === "student"} onChange={() => setWhere("student")} />They come to me{travelFee ? ` (+$${(travelFee / 100).toFixed(0)})` : ""}</label>
        </div>
      )}
      {where === "student" && (
        <>
          <AddressAutocomplete id="street" name="street" label="Your street address" required onPick={(a) => { setCity(a.city); setZip(a.zip); }} />
          <div className="field"><label htmlFor="unit">Apt, suite, unit (optional)</label><input id="unit" name="unit" placeholder="Apt 4B" autoComplete="address-line2" /></div>
          <div className="grid2">
            <div className="field"><label htmlFor="city">City</label><input id="city" name="city" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} required /></div>
            <div className="field"><label htmlFor="zip">ZIP</label><input id="zip" name="zip" inputMode="numeric" maxLength={5} autoComplete="postal-code" value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))} required /></div>
          </div>
          {travelFee > 0 && <span className="small b">Travel fee: ${(travelFee / 100).toFixed(2)} — added to your total because your professional comes to you.</span>}
          <span className="xs muted">Only your professional sees this, starting at 12:00 AM on the appointment day.</span>
        </>
      )}
      {where === "pro" && <span className="xs muted">The address is shared at 12:00 AM on your appointment day.</span>}
    </div>
  );
}
