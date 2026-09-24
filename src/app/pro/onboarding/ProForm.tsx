"use client";
import { useActionState } from "react";
import { completePro, type FormState } from "./actions";

export function ProForm({ firstName, lastName, invite }: { firstName: string; lastName: string; invite: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(completePro, {});
  return (
    <form action={action} className="col g16">
      <input type="hidden" name="invite" value={invite ?? ""} />
      <div className="grid2">
        <div className="field"><label htmlFor="firstName">Legal first name</label><input id="firstName" name="firstName" defaultValue={firstName} autoComplete="given-name" required /></div>
        <div className="field"><label htmlFor="lastName">Legal last name</label><input id="lastName" name="lastName" defaultValue={lastName} autoComplete="family-name" required /></div>
      </div>
      <div className="field"><label htmlFor="dob">Date of birth</label><input id="dob" name="dob" type="date" autoComplete="bday" required /></div>
      <p className="xs muted p">Your legal name and date of birth are used for identity verification and are never shown publicly.</p>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Continue"}</button>
    </form>
  );
}
