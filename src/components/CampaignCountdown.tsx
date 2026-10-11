"use client";
import { useEffect, useState } from "react";

/** Live countdown to the server-calculated completion time (start + 168 hours). Display only — the server decides. */
export function CampaignCountdown({ startedAt, completesAt }: { startedAt: string; completesAt: string }) {
  const start = new Date(startedAt).getTime(), end = new Date(completesAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (now === null) return <span className="stat" aria-live="off">—</span>;
  const left = Math.max(0, end - now);
  const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  const d = Math.floor(left / 86400000), h = Math.floor((left % 86400000) / 3600000), m = Math.floor((left % 3600000) / 60000), s = Math.floor((left % 60000) / 1000);
  return (
    <div className="col" style={{ gap: 6 }}>
      {left > 0 ? (
        <span className="stat" style={{ fontVariantNumeric: "tabular-nums" }} aria-label={`${d} days ${h} hours ${m} minutes left`}>
          {d}d {String(h).padStart(2, "0")}h {String(m).padStart(2, "0")}m {String(s).padStart(2, "0")}s
        </span>
      ) : (
        <span className="stat">168 hours complete</span>
      )}
      <div aria-hidden="true" style={{ height: 6, borderRadius: 3, background: "#242427", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#ECE8E1" }} />
      </div>
      <span className="xs muted">{left > 0 ? `${(((now - start) / 3600000)).toFixed(1)} of 168 hours elapsed` : "Elapsed time complete — waiting for final evidence and manual review."}</span>
    </div>
  );
}
