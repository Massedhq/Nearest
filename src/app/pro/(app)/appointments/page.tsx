import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, bookings, users } from "@/db";
import { requirePro } from "@/lib/pro";
import { bookingCode } from "@/lib/bookings";
import { fmtDate, fmtTime, money } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import Link from "next/link";
import { Icon } from "@/components/Icon";

export const metadata = { title: "Appointments" };

export default async function Appointments() {
  const { user } = await requirePro();
  const [upcoming, past] = await Promise.all([
    db.select({ b: bookings, first: users.firstName, last: users.lastName }).from(bookings).innerJoin(users, eq(users.id, bookings.studentId))
      .where(and(eq(bookings.proId, user.id), eq(bookings.status, "confirmed"))).orderBy(asc(bookings.startsAt)).limit(100),
    db.select({ b: bookings, first: users.firstName, last: users.lastName }).from(bookings).innerJoin(users, eq(users.id, bookings.studentId))
      .where(and(eq(bookings.proId, user.id), inArray(bookings.status, ["completed", "cancelled_student", "cancelled_pro"]))).orderBy(desc(bookings.startsAt)).limit(30),
  ]);
  return (
    <div className="scr">
      <TopBar title="Appointments" back="/pro/home" />
      <div className="body">
        <h3 className="eyebrow p">Upcoming</h3>
        {upcoming.length === 0 && <p className="small muted p">No upcoming appointments.</p>}
        {upcoming.map(({ b, first, last }) => (
          <div key={b.id} className="card">
            <div className="row between"><span className="b">{b.serviceName}</span><span className="xs muted">#{bookingCode(b.number)}</span></div>
            <div className="small">{fmtDate(b.startsAt, { weekday: "long", month: "short", day: "numeric" })} • {fmtTime(b.startsAt)} – {fmtTime(b.endsAt)}</div>
            <div className="row between small"><span>{first} {last?.[0]}. • Verified Student</span><span className="b">{money(b.priceCents)}</span></div>
            <span className="xs muted">Paid in full • held until the student releases it</span>
            <Link className="btn ghost sm" href={`/pro/appointments/${b.id}`} style={{ width: "100%" }}>{b.checkedInAt ? <><Icon name="check" size="s" /> Client checked in — open</> : "Open appointment"}</Link>
          </div>
        ))}
        {past.length > 0 && <h3 className="eyebrow p">Past &amp; cancelled</h3>}
        {past.map(({ b, first }) => (
          <div key={b.id} className="item"><div className="grow small"><div className="b">{b.serviceName}</div><div className="xs muted">{first} • {fmtDate(b.startsAt)}</div></div><span className={`tag ${b.status === "completed" ? "ok" : "bad"}`}>{b.status === "completed" ? "Completed" : "Cancelled"}</span></div>
        ))}
      </div>
    </div>
  );
}
