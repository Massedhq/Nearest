import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, bookings, users, partnerPages } from "@/db";
import { requirePro } from "@/lib/pro";
import { bookingCode } from "@/lib/bookings";
import { fmtDate, fmtTime, money } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import Link from "next/link";
import { Icon } from "@/components/Icon";

export const metadata = { title: "Appointments" };

export default async function Appointments({ searchParams }: { searchParams: Promise<{ declined?: string; side?: string }> }) {
  const { user } = await requirePro();
  const sp = await searchParams;
  const declined = sp.declined;
  // Partners keep their two sides apart (2026-11-09): Student bookings (Nearest student app) and Partner bookings (their partner page).
  const isPartner = Boolean(await db.query.partnerPages.findFirst({ where: eq(partnerPages.userId, user.id), columns: { userId: true } }));
  const side = isPartner && sp.side === "partner" ? "partner" : "student";
  const onSide = isPartner ? eq(bookings.channel, side) : undefined;
  const [requests, upcoming, past] = await Promise.all([
    db.select({ b: bookings, first: users.firstName }).from(bookings).innerJoin(users, eq(users.id, bookings.studentId))
      .where(and(eq(bookings.proId, user.id), onSide, eq(bookings.status, "requested"))).orderBy(asc(bookings.startsAt)).limit(50),
    db.select({ b: bookings, first: users.firstName, last: users.lastName }).from(bookings).innerJoin(users, eq(users.id, bookings.studentId))
      .where(and(eq(bookings.proId, user.id), onSide, eq(bookings.status, "confirmed"))).orderBy(asc(bookings.startsAt)).limit(100),
    db.select({ b: bookings, first: users.firstName, last: users.lastName }).from(bookings).innerJoin(users, eq(users.id, bookings.studentId))
      .where(and(eq(bookings.proId, user.id), onSide, inArray(bookings.status, ["completed", "cancelled_student", "cancelled_pro"]))).orderBy(desc(bookings.startsAt)).limit(30),
  ]);
  return (
    <div className="scr">
      <TopBar title="Appointments" back="/pro/home" />
      <div className="body">
        {isPartner && (
          <div className="row" style={{ gap: 8 }}>
            <Link className={`chip${side === "student" ? " on" : ""}`} href="/pro/appointments">Student bookings</Link>
            <Link className={`chip${side === "partner" ? " on" : ""}`} href="/pro/appointments?side=partner">Partner bookings</Link>
          </div>
        )}
        {isPartner && <span className="xs muted">{side === "partner" ? "Booked from your partner page — open to anyone, no $150 limit." : "Booked by verified students in the Nearest app."} Your calendar is shared, so the two never overlap.</span>}
        {declined && <div className="card small"><span>Request declined — the client wasn&apos;t charged.</span></div>}
        {requests.length > 0 && (
          <>
            <h3 className="eyebrow p">Booking requests ({requests.length})</h3>
            {requests.map(({ b, first }) => (
              <Link key={b.id} className="card warn" href={`/pro/appointments/${b.id}`} style={{ textDecoration: "none", color: "inherit", gap: 4 }}>
                <div className="row between"><span className="b">{b.serviceName}</span><span className="tag warn">Request</span></div>
                <div className="small">{fmtDate(b.startsAt, { weekday: "long", month: "short", day: "numeric" })} • {fmtTime(b.startsAt)}</div>
                <div className="row between small"><span>{first} • {b.channel === "partner" ? "Partner client" : "Verified Student"}</span><span className="b">{money(b.priceCents - b.inviteDiscountCents)}</span></div>
                <span className="xs muted">Tap to accept or decline.</span>
              </Link>
            ))}
          </>
        )}
        <h3 className="eyebrow p">Upcoming</h3>
        {upcoming.length === 0 && <p className="small muted p">No upcoming appointments.</p>}
        {upcoming.map(({ b, first, last }) => (
          <div key={b.id} className="card">
            <div className="row between"><span className="b">{b.serviceName}</span><span className="xs muted">#{bookingCode(b.number)}</span></div>
            <div className="small">{fmtDate(b.startsAt, { weekday: "long", month: "short", day: "numeric" })} • {fmtTime(b.startsAt)} – {fmtTime(b.endsAt)}</div>
            <div className="row between small"><span>{first} {last?.[0]}. • {b.channel === "partner" ? "Partner client" : "Verified Student"}</span><span className="b">{money(b.priceCents - b.inviteDiscountCents)}{b.inviteDiscountCents > 0 && <span className="tag ok" style={{ marginLeft: 6 }}>Invite reward −{money(b.inviteDiscountCents)}</span>}</span></div>
            <span className="xs muted">Paid in full • held until the {b.channel === "partner" ? "client" : "student"} releases it</span>
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
