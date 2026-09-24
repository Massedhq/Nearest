"use client";
import { useActionState } from "react";
import { completeStudent, type FormState } from "./actions";

export function StudentForm({ firstName, lastName }: { firstName: string; lastName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(completeStudent, {});
  return (
    <form action={action} className="col g16">
      <div className="grid2">
        <div className="field"><label htmlFor="firstName">First name</label><input id="firstName" name="firstName" defaultValue={firstName} autoComplete="given-name" required /></div>
        <div className="field"><label htmlFor="lastName">Last name</label><input id="lastName" name="lastName" defaultValue={lastName} autoComplete="family-name" required /></div>
      </div>
      <div className="field"><label htmlFor="dob">Date of birth</label><input id="dob" name="dob" type="date" autoComplete="bday" required /></div>
      <p className="xs muted p">Your date of birth is never shown publicly.</p>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Continue"}</button>
    </form>
  );
}
