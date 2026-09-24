import { alias } from "drizzle-orm/pg-core";
import { desc, eq, sql } from "drizzle-orm";
import { db, bookings, users, professionalProfiles } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { requireAdmin } from "@/lib/admin";
import { bookingCode, expireStaleHolds } from "@/lib/bookings";
import { fmtDate, fmtTime, money } from "@/lib/time";

export const metadata = { title: "Bookings" };

const TAG: Record<string, string> = { pending_payment: "warn", confirmed: "ok", completed: "", cancelled_student: "bad", cancelled_pro: "bad", expired: "" };

export default async function Bookings() {
  await requireAdmin();
  await expireStaleHolds();
  const student = alias(users, "student");
  const [rows, counts] = await Promise.all([
    db.select({ b: bookings, sf: student.firstName, sl: student.lastName, pro: professionalProfiles.businessName })
      .from(bookings).innerJoin(student, eq(student.id, bookings.studentId)).innerJoin(professionalProfiles, eq(professionalProfiles.userId, bookings.proId))
      .orderBy(desc(bookings.createdAt)).limit(200),
    db.select({ status: bookings.status, n: sql<number>`count(*)::int` }).from(bookings).groupBy(bookings.status),
  ]);
  const c = (s: string) => counts.find((x) => x.status === s)?.n ?? 0;
  return (
    <>
      <AdminHead eyebrow={`${rows.length} most recent`} title="Bookings" />
      <div className="kpis k6">
        {[["Confirmed", "confirmed"], ["Completed", "completed"], ["Awaiting payment", "pending_payment"], ["Cancelled by student", "cancelled_student"], ["Cancelled by pro", "cancelled_pro"], ["Not completed", "expired"]].map(([l, k]) => (
          <div key={k} className="card" style={{ padding: 12, gap: 2 }}><span className="xs muted">{l}</span><span className="stat s">{c(k)}</span></div>
        ))}
      </div>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Booking</th><th>Student</th><th>Professional</th><th>Service</th><th>When</th><th>Price</th><th>Card</th><th>Credit</th><th>Status</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="empty" colSpan={9}>No bookings yet.</td></tr>}
            {rows.map(({ b, sf, sl, pro }) => (
              <tr key={b.id}>
                <td className="num">{bookingCode(b.number)}</td><td>{sf} {sl}</td><td>{pro}</td><td>{b.serviceName}</td>
                <td>{fmtDate(b.startsAt)} {fmtTime(b.startsAt)}</td><td>{money(b.priceCents)}</td><td>{money(b.chargedCents)}</td><td>{money(b.creditProCents + b.creditGeneralCents)}</td>
                <td><span className={`tag ${TAG[b.status]}`}>{b.status.replace("_", " ")}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
