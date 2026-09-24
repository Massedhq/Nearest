"use client";
import { useActionState } from "react";
import { rejectStudent } from "@/app/admin/student-actions";
import type { FormState } from "./ActionForm";

export function StudentReject({ userId }: { userId: string }) {
  const [state, run, pending] = useActionState<FormState, FormData>(rejectStudent, {});
  return (
    <form action={run} className="col" style={{ gap: 8 }}>
      <input type="hidden" name="userId" value={userId} />
      <label className="lbl" htmlFor={`sn_${userId}`}>What should they fix?</label>
      <select id={`sn_${userId}`} name="note" className="ainput" defaultValue="">
        <option value="" disabled>Choose a reason</option>
        <option>Your school ID photo is blurry or cut off. Please retake it in good light.</option>
        <option>The school on your ID doesn&apos;t match the school you chose.</option>
        <option>Your selfie doesn&apos;t clearly match the photo on your ID.</option>
        <option>Your ID looks expired. Please use a current school ID.</option>
      </select>
      {state.error && <p className="err">{state.error}</p>}
      {state.ok && <p className="okmsg">{state.ok}</p>}
      <button className="btn danger sm" type="submit" disabled={pending}>Send back</button>
    </form>
  );
}
