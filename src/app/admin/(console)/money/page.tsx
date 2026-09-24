import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db, bookings, credits, professionalProfiles } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { requireAdmin } from "@/lib/admin";
import { money } from "@/lib/time";

export const metadata = { title: "Money" };

export default async function Money() {
  await requireAdmin();
  const since = new Date(Date.now() - 30 * 86400000);
  const n = sql<number>`count(*)::int`;
  const [subs, volume, held, released, fees, creditOut, generalOut] = await Promise.all([
    db.select({ cohort: professionalProfiles.cohort, status: professionalProfiles.subscriptionStatus, n }).from(professionalProfiles).groupBy(professionalProfiles.cohort, professionalProfiles.subscriptionStatus),
    db.select({ v: sql<number>`coalesce(sum(${bookings.chargedCents}),0)::int`, n }).from(bookings).where(and(inArray(bookings.status, ["confirmed", "completed", "cancelled_student", "cancelled_pro"]), gte(bookings.paidAt, since))),
    db.select({ v: sql<number>`coalesce(sum(${bookings.priceCents}),0)::int`, n }).from(bookings).where(eq(bookings.status, "confirmed")),
    db.select({ v: sql<number>`coalesce(sum(${bookings.priceCents} - coalesce(${bookings.stripeFeeCents},0)),0)::int`, n }).from(bookings).where(and(eq(bookings.status, "completed"), gte(bookings.releasedAt, since))),
    db.select({ v: sql<number>`coalesce(sum(${bookings.stripeFeeCents}),0)::int` }).from(bookings).where(gte(bookings.paidAt, since)),
    db.select({ v: sql<number>`coalesce(sum(${credits.amountCents}),0)::int` }).from(credits),
    db.select({ v: sql<number>`coalesce(sum(${credits.amountCents}),0)::int` }).from(credits).where(isNull(credits.proId)),
  ]);
  const rate: Record<string, number> = { FOUNDING: 1000, SECOND: 2000, STANDARD: 3000 };
  const paying = subs.filter((s) => s.status === "active");
  const trial = subs.filter((s) => s.status === "trialing").reduce((a, s) => a + s.n, 0);
  const mrr = paying.reduce((a, s) => a + s.n * rate[s.cohort], 0);
  const pastDue = subs.filter((s) => s.status === "past_due" || s.status === "unpaid").reduce((a, s) => a + s.n, 0);
  return (
    <>
      <AdminHead eyebrow="Kept separate: Nearest's revenue vs. professionals' money" title="Money" />
      <div className="acols even">
        <div className="card" style={{ gap: 12 }}>
          <div className="row between"><span className="eyebrow">Memberships — Nearest revenue</span><span className="tag solid">Nearest</span></div>
          <div className="kpis k3">
            <div className="card" style={{ gap: 6 }}><span className="xs muted">MRR</span><span className="stat">{money(mrr)}</span></div>
            <div className="card" style={{ gap: 6 }}><span className="xs muted">Paying</span><span className="stat">{paying.reduce((a, s) => a + s.n, 0)}</span></div>
            <div className="card" style={{ gap: 6 }}><span className="xs muted">In free trial</span><span className="stat">{trial}</span></div>
          </div>
          <table className="tbl"><thead><tr><th>Cohort</th><th>Price</th><th>Active</th><th>Trial</th></tr></thead><tbody>
            {(["FOUNDING", "SECOND", "STANDARD"] as const).map((c) => (
              <tr key={c}><td>{c}</td><td>{money(rate[c])}/mo</td><td>{subs.find((s) => s.cohort === c && s.status === "active")?.n ?? 0}</td><td>{subs.find((s) => s.cohort === c && s.status === "trialing")?.n ?? 0}</td></tr>
            ))}
          </tbody></table>
          {pastDue > 0 && <span className="tag bad" style={{ alignSelf: "flex-start" }}>{pastDue} past due</span>}
        </div>
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
