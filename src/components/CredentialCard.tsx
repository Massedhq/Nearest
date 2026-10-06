"use client";
import { useState } from "react";

/** The four self-reported professional statuses — one for the whole account. Nearest stores the choice only. */
export const PRO_STATUSES = [
  ["licensed", "I have my license"],
  ["license_pending", "Graduated — license pending"],
  ["currently_enrolled", "Currently enrolled in school"],
  ["self_taught", "I'm self-taught"],
] as const;
export type ProStatus = (typeof PRO_STATUSES)[number][0];
export const PRO_STATUS_LABEL: Record<string, string> = Object.fromEntries(PRO_STATUSES);

/** Professional status: four stacked choices (full width so long labels never run off the screen). */
export function ProStatusPicker({ current }: { current: string | null }) {
  const [v, setV] = useState<string>(current ?? "");
  return (
    <div className="card" style={{ gap: 8 }}>
      <input type="hidden" name="professionalStatus" value={v} />
      <span className="small">Select the option that best describes you.</span>
      <div className="col" role="radiogroup" aria-label="Professional status" style={{ gap: 6 }}>
        {PRO_STATUSES.map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={v === k} className={`chip${v === k ? " on" : ""}`}
            style={{ width: "100%", justifyContent: "flex-start", whiteSpace: "normal", textAlign: "left", height: "auto", minHeight: 40, padding: "8px 14px" }}
            onClick={() => setV(k)}>{label}</button>
        ))}
      </div>
    </div>
  );
}
