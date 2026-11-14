"use client";
import { useState } from "react";

/**
 * Nearest Cards → Set up a distributor's GRANTED cards: how many of EACH reward students can reveal — any mix of
 * $5 / $10 / $20 / $30 / $40 off plus free services — with a running total of cards.
 */
export const MIX_AMOUNTS = [5, 10, 20, 30, 40];

export function ScratchRewardMix({ field }: { field: React.CSSProperties }) {
  const [n, setN] = useState<Record<string, string>>({ d10: "900", free: "100" });
  const num = (k: string) => Math.max(0, Math.floor(Number(n[k] ?? 0)) || 0);
  const discounts = MIX_AMOUNTS.reduce((t, a) => t + num(`d${a}`), 0);
  const free = num("free");
  const row = (key: string, label: string, name: string) => (
    <label key={key} className="row between" style={{ gap: 10, alignItems: "center" }}>
      <span className="small">{label}</span>
      <input name={name} inputMode="numeric" value={n[key] ?? ""} placeholder="0" onChange={(e) => setN({ ...n, [key]: e.target.value.replace(/\D/g, "").slice(0, 6) })}
        style={{ ...field, width: 110, textAlign: "right" }} aria-label={`How many ${label}`} />
    </label>
  );
  return (
    <div className="col" style={{ gap: 6 }}>
      <span className="xs muted">How many of each — mix them any way you like (leave 0 for any you don&apos;t want).</span>
      {MIX_AMOUNTS.map((a) => row(`d${a}`, `$${a} off`, `d${a}`))}
      {row("free", "Free service", "freeCount")}
      <span className="small b">{discounts.toLocaleString()} discount{discounts === 1 ? "" : "s"} + {free.toLocaleString()} free service{free === 1 ? "" : "s"} = {(discounts + free).toLocaleString()} cards</span>
    </div>
  );
}
