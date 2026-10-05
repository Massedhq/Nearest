import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, bookings, membershipDues } from "@/db";
import { duesStatus, isBookingPaid } from "@/lib/dues";
import { requirePro } from "@/lib/pro";
import { fmtDate, money } from "@/lib/time";
import { Tabs } from "@/components/Tabs";
import { Icon } from "@/components/Icon";

export const metadata = { title: "Earnings" };

export default async function Earnings() {
  const { user, profile } = await requirePro();
  const value = sql<number>`coalesce(sum(${bookings.chargedCents} + ${bookings.creditProCents} + ${bookings.creditGeneralCents} - ${bookings.serviceFeeCents} - coalesce(${bookings.stripeFeeCents},0)),0)::int`;
  const [[pending], [released], [held], recent] = await Promise.all([
    db.select({ n: value }).from(bookings).where(and(eq(bookings.proId, user.id), eq(bookings.status, "confirmed"))),
    db.select({ n: value }).from(bookings).where(and(eq(bookings.proId, user.id), eq(bookings.status, "completed"))),
    db.select({ n: sql<number>`coalesce(sum(${bookings.payoutOwedCents}),0)::int` }).from(bookings).where(and(eq(bookings.proId, user.id), sql`${bookings.transferId} is null`)),
    db.select().from(bookings).where(and(eq(bookings.proId, user.id), inArray(bookings.status, ["confirmed", "completed"]))).orderBy(desc(bookings.startsAt)).limit(20),
  ]);
  // Pay-from-bookings: what Nearest kept toward the membership isn't money released to them.
  const bookingPaid = isBookingPaid(profile);
  const [keptOnReleased] = bookingPaid
    ? await db.select({ n: sql<number>`coalesce(sum(${membershipDues.amountCents}),0)::int` }).from(membershipDues)
        .innerJoin(bookings, eq(bookings.id, membershipDues.bookingId))
        .where(and(eq(membershipDues.proId, user.id), eq(bookings.status, "completed")))
    : [{ n: 0 }];
  const dues = bookingPaid ? await duesStatus(profile) : null;
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">Earnings</div><span className="sp" /></div>
      <div className="body">
        <div className="grid2" style={{ gap: 10 }}>
          <div className="card" style={{ padding: 14, gap: 2 }}><span className="xs muted">Pending release</span><span className="stat s">{money(pending.n)}</span></div>
          <div className="card pearl" style={{ padding: 14, gap: 2 }}><span className="xs muted">Released to you</span><span className="stat s">{money(Math.max(0, released.n - keptOnReleased.n))}</span></div>
        </div>
        {dues && (
          <Link className="card" href="/pro/payments" style={{ textDecoration: "none", gap: 4 }}>
            <div className="row between"><span className="small b">Membership from bookings</span><span className={`tag ${dues.left === 0 ? "ok" : ""}`}>{dues.left === 0 ? "Covered" : `${money(dues.collected)} of ${money(dues.rate)}`}</span></div>
            <span className="xs muted">{dues.left === 0 ? "This month's membership is covered — the rest of this month's earnings are all yours." : `Nearest keeps ${money(dues.left)} more from your next released payments this month, then the rest is all yours.`}</span>
          </Link>
        )}
        <p className="xs muted p">Amounts are after card-processing fees. Payments release when the student confirms the appointment. Bank transfer timing is set by Stripe.</p>
        {held.n > 0 && (
          <Link className="card warn" href="/pro/payments" style={{ textDecoration: "none" }}>
            <div className="row"><Icon name="card" /><div className="grow"><div className="b">{money(held.n)} waiting for you</div><div className="xs muted">Nearest is holding this until you set up payouts. It&apos;s sent automatically once your bank is connected.</div></div><Icon name="right" size="s" /></div>
          </Link>
        )}
        <Link className="btn ghost" href="/pro/payments"><Icon name="card" /> {profile.payoutsEnabled ? "Payout dashboard & membership" : "Set up payouts"}</Link>
        <h3 className="eyebrow p">Recent</h3>
        {recent.length === 0 && <p className="small muted p">No bookings yet.</p>}
        {recent.map((b) => (
          <div key={b.id} className="item"><div className="grow small"><div>{b.serviceName}</div><div className="xs muted">{fmtDate(b.startsAt)}</div></div>
            <div className="col g4" style={{ alignItems: "flex-end" }}><span className="num b">{money(b.chargedCents + b.creditProCents + b.creditGeneralCents - (b.stripeFeeCents ?? 0))}</span><span className={`tag ${b.status === "completed" && !b.payoutOwedCents ? "ok" : b.payoutOwedCents ? "warn" : ""}`}>{b.payoutOwedCents ? "Held — set up payouts" : b.status === "completed" ? "Released" : "Pending"}</span></div></div>
        ))}
      </div>
      <Tabs kind="pro" active="Earnings" />
    </div>
  );
}
