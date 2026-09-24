"use client";
import { useActionState } from "react";
import { rejectPro } from "@/app/admin/pro-actions";
import type { FormState } from "./ActionForm";

export function RejectForm({ userId }: { userId: string }) {
  const [state, run, pending] = useActionState<FormState, FormData>(rejectPro, {});
  return (
    <form action={run} className="col" style={{ gap: 8 }}>
      <input type="hidden" name="userId" value={userId} />
      <label className="lbl" htmlFor={`note_${userId}`}>What should they change?</label>
      <textarea id={`note_${userId}`} name="note" className="ainput" style={{ height: 70, padding: 10 }} />
      {state.error && <p className="err">{state.error}</p>}
      {state.ok && <p className="okmsg">{state.ok}</p>}
      <button className="btn danger sm" type="submit" disabled={pending}>Request changes</button>
    </form>
  );
}
