"use client";
import { useActionState } from "react";
import { signRepAgreement } from "@/app/rep/actions";

/** Checkbox + typed full legal name. Signing comes before creating the account. */
export function RepAgreementForm({ token, children }: { token: string; children: React.ReactNode }) {
  const [state, action, pending] = useActionState(signRepAgreement, {});
  return (
    <form action={action} className="col" style={{ gap: 14 }}>
      <h2 className="disp h2">Sign the agreement</h2>
      <p className="small p" style={{ margin: 0 }}>Before you create your account, please read and sign the Sales Ambassador Agreement.</p>
      <div style={{ maxHeight: 340, overflowY: "auto", border: "1px solid #2A2A2D", borderRadius: 14, padding: 14, background: "#0E0E10" }} tabIndex={0} aria-label="Sales Ambassador Agreement">
        {children}
      </div>
      <a className="link xs" href="/rep/agreement" target="_blank" rel="noreferrer">Open the agreement in a new tab</a>
      <input type="hidden" name="token" value={token} />
      <label className="check small" style={{ alignItems: "flex-start" }}>
        <input type="checkbox" name="agree" required />
        <span>I have read and agree to the Nearest Sales Ambassador Agreement. I understand I am an independent contractor, not an employee; no payment is guaranteed; I am solely responsible for my own taxes; and disputes are resolved by individual arbitration.</span>
      </label>
      <div className="field">
        <label htmlFor="rep-sign">Type your full legal name to sign</label>
        <input id="rep-sign" name="signature" autoComplete="name" required minLength={4} maxLength={120} placeholder="First and last name" />
      </div>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Signing…" : "Sign and continue"}</button>
    </form>
  );
}
