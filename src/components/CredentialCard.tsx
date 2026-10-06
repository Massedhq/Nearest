"use client";
import { useState } from "react";

/** The four self-reported professional statuses. Nearest stores the choice only — no documents, numbers or review. */
export const PRO_STATUSES = [
  ["license", "I have my license"],
  ["diploma", "Graduated — license pending"],
  ["enrolled", "Currently enrolled in school"],
  ["self_taught", "I'm self-taught"],
] as const;
export type ProStatus = (typeof PRO_STATUSES)[number][0];

/** One category's status: four stacked choices (full width so long labels never run off the screen). */
export function CredentialCard({ id, name, cur }: { id: number; name: string; cur: { kind: string } | null }) {
  const [mode, setMode] = useState<ProStatus | "">(cur && PRO_STATUSES.some(([k]) => k === cur.kind) ? (cur.kind as ProStatus) : "");
  return (
    <div className="card">
      <input type="hidden" name="categoryId" value={id} />
      <input type="hidden" name={`mode_${id}`} value={mode} />
      <span className="eyebrow">{name}</span>
      <div className="col" role="radiogroup" aria-label={`${name} — your status`} style={{ gap: 6 }}>
        {PRO_STATUSES.map(([m, label]) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} className={`chip${mode === m ? " on" : ""}`}
            style={{ width: "100%", justifyContent: "flex-start", whiteSpace: "normal", textAlign: "left", height: "auto", minHeight: 40, padding: "8px 14px" }}
            onClick={() => setMode(m)}>{label}</button>
        ))}
      </div>
    </div>
  );
}
