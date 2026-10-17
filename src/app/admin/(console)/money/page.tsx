import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db, bookings, credits, professionalProfiles, membershipPayments } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { requireAdmin } from "@/lib/admin";
import { money } from "@/lib/time";

export const metadata = { title: "Money" };

export default async function Money() {
  await requireAdmin();
  const since = new Date(Date.now() - 30 * 86400000);
  const n = sql<number>`count(*)::int`;
  const [subs, volume, held, released, fees, creditOut, generalOut, collected] = await Promise.all([
    db.select({ entry: sql<string>`coalesce(${professionalProfiles.entryType}, 'STANDARD')`, rate: sql<number>`coalesce(${professionalProfiles.monthlyRateCents}, 3000)::int`, status: professionalProfiles.subscriptionStatus, n })
      .from(professionalProfiles).groupBy(sql`coalesce(${professionalProfiles.entryType}, 'STANDARD')`, sql`coalesce(${professionalProfiles.monthlyRateCents}, 3000)`, professionalProfiles.subscriptionStatus),
    db.select({ v: sql<number>`coalesce(sum(${bookings.chargedCents}),0)::int`, n }).from(bookings).where(and(inArray(bookings.status, ["confirmed", "completed", "cancelled_student", "cancelled_pro"]), gte(bookings.paidAt, since))),
    db.select({ v: sql<number>`coalesce(sum(${bookings.priceCents}),0)::int`, n }).from(bookings).where(eq(bookings.status, "confirmed")),
    db.select({ v: sql<number>`coalesce(sum(${bookings.priceCents} - coalesce(${bookings.stripeFeeCents},0)),0)::int`, n }).from(bookings).where(and(eq(bookings.status, "completed"), gte(bookings.releasedAt, since))),
    db.select({ v: sql<number>`coalesce(sum(${bookings.stripeFeeCents}),0)::int` }).from(bookings).where(gte(bookings.paidAt, since)),
    db.select({ v: sql<number>`coalesce(sum(${credits.amountCents}),0)::int` }).from(credits),
    db.select({ v: sql<number>`coalesce(sum(${credits.amountCents}),0)::int` }).from(credits).where(isNull(credits.proId)),
    db.select({ v: sql<number>`coalesce(sum(${membershipPayments.amountCents}),0)::int` }).from(membershipPayments).where(gte(membershipPayments.paidAt, since)),
  ]);
  const ENTRIES = [["FIRST_IN", "First In", 1100], ["PRO_STUDENT", "Professional + Student", 1600], ["GENERAL", "General Entry", 2100], ["STANDARD", "Standard", 3000]] as const;
  const paying = subs.filter((s) => s.status === "active" || s.status === "trialing");
  const mrr = paying.reduce((a, s) => a + s.n * s.rate, 0);
  const pastDue = subs.filter((s) => s.status === "past_due" || s.status === "unpaid").reduce((a, s) => a + s.n, 0);
  const { MEMBERSHIP_ENABLED } = await import("@/lib/membership");
  // No monthly membership: Nearest's revenue is the service fee kept on completed bookings (services + Model Calls).
  const [[svcFees], [mcFees], [oldSubs]] = await Promise.all([
    db.select({ v: sql<number>`coalesce(sum(${bookings.serviceFeeCents}),0)::int`, n }).from(bookings).where(and(eq(bookings.status, "completed"), gte(bookings.releasedAt, since), isNull(bookings.modelCallId))),
    db.select({ v: sql<number>`coalesce(sum(${bookings.serviceFeeCents}),0)::int`, n }).from(bookings).where(and(eq(bookings.status, "completed"), gte(bookings.releasedAt, since), sql`${bookings.modelCallId} is not null`)),
    db.select({ n }).from(professionalProfiles).where(and(sql`${professionalProfiles.subscriptionId} is not null`, isNull(professionalProfiles.membershipEndsAt), inArray(professionalProfiles.subscriptionStatus, ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]))),
  ]);
  return (
    <>
      <AdminHead eyebrow="Kept separate: Nearest's revenue vs. professionals' money" title="Money" />
      <div className="acols even">
        {!MEMBERSHIP_ENABLED ? (
        <div className="card" style={{ gap: 12 }}>
          <div className="row between"><span className="eyebrow">Service fees — Nearest revenue</span><span className="tag solid">Nearest</span></div>
          <div className="kpis k3">
            <div className="card" style={{ gap: 6 }}><span className="xs muted">Kept (30d)</span><span className="stat">{money(svcFees.v + mcFees.v)}</span></div>
            <div className="card" style={{ gap: 6 }}><span className="xs muted">Services</span><span className="stat">{money(svcFees.v)}</span><span className="xs muted">{svcFees.n} completed</span></div>
            <div className="card" style={{ gap: 6 }}><span className="xs muted">Model Calls</span><span className="stat">{money(mcFees.v)}</span><span className="xs muted">{mcFees.n} completed</span></div>
          </div>
          <span className="xs muted">No monthly membership — Nearest earns the service fee on each completed booking. The fee is added on top of the pro&apos;s price, and card processing comes out of the pro&apos;s payout.</span>
          <div className="row between small"><span className="muted">Old memberships still being cancelled</span><span>{oldSubs.n === 0 ? "None — all done" : `${oldSubs.n} (the hourly job cancels them; no further charges)`}</span></div>
          <div className="row between small"><span className="muted">Old membership payments collected (30d)</span><span>{money(collected[0].v)}</span></div>
        </div>
        ) : (
        <div className="card" style={{ gap: 12 }}>
          <div className="row between"><span className="eyebrow">Memberships — Nearest revenue</span><span className="tag solid">Nearest</span></div>
          <div className="kpis k3">
            <div className="card" style={{ gap: 6 }}><span className="xs muted">MRR</span><span className="stat">{money(mrr)}</span></div>
            <div className="card" style={{ gap: 6 }}><span className="xs muted">Paying</span><span className="stat">{paying.reduce((a, s) => a + s.n, 0)}</span></div>
            <div className="card" style={{ gap: 6 }}><span className="xs muted">Past due</span><span className="stat">{pastDue}</span></div>
          </div>
          <table className="tbl"><thead><tr><th>Entry</th><th>Price</th><th>Paying</th><th>Past due</th></tr></thead><tbody>
            {ENTRIES.map(([k, label, cents]) => (
              <tr key={k}><td>{label}</td><td>{money(cents)}/mo</td>
                <td>{subs.filter((s) => s.entry === k && (s.status === "active" || s.status === "trialing")).reduce((a, s) => a + s.n, 0)}</td>
                <td>{subs.filter((s) => s.entry === k && (s.status === "past_due" || s.status === "unpaid")).reduce((a, s) => a + s.n, 0)}</td></tr>
            ))}
          </tbody></table>
          <div className="row between small"><span className="muted">Membership payments collected (30d)</span><span>{money(collected[0].v)}</span></div>
          {pastDue > 0 && <span className="tag bad" style={{ alignSelf: "flex-start" }}>{pastDue} past due</span>}
        </div>
        )}
        <div className="card" style={{ gap: 12 }}>
          <div className="row between"><span className="eyebrow">Bookings — professionals&apos; money</span><span className="tag">Pass-through</span></div>
          <div className="kpis k3">
            <div className="card" style={{ gap: 6 }}><span className="xs muted">Card payments (30d)</span><span className="stat">{money(volume[0].v)}</span></div>
            <div className="card" style={{ gap: 6 }}><span className="xs muted">Held now</span><span className="stat">{money(held[0].v)}</span></div>
            <div className="card" style={{ gap: 6 }}><span className="xs muted">Released (30d)</span><span className="stat">{money(released[0].v)}</span></div>
          </div>
          <div className="row between small"><span className="muted">Card-processing fees (30d, paid by pros)</span><span>{money(fees[0].v)}</span></div>
        </div>
        <div className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Student credits outstanding</span>
          <div className="row between"><span>All credits</span><span className="b">{money(creditOut[0].v)}</span></div>
          <div className="row between small"><span className="muted">General Nearest credit (any pro)</span><span>{money(generalOut[0].v)}</span></div>
          <div className="row between small"><span className="muted">Tied to a specific pro</span><span>{money(creditOut[0].v - generalOut[0].v)}</span></div>
        </div>
      </div>
    </>
  );
}
