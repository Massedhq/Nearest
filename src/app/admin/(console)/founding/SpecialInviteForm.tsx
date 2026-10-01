"use client";
import { useActionState, useState } from "react";
import { createSpecialInvite, type FormState } from "@/app/admin/actions";

/** Main owner only: free Ambassador accounts and pay-from-bookings accounts. */
export function SpecialInviteForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createSpecialInvite, {});
  const [kind, setKind] = useState("AMBASSADOR");
  return (
    <form action={action} className="card" style={{ gap: 12, borderColor: "#6B5325" }}>
      <div className="row between"><span className="eyebrow">+ Special invitation</span><span className="tag warn">Only you</span></div>
      <div className="field">
        <label htmlFor="sp-kind">Type of account</label>
        <select id="sp-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="AMBASSADOR">Ambassador — free account</option>
          <option value="BOOKING_PAID">Pay from bookings — monthly rate collected from their bookings</option>
        </select>
      </div>
      <span className="xs muted">
        {kind === "AMBASSADOR"
          ? "Free forever — no sign-up fee, no monthly membership. They share your link, so pros they bring in are credited to you."
          : "Nothing up front. Each month, Nearest keeps this rate out of their booking earnings before paying them the rest. A month with no bookings costs nothing."}
      </span>
      <div className="grid2">
        <div className="field"><label htmlFor="sp-name">Name</label><input id="sp-name" name="name" required /></div>
        <div className="field"><label htmlFor="sp-contact">Email or phone</label><input id="sp-contact" name="contact" required /></div>
        {kind === "BOOKING_PAID" && (
          <div className="field"><label htmlFor="sp-rate">Monthly rate ($)</label><input id="sp-rate" name="rate" type="number" min={1} max={30} step={1} defaultValue={15} required /></div>
        )}
      </div>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      <div className="row between small">
        <span className="muted">Works even when First In is closed</span>
        <button className="btn sm" type="submit" disabled={pending}>{pending ? "Generating…" : "Generate invitation"}</button>
      </div>
    </form>
  );
}
