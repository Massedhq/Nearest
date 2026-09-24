import { and, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { db, studentProfiles, professionalProfiles, fines, users } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { finesPastTermination } from "@/lib/enforcement";
import { fmtDate, money } from "@/lib/time";
import { liftStudent, reverseNoShow, waiveFine, liftPro, runChecks } from "@/app/admin/enforce-actions";

export const metadata = { title: "Enforcement" };

const REASON: Record<string, string> = { no_shows: "Too many no-shows", incomplete_completion: "Left without finishing", admin: "Paused by admin" };

export default async function Enforcement() {
  await requireAdmin();
  const now = new Date();
  const [students, noShows, openFines, pros, stale] = await Promise.all([
    db.select({ s: studentProfiles, u: users }).from(studentProfiles).innerJoin(users, eq(users.id, studentProfiles.userId)).where(gt(studentProfiles.bookingSuspendedUntil, now)).orderBy(desc(studentProfiles.bookingSuspendedUntil)),
    db.select({ s: studentProfiles, u: users }).from(studentProfiles).innerJoin(users, eq(users.id, studentProfiles.userId)).where(gt(studentProfiles.noShowCount, 0)).orderBy(desc(studentProfiles.noShowCount)).limit(50),
    db.select({ f: fines, biz: professionalProfiles.businessName }).from(fines).innerJoin(professionalProfiles, eq(professionalProfiles.userId, fines.proId)).where(eq(fines.status, "outstanding")).orderBy(fines.dueAt),
    db.select({ p: professionalProfiles }).from(professionalProfiles).where(and(isNotNull(professionalProfiles.suspendedUntil), gt(professionalProfiles.suspendedUntil, now))),
    finesPastTermination(),
  ]);
  const [paid] = await db.select({ n: sql<number>`count(*)::int` }).from(fines).where(eq(fines.status, "paid"));
  return (
    <>
      <AdminHead eyebrow="Fines, suspensions and corrections" title="Enforcement" />
      <div className="kpis k4">
        <div className="card" style={{ gap: 6 }}><span className="xs muted">Outstanding fines</span><span className="stat">{money(openFines.reduce((a, x) => a + x.f.amountCents, 0))}</span><span className="xs muted">{openFines.length} fine{openFines.length === 1 ? "" : "s"} • {paid.n} paid</span></div>
        <div className="card" style={{ gap: 6 }}><span className="xs muted">Past due (profile hidden)</span><span className="stat">{openFines.filter((x) => x.f.dueAt < now).length}</span></div>
        <div className="card" style={{ gap: 6 }}><span className="xs muted">Pros suspended</span><span className="stat">{pros.length}</span></div>
        <div className="card" style={{ gap: 6 }}><span className="xs muted">Students suspended</span><span className="stat">{students.length}</span></div>
      </div>
      {stale.length > 0 && <div className="card bad small"><span className="b">{stale.length} fine{stale.length === 1 ? " has" : "s have"} been unpaid 30+ days.</span><span>These accounts are eligible for removal. Nothing happens automatically — decide case by case.</span></div>}
      <div className="card" style={{ gap: 10 }}>
        <div className="row between"><span className="eyebrow">Automatic checks</span><span className="xs muted">Run every hour. Releases payment and suspends students who left without finishing.</span></div>
        <ActionForm action={runChecks} submitLabel="Run checks now" buttonClass="btn ghost sm"><span /></ActionForm>
      </div>
      <div className="acols even">
        <div className="card" style={{ gap: 12, overflowX: "auto" }}>
          <span className="eyebrow">Professional fines</span>
          <table className="tbl"><thead><tr><th>Professional</th><th>Amount</th><th>Issued</th><th>Due</th><th /></tr></thead><tbody>
            {openFines.length === 0 && <tr><td className="empty" colSpan={5}>No outstanding fines.</td></tr>}
            {openFines.map(({ f, biz }) => (
              <tr key={f.id}><td>{biz}</td><td>{money(f.amountCents)}</td><td>{fmtDate(f.createdAt)}</td><td><span className={`tag ${f.dueAt < now ? "bad" : "warn"}`}>{fmtDate(f.dueAt)}</span></td>
                <td><form action={waiveFine}><input type="hidden" name="id" value={f.id} /><button className="link small" type="submit">Waive</button></form></td></tr>
            ))}
          </tbody></table>
          {pros.length > 0 && <span className="eyebrow">Suspended professionals</span>}
          {pros.map(({ p }) => (
            <div key={p.userId} className="row between small"><span>{p.businessName} • until {fmtDate(p.suspendedUntil!)} • {p.suspensionReason}</span>
              <form action={liftPro}><input type="hidden" name="userId" value={p.userId} /><button className="link small" type="submit">Lift</button></form></div>
          ))}
        </div>
        <div className="card" style={{ gap: 12, overflowX: "auto" }}>
          <span className="eyebrow">Student booking suspensions</span>
          <table className="tbl"><thead><tr><th>Student</th><th>Reason</th><th>No-shows</th><th>Ends</th><th /></tr></thead><tbody>
            {students.length === 0 && <tr><td className="empty" colSpan={5}>No suspended students.</td></tr>}
            {students.map(({ s, u }) => (
              <tr key={s.userId}><td>{u.firstName} {u.lastName}</td><td>{REASON[s.suspensionReason ?? "admin"]}</td><td>{s.noShowCount}</td><td>{fmtDate(s.bookingSuspendedUntil!)}</td>
                <td><form action={liftStudent}><input type="hidden" name="userId" value={s.userId} /><button className="link small" type="submit">Lift</button></form></td></tr>
            ))}
          </tbody></table>
          <span className="eyebrow">No-show counts</span>
          {noShows.map(({ s, u }) => (
            <div key={s.userId} className="row between small"><span>{u.firstName} {u.lastName} • {s.noShowCount} no-show{s.noShowCount === 1 ? "" : "s"}</span>
              <form action={reverseNoShow}><input type="hidden" name="userId" value={s.userId} /><button className="link small" type="submit">Reverse one</button></form></div>
          ))}
          <p className="xs muted p">Reversing a no-show recalculates the suspension. Every change is logged.</p>
        </div>
      </div>
    </>
  );
}
