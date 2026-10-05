import { and, asc, eq, gte, lt, inArray } from "drizzle-orm";
import { db, proHours, proBlocks, bookings, users } from "@/db";
import { requirePro } from "@/lib/pro";
import { WEEKDAYS, label12, fmtDate, fmtTime, chicagoNow, chicagoToUtc } from "@/lib/time";
import { nextDays } from "@/lib/availability";
import { Tabs } from "@/components/Tabs";
import { ActionForm } from "@/components/ActionForm";
import { addBlock, removeBlock, toggleVacation } from "@/app/pro/actions";
import Link from "next/link";

export const metadata = { title: "Calendar" };

export default async function Calendar({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { user, profile } = await requirePro();
  const sp = await searchParams;
  const [hours, blocks] = await Promise.all([
    db.select().from(proHours).where(eq(proHours.userId, user.id)),
    db.select().from(proBlocks).where(and(eq(proBlocks.userId, user.id), gte(proBlocks.endsAt, new Date()))).orderBy(asc(proBlocks.startsAt)),
  ]);
  const today = chicagoNow().date;
  // Week strip + the chosen day's timeline (appointments, blocked time, after-school window)
  const week = nextDays(7);
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : today;
  const dayStart = chicagoToUtc(day, "00:00"), dayEnd = new Date(dayStart.getTime() + 86400_000);
  const dayBookings = await db.select({ b: bookings, first: users.firstName, last: users.lastName }).from(bookings).innerJoin(users, eq(users.id, bookings.studentId))
    .where(and(eq(bookings.proId, user.id), inArray(bookings.status, ["confirmed", "completed", "no_show"]), gte(bookings.startsAt, dayStart), lt(bookings.startsAt, dayEnd))).orderBy(asc(bookings.startsAt));
  const dayBlocks = blocks.filter((x) => x.startsAt < dayEnd && x.endsAt > dayStart);
  const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
  const after = hours.find((x) => x.kind === "after_school" && x.weekday === wd);
  type Ev = { at: Date; node: React.ReactNode };
  const events: Ev[] = [
    ...dayBlocks.map((x) => ({ at: x.startsAt, node: <div className="card small" style={{ borderStyle: "dashed", padding: 12 }}>🔒 Blocked{x.reason ? ` — ${x.reason}` : ""}<span className="xs muted" style={{ display: "block" }}>{fmtTime(x.startsAt)} – {fmtTime(x.endsAt)}</span></div> })),
    ...(after ? [{ at: chicagoToUtc(day, after.startTime), node: <div className="card small" style={{ padding: 12 }}><span className="eyebrow">After-school window</span><span className="xs muted">{label12(after.startTime)} – {label12(after.endTime)}</span></div> }] : []),
    ...dayBookings.map(({ b, first, last }) => ({ at: b.startsAt, node: <Link href={`/pro/appointments/${b.id}`} className="card pearl" style={{ padding: 12, textDecoration: "none" }}><span className="b small">{b.serviceName} • {first} {last ? `${last[0]}.` : ""}</span><span className="xs muted">{fmtTime(b.startsAt)} – {fmtTime(b.endsAt)}{b.status !== "confirmed" ? ` • ${b.status.replace("_", "-")}` : ""}</span></Link> })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const line = (kind: string, d: number) => {
    const h = hours.find((x) => x.kind === kind && x.weekday === d);
    return h ? `${label12(h.startTime)} – ${label12(h.endTime)}` : "Closed";
  };
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">Calendar</div><span className="sp" /></div>
      <div className="body">
        <div className="row between"><span className="b">{fmtDate(new Date(`${day}T12:00:00Z`), { month: "long", year: "numeric" })}</span><Link className="link small" href="/pro/calendar">Today</Link></div>
        <div className="row" style={{ gap: 6, overflowX: "auto" }}>
          {week.map((d) => { const dt = new Date(`${d}T12:00:00Z`); return (
            <Link key={d} href={`/pro/calendar?day=${d}`} className={`slot${d === day ? " on" : ""}`} style={{ flexDirection: "column", height: 64, minWidth: 48, gap: 0, textDecoration: "none" }}>
              <span className="xs">{fmtDate(dt, { weekday: "narrow" })}</span><span className="b">{dt.getUTCDate()}</span>
            </Link>); })}
        </div>
        <div className="col" style={{ gap: 8 }}>
          {events.length === 0 && <div className="card small"><span className="muted">Nothing on {fmtDate(new Date(`${day}T12:00:00Z`), { weekday: "long" })} yet.</span></div>}
          {events.map((e, i) => <div key={i} className="row top-a" style={{ gap: 10 }}><span className="xs muted" style={{ width: 64, flex: "none", paddingTop: 12 }}>{fmtTime(e.at)}</span><div className="grow">{e.node}</div></div>)}
        </div>
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
        <p className="xs muted p">Appointments and booking requests will appear here as clients book you.</p>
      </div>
      <Tabs kind="pro" active="Calendar" />
    </div>
  );
}
