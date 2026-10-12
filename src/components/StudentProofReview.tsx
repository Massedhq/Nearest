"use client";
import { useActionState } from "react";
import { rejectStudent, requestClearerProof } from "@/app/admin/student-actions";
import { PROOF_CLEARER_REASONS, PROOF_REJECT_REASONS } from "@/lib/enrollment-proof";
import type { FormState } from "./ActionForm";

/** Enrollment proof: Request clearer proof (keeps the selfie) or Reject with a reason. Approve is the normal Verify student button. */
export function StudentProofReview({ userId }: { userId: string }) {
  const [clear, runClear, pendingClear] = useActionState<FormState, FormData>(requestClearerProof, {});
  const [rej, runRej, pendingRej] = useActionState<FormState, FormData>(rejectStudent, {});
  return (
    <div className="col" style={{ gap: 14 }}>
      <form action={runClear} className="col" style={{ gap: 8 }}>
        <input type="hidden" name="userId" value={userId} />
        <label className="lbl" htmlFor={`cp_${userId}`}>Request clearer proof</label>
        <select id={`cp_${userId}`} name="note" className="ainput" defaultValue="">
          <option value="" disabled>Choose what&apos;s unclear</option>
          {PROOF_CLEARER_REASONS.map((r) => <option key={r}>{r}</option>)}
        </select>
        <input name="other" className="ainput" placeholder="Or write your own note" maxLength={300} />
        {clear.error && <p className="err">{clear.error}</p>}
        {clear.ok && <p className="okmsg">{clear.ok}</p>}
        <button className="btn ghost sm" type="submit" disabled={pendingClear}>Ask for a clearer document</button>
      </form>
      <form action={runRej} className="col" style={{ gap: 8 }}>
        <input type="hidden" name="userId" value={userId} />
        <label className="lbl" htmlFor={`pr_${userId}`}>Reject</label>
        <select id={`pr_${userId}`} name="note" className="ainput" defaultValue="">
          <option value="" disabled>Choose a reason</option>
          {PROOF_REJECT_REASONS.map((r) => <option key={r}>{r}</option>)}
        </select>
        <input name="other" className="ainput" placeholder="Or write your own reason" maxLength={300} />
        {rej.error && <p className="err">{rej.error}</p>}
        {rej.ok && <p className="okmsg">{rej.ok}</p>}
        <button className="btn danger sm" type="submit" disabled={pendingRej}>Reject</button>
      </form>
    </div>
  );
}
