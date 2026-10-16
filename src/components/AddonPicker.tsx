"use client";
import { useRef } from "react";
import { money } from "@/lib/time";

type A = { id: string; name: string; priceCents: number; extraMin: number };

/**
 * Student: tick add-ons for a service. It reloads the page with them (?a=…) so the open times account for the extra
 * length and the total updates. Add-ons that would take the booking over the $150 limit can't be ticked.
 */
export function AddonPicker({ action, addons, chosen, baseCents, capCents, hidden }: { action: string; addons: A[]; chosen: string[]; baseCents: number; capCents: number; hidden: Record<string, string> }) {
  const form = useRef<HTMLFormElement>(null);
  const picked = addons.filter((a) => chosen.includes(a.id));
  const total = baseCents + picked.reduce((t, a) => t + a.priceCents, 0);
  return (
    <form ref={form} method="get" action={action} className="card" style={{ gap: 8 }}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <span className="eyebrow">Add-ons (optional)</span>
      {addons.map((a) => {
        const on = chosen.includes(a.id);
        const tooMuch = !on && total + a.priceCents > capCents;
        return (
          <label key={a.id} className={`check small${on ? " on" : ""}`} style={tooMuch ? { opacity: 0.5 } : undefined}>
            <input type="checkbox" name="a" value={a.id} defaultChecked={on} disabled={tooMuch} onChange={() => form.current?.requestSubmit()} />
            <span className="grow">{a.name}{a.extraMin ? <span className="xs muted"> • +{a.extraMin} min</span> : null}{tooMuch ? <span className="xs muted"> • over the ${capCents / 100} limit</span> : null}</span>
            <span className="b">+{money(a.priceCents)}</span>
          </label>
        );
      })}
      <noscript><button className="btn ghost sm" type="submit">Update</button></noscript>
      <span className="xs muted">Bookings on Nearest are ${capCents / 100} or less, including add-ons.</span>
    </form>
  );
}
