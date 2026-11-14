"use client";
import { useState } from "react";

/** A submit button that asks once ("Delete? Yes / No") before the form is sent — no browser pop-up. */
export function ConfirmSubmit({ label, ask, className = "link xs" }: { label: string; ask: string; className?: string }) {
  const [sure, setSure] = useState(false);
  if (!sure) return <button type="button" className={className} onClick={() => setSure(true)}>{label}</button>;
  return (
    <span className="row" style={{ gap: 6, alignItems: "center" }}>
      <span className="xs">{ask}</span>
      <button type="submit" className="link xs b" style={{ color: "#F2A38F" }}>Yes</button>
      <button type="button" className="link xs" onClick={() => setSure(false)}>No</button>
    </span>
  );
}
