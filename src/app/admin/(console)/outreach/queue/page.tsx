import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db, prospects, outreachBatches, users } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { OutreachNav } from "@/components/OutreachNav";
import { requireAdmin } from "@/lib/admin";
import { getFlag } from "@/lib/settings";
import { outreachScope } from "@/lib/outreach";
import { getTemplates } from "@/lib/outreach-mail";
import { createBatch, setBatchStatus, setOutreachPaused } from "@/app/admin/outreach-actions";

export const metadata = { title: "Outreach queue" };

const field = { borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px", height: 40 } as const;

/** Create, schedule and control outreach batches. */
export default async function OutreachQueue({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const { user, role } = await requireAdmin();
  const { isMain } = await outreachScope(user.id);
  const everyone = isMain && (await searchParams).who === "all";
  const mine = everyone ? undefined : eq(prospects.recruiterId, user.id);
  const [paused, { address }, counts, batches] = await Promise.all([
    getFlag("outreach.paused"),
    getTemplates(),
    db.select({
      ready: sql<number>`count(*) filter (where ${prospects.status} = 'approved' and ${prospects.batchId} is null and ${prospects.emailNorm} is not null)::int`,
      scheduled: sql<number>`count(*) filter (where ${prospects.status} in ('approved','scheduled') and ${prospects.batchId} is not null and ${prospects.emailsSent} = 0)::int`,
      emailed: sql<number>`count(*) filter (where ${prospects.emailsSent} > 0)::int`,
      waiting: sql<number>`count(*) filter (where ${prospects.status} in ('link_sent','contacted') and ${prospects.nextEmailAt} is not null)::int`,
      clicked: sql<number>`count(*) filter (where ${prospects.linkClickedAt} is not null)::int`,
      registered: sql<number>`count(*) filter (where ${prospects.status} in ('registered','profile_complete'))::int`,
      noEmail: sql<number>`count(*) filter (where ${prospects.status} = 'approved' and ${prospects.emailNorm} is null)::int`,
    }).from(prospects).where(mine).then((r) => r[0]),
    db.select({
      b: outreachBatches, who: users.firstName,
      size: sql<number>`(select count(*)::int from prospects p where p.batch_id = ${outreachBatches.id})`,
      emailed: sql<number>`(select count(*)::int from prospects p where p.batch_id = ${outreachBatches.id} and p.emails_sent > 0)`,
      clicked: sql<number>`(select count(*)::int from prospects p where p.batch_id = ${outreachBatches.id} and p.link_clicked_at is not null)`,
      joined: sql<number>`(select count(*)::int from prospects p where p.batch_id = ${outreachBatches.id} and p.status in ('registered','profile_complete'))`,
    }).from(outreachBatches).leftJoin(users, eq(users.id, outreachBatches.recruiterId))
      .where(everyone ? undefined : eq(outreachBatches.recruiterId, user.id)).orderBy(desc(outreachBatches.createdAt)).limit(40),
  ]);
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="Outreach queue" />
      <OutreachNav at="queue" />
      {isMain && <div className="chips"><Link className={`chip${!everyone ? " on" : ""}`} href="/admin/outreach/queue">Mine</Link><Link className={`chip${everyone ? " on" : ""}`} href="/admin/outreach/queue?who=all">Everyone</Link></div>}

      <div className={`card ${paused ? "warn" : ""}`} style={{ gap: 6 }}>
        <div className="row between" style={{ flexWrap: "wrap", gap: 8 }}>
          <span className="small"><span className="b">{paused ? "All outreach emails are paused." : "Outreach is on."}</span> Emails go out every 15 minutes for running batches.</span>
          {role === "OWNER" && (
            <form action={setOutreachPaused}><input type="hidden" name="paused" value={paused ? "0" : "1"} /><button className={paused ? "btn sm" : "btn ghost sm"} type="submit">{paused ? "Resume all outreach" : "Pause all outreach"}</button></form>
          )}
        </div>
        {!address && <span className="xs" style={{ color: "#E3C58A" }}>⚠ Add your mailing address on Templates — emails won&apos;t send without it.</span>}
      </div>

      <div className="kpis k4">
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Ready to contact</span><span className="stat">{counts.ready}</span>{counts.noEmail > 0 && <span className="xs muted">+{counts.noEmail} with phone only</span>}</div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Scheduled</span><span className="stat">{counts.scheduled}</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Emailed • waiting</span><span className="stat">{counts.emailed}</span><span className="xs muted">{counts.waiting} with a follow-up coming</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Clicked • joined</span><span className="stat">{counts.clicked} • {counts.registered}</span></div>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">New batch</span>
        <span className="xs muted">Takes your Ready prospects (oldest first) that have an email. Leave city or category blank for all.</span>
        <ActionForm action={createBatch} submitLabel="Create batch" buttonClass="btn sm" className="col g8">
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input name="name" placeholder="Batch name (e.g. October 5 outreach)" maxLength={80} style={{ ...field, flex: "2 1 220px" }} aria-label="Batch name" />
            <input name="city" placeholder="City (optional)" maxLength={80} style={{ ...field, flex: "1 1 140px" }} aria-label="City" />
            <input name="category" placeholder="Category (optional)" maxLength={80} style={{ ...field, flex: "1 1 140px" }} aria-label="Category" />
            <input name="limit" type="number" min={1} max={2000} defaultValue={Math.min(100, Math.max(1, counts.ready))} style={{ ...field, width: 110 }} aria-label="How many" />
          </div>
          <div className="row" style={{ gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <label className="check small"><input type="radio" name="start" value="now" defaultChecked /> <span>Start now</span></label>
            <label className="check small"><input type="radio" name="start" value="later" /> <span>Schedule for</span></label>
            <input name="startAt" type="datetime-local" style={field} aria-label="Start date and time" />
          </div>
        </ActionForm>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Batches</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Batch</th>{everyone && <th>Recruiter</th>}<th>Status</th><th>Starts</th><th className="num">Prospects</th><th className="num">Emailed</th><th className="num">Clicked</th><th className="num">Joined</th><th /></tr></thead>
            <tbody>
              {batches.length === 0 && <tr><td className="empty" colSpan={9}>No batches yet. Create one above.</td></tr>}
              {batches.map(({ b, who, size, emailed, clicked, joined }) => (
                <tr key={b.id}>
                  <td className="b">{b.name}</td>
                  {everyone && <td>{who ?? "—"}</td>}
                  <td><span className={`tag ${b.status === "running" ? "ok" : b.status === "paused" ? "warn" : b.status === "cancelled" ? "bad" : ""}`}>{b.status}</span></td>
                  <td>{b.startAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}</td>
                  <td className="num">{size}</td><td className="num">{emailed}</td><td className="num">{clicked}</td><td className="num">{joined}</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      {["running", "scheduled"].includes(b.status) && <form action={setBatchStatus}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="to" value="paused" /><button className="btn ghost sm" type="submit">Pause</button></form>}
                      {b.status === "paused" && <form action={setBatchStatus}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="to" value="resume" /><button className="btn sm" type="submit">Resume</button></form>}
                      {!["done", "cancelled"].includes(b.status) && <form action={setBatchStatus}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="to" value="cancelled" /><button className="btn ghost sm" type="submit">Cancel</button></form>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
