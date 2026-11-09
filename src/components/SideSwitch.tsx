import { setProSide } from "@/app/pro/side-actions";
import type { Side } from "@/lib/pro-side";

/** Student side ↔ Partner side, for professionals who are also Nearest Partners. Shows nothing for anyone else. */
export function SideSwitch({ side, canSwitch, back }: { side: Side | null; canSwitch: boolean; back: string }) {
  if (!side) return null;
  if (!canSwitch) return <span className="xs muted">Partner side — clients book you from your partner page.</span>;
  const btn = (k: Side, label: string) => (
    <form action={setProSide} style={{ flex: 1 }}>
      <input type="hidden" name="side" value={k} /><input type="hidden" name="back" value={back} />
      <button type="submit" className={`chip${side === k ? " on" : ""}`} aria-pressed={side === k} style={{ width: "100%", justifyContent: "center" }}>{label}</button>
    </form>
  );
  return (
    <div className="col" style={{ gap: 4 }}>
      <div className="row" role="group" aria-label="Which side you're viewing" style={{ gap: 6 }}>{btn("student", "Student side")}{btn("partner", "Partner side")}</div>
      <span className="xs muted">{side === "partner" ? "Partner side: bookings from your partner page — open to anyone, no $150 limit." : "Student side: bookings from verified students in the Nearest app."} Your calendar is shared, so the two never overlap.</span>
    </div>
  );
}
