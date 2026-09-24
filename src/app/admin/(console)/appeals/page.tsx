import { asc, desc, eq, sql } from "drizzle-orm";
import { db, appeals, users } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { fmtDate } from "@/lib/time";
import { decideAppeal } from "@/app/admin/enforce-actions";

export const metadata = { title: "Appeals" };
const KIND: Record<string, string> = { student_suspension: "Student booking suspension", pro_fine: "Professional fine", pro_suspension: "Professional suspension" };

export default async function Appeals() {
  await requireAdmin();
  const rows = await db.select({ a: appeals, u: users }).from(appeals).innerJoin(users, eq(users.id, appeals.userId))
    .orderBy(asc(sql`${appeals.status} <> 'under_review'`), desc(appeals.createdAt)).limit(100);
  const open = rows.filter((r) => r.a.status === "under_review").length;
  return (
    <>
      <AdminHead eyebrow={`${open} under review • 30–90 day window`} title="Appeals" />
      {rows.length === 0 && <div className="card"><span className="small muted">No appeals yet.</span></div>}
      {rows.map(({ a, u }) => {
        const age = Math.floor((Date.now() - a.createdAt.getTime()) / 86400000);
        return (
          <div key={a.id} className="card" style={{ gap: 10 }}>
            <div className="row between"><div><div className="b">{KIND[a.kind]}</div><div className="xs muted">{u.firstName} {u.lastName} • {u.email} • filed {fmtDate(a.createdAt)} (day {age})</div></div>
              <span className={`tag ${a.status === "overturned" ? "ok" : a.status === "upheld" ? "bad" : "warn"}`}>{a.status.replace("_", " ")}</span></div>
            <p className="small p">&ldquo;{a.explanation}&rdquo;</p>
            {a.status === "under_review" ? (
              <ActionForm action={decideAppeal} submitLabel="Save decision" buttonClass="btn sm">
                <input type="hidden" name="id" value={a.id} />
                <div className="grid2"><label className="check"><input type="radio" name="decision" value="upheld" required />Uphold</label><label className="check"><input type="radio" name="decision" value="overturned" />Overturn (reverses the action)</label></div>
                <div className="field"><label htmlFor={`n_${a.id}`}>Decision reason</label><textarea id={`n_${a.id}`} name="note" style={{ height: 70 }} /></div>
              </ActionForm>
            ) : <span className="small muted">Decided {a.decidedAt ? fmtDate(a.decidedAt) : ""}: {a.decisionNote}</span>}
          </div>
        );
      })}
    </>
  );
}
