"use client";
import { useState } from "react";

/** Model Call timing: a set date & time, or "open time" where each model picks from the pro's availability. */
export function ModelCallWhen({ today, maxDay }: { today: string; maxDay: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="col" style={{ gap: 10 }}>
      <label className="check"><input type="checkbox" name="flexible" checked={open} onChange={(e) => setOpen(e.target.checked)} />
        <span><span className="b">Open time</span> — each model picks a time from your available hours</span></label>
      {open ? (
        <div className="field">
          <label htmlFor="openUntil">Open until (optional)</label>
          <input id="openUntil" name="openUntil" type="date" min={today} max={maxDay} />
          <span className="xs muted">Models can book any open time in your calendar up to this date. Leave blank for the next 30 days.</span>
        </div>
      ) : (
        <div className="grid2">
          <div className="field"><label htmlFor="day">Date</label><input id="day" name="day" type="date" min={today} required /></div>
          <div className="field"><label htmlFor="time">Time</label><input id="time" name="time" type="time" required /></div>
        </div>
      )}
    </div>
  );
}
