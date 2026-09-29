"use client";
import { useState, useTransition } from "react";
import { setPortfolioService } from "@/app/pro/actions";

/** "Which service is this?" under a portfolio photo — keeps the choice on screen and saves it right away. */
export function PhotoServiceSelect({ id, value, services }: { id: string; value: string | null; services: { id: string; name: string }[] }) {
  const [chosen, setChosen] = useState(value ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="col" style={{ gap: 2 }}>
      <select value={chosen} aria-label="Service shown in this photo" disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          setChosen(next); setSaved(false);
          const f = new FormData(); f.set("id", id); f.set("serviceId", next);
          start(async () => { await setPortfolioService(f); setSaved(true); });
        }}
        style={{ width: "100%", fontSize: 12, padding: "6px 8px", borderRadius: 10 }}>
        <option value="">Which service is this?</option>
        {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <span className="xs muted" aria-live="polite">{pending ? "Saving…" : saved ? (chosen ? "Saved ✓" : "Cleared") : ""}</span>
    </div>
  );
}
