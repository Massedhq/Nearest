"use client";
import { useActionState } from "react";

export type FormState = { error?: string; ok?: string };
type Action = (prev: FormState, form: FormData) => Promise<FormState>;

/** A form wired to a server action, with an inline error/success line and a pending button. */
export function ActionForm({
  action, children, submitLabel = "Save", className = "col g16", buttonClass = "btn",
}: { action: Action; children: React.ReactNode; submitLabel?: string; className?: string; buttonClass?: string }) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form action={run} className={className}>
      {children}
      {state.error && <p className="err" role="alert">{state.error}</p>}
      {state.ok && <p className="okmsg" role="status">{state.ok}</p>}
      <button className={buttonClass} type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}
