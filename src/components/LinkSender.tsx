"use client";
import { useActionState, useEffect } from "react";
import { CopyButton } from "./CopyButton";

type State = { error?: string; ok?: string; link?: string };
type Action = (prev: State, form: FormData) => Promise<State>;

/**
 * Sends a sign-in link two ways: Email it, or Copy it to send yourself (text, DM). Either way the link shows with a
 * Copy button. Each tap makes a new link and the earlier one stops working.
 */
export function LinkSender({ action, fields, emailLabel, copyLabel = "Copy the link", primary = false }: { action: Action; fields: Record<string, string>; emailLabel: string; copyLabel?: string; primary?: boolean }) {
  const [state, run, pending] = useActionState<State, FormData>(action, {});
  useEffect(() => { if (state.link) navigator.clipboard?.writeText(state.link).catch(() => {}); }, [state.link]);
  return (
    <form action={run} className="col g8">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className={primary ? "btn sm" : "btn ghost sm"} style={{ width: "auto" }} type="submit" name="via" value="email" disabled={pending}>{pending ? "Working…" : emailLabel}</button>
        <button className="btn ghost sm" style={{ width: "auto" }} type="submit" name="via" value="copy" disabled={pending}>{copyLabel}</button>
      </div>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      {state.ok && <p className="okmsg small" role="status">{state.ok}</p>}
      {state.link && (
        <div className="card" style={{ gap: 6, padding: 12 }}>
          <span className="small" style={{ wordBreak: "break-all" }}>{state.link}</span>
          <CopyButton text={state.link} />
        </div>
      )}
    </form>
  );
}
