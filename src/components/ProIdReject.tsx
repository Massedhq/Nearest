"use client";
import { useActionState } from "react";
import { rejectProId } from "@/app/admin/student-actions";
import type { FormState } from "./ActionForm";

export function ProIdReject({ userId }: { userId: string }) {
  const [state, run, pending] = useActionState<FormState, FormData>(rejectProId, {});
  return (
    <form action={run} className="col" style={{ gap: 8 }}>
      <input type="hidden" name="userId" value={userId} />
      <label className="lbl" htmlFor={`pn_${userId}`}>What should they fix?</label>
      <select id={`pn_${userId}`} name="note" className="ainput" defaultValue="">
        <option value="" disabled>Choose a reason</option>
        <option>Your ID photo is blurry or cut off. Please retake it in good light.</option>
        <option>Your selfie doesn&apos;t clearly match the photo on your ID.</option>
        <option>Your ID looks expired. Please use a current driver&apos;s license or state ID.</option>
        <option>The name on your ID doesn&apos;t match your account. Please use your legal name.</option>
      </select>
      {state.error && <p className="err">{state.error}</p>}
      {state.ok && <p className="okmsg">{state.ok}</p>}
      <button className="btn danger sm" type="submit" disabled={pending}>Send back</button>
    </form>
  );
}
