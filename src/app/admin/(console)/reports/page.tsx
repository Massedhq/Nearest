import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, problemReports, users } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { requireAdmin } from "@/lib/admin";
import { fmtDate } from "@/lib/time";
import { toggleReportResolved } from "@/app/admin/report-actions";

export const metadata = { title: "Problem reports" };
export const dynamic = "force-dynamic";

export default async function Reports({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin();
  const { show } = await searchParams;
  const rows = await db.select({ r: problemReports, first: users.firstName, last: users.lastName, email: users.email })
    .from(problemReports).leftJoin(users, eq(users.id, problemReports.userId))
    .where(show === "all" ? undefined : eq(problemReports.status, "new"))
    .orderBy(desc(problemReports.createdAt)).limit(100);
  return (
    <>
      <AdminHead eyebrow="Sent automatically when something breaks — with a screenshot" title="Problem reports" />
      <div className="row" style={{ gap: 8 }}>
        <Link className={`chip${show !== "all" ? " on" : ""}`} href="/admin/reports">Open</Link>
        <Link className={`chip${show === "all" ? " on" : ""}`} href="/admin/reports?show=all">All</Link>
      </div>
      {rows.length === 0 && <div className="card"><span className="small muted">No open problem reports.</span></div>}
      {rows.map(({ r, first, last, email }) => (
        <div key={r.id} className="card" style={{ gap: 10 }}>
          <div className="row between" style={{ flexWrap: "wrap", gap: 8 }}>
            <span className="b">{r.ref} • {r.accountType}{first ? ` • ${first} ${last ?? ""}` : ""}{email ? ` <${email}>` : ""}</span>
            <span className="xs muted">{fmtDate(r.createdAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} • {r.emailed ? "Emailed to support" : "Not emailed (saved here)"}</span>
          </div>
          <div className="acols even">
            <div className="col small" style={{ gap: 6, minWidth: 0 }}>
              <span><span className="muted">Error:</span> {r.message}</span>
              <span style={{ wordBreak: "break-all" }}><span className="muted">Page:</span> {r.url}</span>
              {r.digest && <span><span className="muted">Server error ID:</span> {r.digest} (search in Vercel → Logs)</span>}
              <span><span className="muted">Their note:</span> {r.note || "—"}</span>
              <span className="xs muted" style={{ wordBreak: "break-all" }}>{r.userAgent} • {r.viewport}</span>
              {r.stack && <details><summary className="link xs">Technical details</summary><pre className="xs" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{r.stack}</pre></details>}
              <form action={toggleReportResolved}><input type="hidden" name="id" value={r.id} /><button className="btn ghost sm" type="submit">{r.status === "resolved" ? "Reopen" : "Mark resolved"}</button></form>
            </div>
            {r.screenshotB64 ? (
              <a href={`/api/admin/report-shot/${r.id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/admin/report-shot/${r.id}`} alt={`Screenshot for ${r.ref}`} style={{ width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 10, border: "1px solid #2A2A2D", background: "#000" }} />
              </a>
            ) : <span className="small muted">No screenshot captured.</span>}
          </div>
        </div>
      ))}
    </>
  );
}
