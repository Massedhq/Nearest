import { alias } from "drizzle-orm/pg-core";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, incidents, bookings, users, professionalProfiles, messages } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { bookingCode } from "@/lib/bookings";
import { fmtDate, fmtTime } from "@/lib/time";
import { decideIncident } from "@/app/admin/incident-actions";

export const metadata = { title: "Incident Review" };

const TAG: Record<string, string> = { open: "warn", pro_fault: "bad", not_substantiated: "" };

export default async function Incidents() {
  await requireAdmin();
  const student = alias(users, "student");
  const rows = await db
    .select({
      i: incidents, b: bookings, sf: student.firstName, sl: student.lastName, pro: professionalProfiles.businessName,
      msgs: sql<number>`(select count(*)::int from ${messages} m where m.booking_id = ${bookings.id})`,
    })
    .from(incidents)
    .innerJoin(bookings, eq(bookings.id, incidents.bookingId))
    .innerJoin(student, eq(student.id, bookings.studentId))
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, bookings.proId))
    .orderBy(asc(sql`${incidents.status} <> 'open'`), desc(incidents.createdAt))
    .limit(100);
  const open = rows.filter((r) => r.i.status === "open").length;
  return (
    <>
      <AdminHead eyebrow={`${open} open`} title="Incident Review" />
      {rows.length === 0 && <div className="card"><span className="small muted">No incidents reported.</span></div>}
      {rows.map(({ i, b, sf, sl, pro, msgs }) => (
        <div key={i.id} className="card" style={{ gap: 12 }}>
          <div className="row between">
            <div><div className="b">{i.reason}</div><div className="xs muted">{sf} {sl} → {pro} • {b.serviceName} • #{bookingCode(b.number)}</div></div>
            <span className={`tag ${TAG[i.status]}`}>{i.status.replace("_", " ")}</span>
          </div>
          {i.details && <p className="small p">&ldquo;{i.details}&rdquo;</p>}
          <table className="tbl">
            <thead><tr><th>Check</th><th>Time</th><th>Distance</th><th>GPS accuracy</th></tr></thead>
            <tbody>
              <tr><td>Appointment</td><td>{fmtDate(b.startsAt)} {fmtTime(b.startsAt)}</td><td>—</td><td>—</td></tr>
              <tr><td>Student check-in</td><td>{b.checkedInAt ? fmtTime(b.checkedInAt) : "Didn't check in"}</td><td>{b.checkinDistanceFt != null ? `${b.checkinDistanceFt} ft` : "—"}</td><td>{b.checkinAccuracyFt != null ? `±${b.checkinAccuracyFt} ft` : "—"}</td></tr>
              <tr><td>Complaint submitted</td><td>{fmtTime(i.createdAt)}</td><td>{i.distanceFt != null ? `${i.distanceFt} ft` : "—"}</td><td>{i.accuracyFt != null ? `±${i.accuracyFt} ft` : "—"}</td></tr>
              <tr><td>Pro started service</td><td>{b.startedAt ? fmtTime(b.startedAt) : "No"}</td><td /><td /></tr>
            </tbody>
          </table>
          <span className="xs muted">{msgs} message{msgs === 1 ? "" : "s"} in this booking&apos;s thread. GPS records and times can&apos;t be edited.</span>
          {i.status === "open" ? (
            <ActionForm action={decideIncident} submitLabel="Save decision" buttonClass="btn sm">
              <input type="hidden" name="id" value={i.id} />
              <div className="grid2">
                <label className="check"><input type="radio" name="decision" value="pro_fault" required />Professional fault confirmed — full general credit to the student</label>
                <label className="check"><input type="radio" name="decision" value="not_substantiated" />Complaint not substantiated</label>
              </div>
              <div className="field"><label htmlFor={`n_${i.id}`}>Decision note (saved to the activity log)</label><textarea id={`n_${i.id}`} name="note" style={{ height: 70 }} /></div>
            </ActionForm>
          ) : (
            <span className="small muted">Decided {i.decidedAt ? fmtDate(i.decidedAt) : ""}: {i.decisionNote}</span>
          )}
        </div>
      ))}
      <p className="xs muted p">Fines and suspensions for confirmed professional fault arrive with Enforcement (Phase 5).</p>
    </>
  );
}
