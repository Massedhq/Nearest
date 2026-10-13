"use client";
import { useState } from "react";

type Mode = "regular" | "after_school" | "both";
const OPTIONS: [Mode, string, string][] = [
  ["regular", "Regular hours", "Your normal weekly schedule"],
  ["after_school", "After-school hours", "Weekdays after school only"],
  ["both", "Both", "Regular hours plus after-school times"],
];

/** Hours step: the pro picks Regular, After-school or Both — only the chosen schedule(s) show and are saved. */
export function HoursChoice({ initial, regular, afterSchool }: { initial: Mode; regular: React.ReactNode; afterSchool: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>(initial);
  return (
    <>
      <div className="field">
        <label>Which hours do you offer?</label>
        {OPTIONS.map(([v, l, d]) => (
          <label key={v} className={`check${mode === v ? " on" : ""}`} style={{ alignItems: "flex-start" }}>
            <input type="radio" name="hoursMode" value={v} checked={mode === v} onChange={() => setMode(v)} />
            <span className="col" style={{ gap: 2 }}><span className="b small">{l}</span><span className="xs muted">{d}</span></span>
          </label>
        ))}
      </div>
      <div className="card" style={{ display: mode === "after_school" ? "none" : undefined }}>
        <span className="eyebrow">Regular hours</span>
        {regular}
      </div>
      <div className="card" style={{ display: mode === "regular" ? "none" : undefined }}>
        <span className="eyebrow">After-school hours</span>
        <span className="xs muted">Check the weekdays you&apos;ll take students after school.</span>
        {afterSchool}
      </div>
    </>
  );
}
