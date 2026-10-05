"use client";
import { useActionState, useState } from "react";
import Link from "next/link";

export type FormState = { error?: string; ok?: string };
type Action = (prev: FormState, form: FormData) => Promise<FormState>;

/** A form wired to a server action, with an inline error/success line and a pending button. */
export function ActionForm({
  action, children, submitLabel = "Save", className = "col g16", buttonClass = "btn", laterLabel, afterOk,
}: { action: Action; children: React.ReactNode; submitLabel?: string; className?: string; buttonClass?: string; laterLabel?: string; afterOk?: React.ReactNode }) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  const [triedLater, setTriedLater] = useState(false);
  return (
    <form action={run} className={className}>
      {children}
      {state.error && <p className="err" role="alert">{state.error}</p>}
      {state.ok && <p className="okmsg" role="status">{state.ok}</p>}
      {state.ok && afterOk}
      <button className={buttonClass} type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
      {laterLabel && <button className="btn ghost" type="submit" name="later" value="1" formNoValidate disabled={pending} onClick={() => setTriedLater(true)}>{laterLabel}</button>}
      {laterLabel && triedLater && state.error && <Link className="link small" href="/pro/home" style={{ textAlign: "center" }}>Leave without saving this step — your earlier steps are saved</Link>}
    </form>
  );
}
