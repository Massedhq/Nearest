"use client";
import { useActionState, useState } from "react";
import { completeTask } from "@/app/task-actions";

/**
 * Finish a task with its report: a summary + one block per call, email, text or visit (date/time, how, organization,
 * address, who, their title, phone/email, outcome, notes, next step) + optional cards for the first place.
 * Rows are added in the browser; the server re-checks every field (completeTask).
 */
type State = { error?: string; ok?: string };
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Chicago" });
const now = () => new Date().toLocaleTimeString("en-GB", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit" });

export function TaskReportForm({ id, outcomes, how, needsCalls, boss = "the owner" }: { id: string; outcomes: string[]; how: Record<string, string>; needsCalls: boolean; boss?: string }) {
  const [state, run, pending] = useActionState<State, FormData>(completeTask, {});
  const [rows, setRows] = useState<number[]>(needsCalls ? [0] : []);
  const [next, setNext] = useState(1);
  if (state.ok) return <p className="okmsg" role="status">{state.ok} {boss} was told.</p>;
  return (
    <form action={run} className="col" style={{ gap: 14 }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="count" value={Math.max(0, ...rows.map((r) => r + 1))} />
      {rows.map((r, i) => (
        <div key={r} className="callrow">
          <div className="row between"><span className="eyebrow">Call / visit {i + 1}</span>{rows.length > (needsCalls ? 1 : 0) && <button type="button" className="link xs" onClick={() => setRows(rows.filter((x) => x !== r))}>Remove</button>}</div>
          <div className="grid2">
            <div className="grid2">
              <div className="field"><label>Date</label><input name={`c${r}_date`} type="date" defaultValue={today()} required /></div>
              <div className="field"><label>Time</label><input name={`c${r}_time`} type="time" defaultValue={now()} required /></div>
            </div>
            <div className="field"><label>How</label><select name={`c${r}_how`} defaultValue="call">{Object.entries(how).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="field"><label>Organization or business</label><input name={`c${r}_org`} maxLength={160} required placeholder="Boys & Girls Club — Frisco" /></div>
            <div className="field"><label>Address (street, city, ZIP)</label><input name={`c${r}_address`} maxLength={200} required placeholder="1224 E 7th St, Frisco, TX 75034" /></div>
            <div className="field"><label>Who you talked to</label><input name={`c${r}_person`} maxLength={120} required placeholder="Ms. Johnson (or Front desk / Voicemail)" /></div>
            <div className="field"><label>Their title</label><input name={`c${r}_title`} maxLength={120} placeholder="Program director" /></div>
            <div className="field"><label>Their phone or email</label><input name={`c${r}_contact`} maxLength={200} /></div>
            <div className="field"><label>Outcome</label><select name={`c${r}_outcome`} required defaultValue=""><option value="" disabled>Choose…</option>{outcomes.map((o) => <option key={o}>{o}</option>)}</select></div>
          </div>
          <div className="field"><label>What they said</label><textarea name={`c${r}_notes`} maxLength={1000} placeholder="They hand out resources every Thursday. Wants 10 cards." /></div>
          <div className="field"><label>Next step</label><input name={`c${r}_next`} maxLength={300} placeholder="Drop off cards Thursday 3 PM, front desk" /></div>
        </div>
      ))}
      <button type="button" className="btn ghost sm" onClick={() => { setRows([...rows, next]); setNext(next + 1); }}>+ Add a call or visit</button>
      <div className="field"><label>Summary for {boss}</label><textarea name="summary" maxLength={3000} required placeholder="Called 6 places. 2 want cards, 1 pop-up possible in December. Call back Grace Church Monday." /></div>
      <div className="field"><label>Cards to ask for (for the first place above, optional)</label><input name="cards" type="number" min={0} max={50} placeholder="10" /></div>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Sending…" : "Mark complete and send report"}</button>
    </form>
  );
}
