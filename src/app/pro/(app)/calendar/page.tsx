import { and, asc, eq, gte } from "drizzle-orm";
import { db, proHours, proBlocks } from "@/db";
import { requirePro } from "@/lib/pro";
import { WEEKDAYS, label12, fmtDate, fmtTime, chicagoNow } from "@/lib/time";
import { Tabs } from "@/components/Tabs";
import { ActionForm } from "@/components/ActionForm";
import { addBlock, removeBlock, toggleVacation } from "@/app/pro/actions";
import Link from "next/link";

export const metadata = { title: "Calendar" };

export default async function Calendar() {
  const { user, profile } = await requirePro();
  const [hours, blocks] = await Promise.all([
    db.select().from(proHours).where(eq(proHours.userId, user.id)),
    db.select().from(proBlocks).where(and(eq(proBlocks.userId, user.id), gte(proBlocks.endsAt, new Date()))).orderBy(asc(proBlocks.startsAt)),
  ]);
  const today = chicagoNow().date;
  const line = (kind: string, d: number) => {
    const h = hours.find((x) => x.kind === kind && x.weekday === d);
    return h ? `${label12(h.startTime)} – ${label12(h.endTime)}` : "Closed";
  };
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">Calendar</div><span className="sp" /></div>
      <div className="body">
        <div className="card">
          <div className="row between">
            <div><div className="b">Vacation mode</div><div className="xs muted">Hides all openings and model calls from new bookings</div></div>
            <form action={toggleVacation}><button className={`toggle${profile.vacationMode ? " on" : ""}`} type="submit" aria-pressed={profile.vacationMode} aria-label="Vacation mode" /></form>
          </div>
        </div>
        <div className="card">
          <div className="row between"><span className="eyebrow">Weekly hours</span><Link className="link small" href="/pro/setup/hours?edit=1">Edit</Link></div>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <div key={d} className="row between small"><span>{WEEKDAYS[d]}</span><span className={line("regular", d) === "Closed" ? "muted" : ""}>{line("regular", d)}</span></div>
          ))}
          {profile.acceptsAfterSchool && (
            <>
              <span className="eyebrow" style={{ marginTop: 6 }}>After school</span>
              {[1, 2, 3, 4, 5].map((d) => (
                <div key={d} className="row between small"><span>{WEEKDAYS[d]}</span><span className={line("after_school", d) === "Closed" ? "muted" : ""}>{line("after_school", d)}</span></div>
              ))}
            </>
          )}
        </div>
        <div className="card">
          <span className="eyebrow">Block time</span>
          <ActionForm action={addBlock} submitLabel="Block this time" buttonClass="btn sm">
            <div className="field"><label htmlFor="day">Date</label><input id="day" name="day" type="date" min={today} required /></div>
            <div className="grid2">
              <div className="field"><label htmlFor="start">From</label><input id="start" name="start" type="time" required /></div>
              <div className="field"><label htmlFor="end">To</label><input id="end" name="end" type="time" required /></div>
            </div>
            <div className="field"><label htmlFor="reason">Note (only you see this)</label><input id="reason" name="reason" placeholder="Personal" /></div>
          </ActionForm>
        </div>
        {blocks.length > 0 && <h3 className="eyebrow p">Upcoming blocked time</h3>}
        {blocks.map((b) => (
          <div key={b.id} className="item">
            <div className="grow small"><div className="b">{fmtDate(b.startsAt)}</div><div className="xs muted">{fmtTime(b.startsAt)} – {fmtTime(b.endsAt)}{b.reason ? ` • ${b.reason}` : ""}</div></div>
            <form action={removeBlock}><input type="hidden" name="id" value={b.id} /><button className="link small" type="submit">Remove</button></form>
          </div>
        ))}
        <p className="xs muted p">Appointments will appear here once booking opens.</p>
      </div>
      <Tabs kind="pro" active="Calendar" />
    </div>
  );
}
