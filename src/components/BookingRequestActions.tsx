"use client";
import { useActionState } from "react";
import { acceptBookingRequest, declineBookingRequest, activateAndAccept, type AcceptState } from "@/app/pro/request-actions";

/** Accept / Decline a booking request. If the membership isn't active, the first-booking activation screen opens. */
export function BookingRequestActions({ id }: { id: string }) {
  const [state, run, pending] = useActionState<AcceptState, FormData>(acceptBookingRequest, {});
  const rate = state.rateCents ? `$${(state.rateCents / 100).toFixed(state.rateCents % 100 ? 2 : 0)}` : "$11";
  return (
    <>
      <div className="grid2" style={{ gap: 8 }}>
        <form action={run}><input type="hidden" name="id" value={id} /><button className="btn" type="submit" disabled={pending} style={{ width: "100%" }}>{pending ? "Checking…" : "Accept booking"}</button></form>
        <form action={declineBookingRequest}><input type="hidden" name="id" value={id} /><button className="btn ghost" type="submit" style={{ width: "100%" }}>Decline</button></form>
      </div>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      {state.needsActivation && (
        <div role="dialog" aria-modal="true" aria-labelledby="act-h" style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.72)", display: "grid", placeItems: "center", padding: 16 }}>
          <div className="card" style={{ maxWidth: 420, width: "100%", gap: 12, padding: 22, background: "#111113" }}>
            <span id="act-h" className="disp h2">Congratulations! You received your first booking request 🎉</span>
            <span className="small">A client is ready to book with you.</span>
            <span className="small">As agreed during enrollment, your {rate === "$11" ? "First In membership is $11/month" : `membership is ${rate}/month`} for your first year.</span>
            <span className="small">Activate your membership to accept this booking and begin receiving appointments through Nearest.</span>
            <form action={activateAndAccept}><input type="hidden" name="id" value={id} /><button className="btn" type="submit" style={{ width: "100%" }}>Activate &amp; accept booking — {rate}/mo</button></form>
            <form action="" onSubmit={(e) => { e.preventDefault(); window.location.reload(); }}><button className="btn ghost" type="submit" style={{ width: "100%" }}>Not now</button></form>
            <span className="xs muted">&ldquo;Not now&rdquo; keeps the request waiting — you can come back to it until it expires.</span>
          </div>
        </div>
      )}
    </>
  );
}
