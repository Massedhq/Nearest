"use client";
import { useState } from "react";
import { Icon } from "./Icon";
import { INSURANCE_CHOICES, INSURANCE_INTERESTS, PROTECTION_DISCLAIMER, PROTECTION_INTRO, PROTECTION_MODELS } from "@/lib/insurance";

/**
 * Professional Protection: three self-reported choices, plus which coverage model interests them. Fields go inside
 * an existing form (name="insuranceChoice" / "insuranceInterest"). Nothing about an actual policy is ever asked.
 */
export function ProProtectionFields({ choice: c0 = "", interest: i0 = "" }: { choice?: string | null; interest?: string | null }) {
  const [choice, setChoice] = useState(c0 ?? "");
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        <span className="badge" aria-hidden="true" style={{ marginTop: 2 }}><Icon name="shield" /></span>
        <div className="col" style={{ gap: 2 }}>
          <span className="b">Professional Protection</span>
          <span className="small">Your business deserves protection.</span>
        </div>
      </div>
      <span className="small">{PROTECTION_INTRO}</span>
      <div className="col" style={{ gap: 8 }}>
        {PROTECTION_MODELS.map((m) => (
          <details key={m.key} className="card" style={{ gap: 6, padding: 12 }}>
            <summary className="row between" style={{ cursor: "pointer", listStyle: "none", gap: 8 }}>
              <span className="b small">{m.title}</span>
              <span className="small">{m.price} <span className="xs muted">(proposed)</span></span>
            </summary>
            <span className="xs muted">How it would work if it&apos;s introduced:</span>
            <ul className="xs" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>{m.how.map((h) => <li key={h}>{h}</li>)}</ul>
          </details>
        ))}
      </div>
      <span className="xs muted">{PROTECTION_DISCLAIMER}</span>

      <fieldset className="col" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}>
        <legend className="b small" style={{ marginBottom: 6 }}>Tell us your insurance preference</legend>
        {(Object.entries(INSURANCE_CHOICES) as [string, string][]).map(([k, label]) => (
          <label key={k} className="check small"><input type="radio" name="insuranceChoice" value={k} checked={choice === k} onChange={() => setChoice(k)} /><span>{label}</span></label>
        ))}
      </fieldset>
      {choice === "interested" && (
        <fieldset className="col" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}>
          <legend className="b small" style={{ marginBottom: 6 }}>Which option interests you?</legend>
          {(Object.entries(INSURANCE_INTERESTS) as [string, string][]).map(([k, label]) => (
            <label key={k} className="check small"><input type="radio" name="insuranceInterest" value={k} defaultChecked={i0 === k} required /><span>{label}</span></label>
          ))}
        </fieldset>
      )}
      {choice === "has" && <span className="xs muted">Thanks — that&apos;s all we need. We don&apos;t ask for your insurer, policy or documents.</span>}
      {choice === "not_now" && <span className="xs muted">No problem — you can change this anytime under Business → Professional Protection.</span>}
    </div>
  );
}
