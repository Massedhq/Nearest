import Link from "next/link";
import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db, prospectDrafts, users } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { ScreenshotLeadUpload } from "@/components/ScreenshotLeadUpload";
import { requireAdmin } from "@/lib/admin";
import { outreachScope } from "@/lib/outreach";
import { draftProblems, type DraftFields } from "@/lib/screenshot-leads";
import { fmtDate } from "@/lib/time";

export const metadata = { title: "Add from screenshots" };
export const dynamic = "force-dynamic";

/** Upload screenshots → their text is read in the browser (self-hosted OCR, no AI key) → a queue of drafts you check and approve into prospects. */
export default async function ScreenshotLeads() {
  const { user } = await requireAdmin();
  const { isMain } = await outreachScope(user.id);
  const mine: SQL[] = isMain ? [] : [eq(prospectDrafts.recruiterId, user.id)];
  const [queue, done] = await Promise.all([
    db.select({ d: prospectDrafts, by: users.firstName }).from(prospectDrafts).leftJoin(users, eq(users.id, prospectDrafts.recruiterId))
      .where(and(eq(prospectDrafts.status, "review"), ...mine)).orderBy(desc(prospectDrafts.createdAt)).limit(200),
    db.select({ d: prospectDrafts }).from(prospectDrafts).where(and(inArray(prospectDrafts.status, ["approved"]), ...mine)).orderBy(desc(prospectDrafts.decidedAt)).limit(10),
  ]);
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="Add from screenshots" />
      <OutreachNav at="screenshots" />
      <div className="card" style={{ gap: 10, maxWidth: 640, width: "100%", boxSizing: "border-box" }}>
        <span className="eyebrow">Upload screenshots</span>
        <span className="small muted">Nearest reads the name, business, service, location, contact details and listed prices from the screenshots right here in your browser (no AI service or API key) and puts them in the review queue below. Nothing is added to your prospects or contacted until you check the details and approve.</span>
        <ScreenshotLeadUpload />
      </div>

      <div className="col" style={{ gap: 10, maxWidth: 640, width: "100%" }}>
        <span className="eyebrow">Waiting for your review ({queue.length})</span>
        {queue.length === 0 && <div className="card small"><span className="muted">Nothing waiting. Upload screenshots above to start.</span></div>}
        {queue.map(({ d, by }) => {
          const f = d.fields as DraftFields;
          const missing = draftProblems(f);
          return (
            <Link key={d.id} href={`/admin/outreach/screenshots/${d.id}`} className="card" style={{ gap: 6, textDecoration: "none", color: "inherit" }}>
              <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}><div className="b">{f.name || f.business || "Unnamed professional"}</div><div className="xs muted">{[f.business && f.name ? f.business : null, f.city, f.state].filter(Boolean).join(" • ") || "No location yet"}</div></div>
                <span className={`tag${missing.length ? " warn" : " ok"}`}>{missing.length ? `${missing.length} to fill in` : "Ready to approve"}</span>
              </div>
              {missing.length > 0 && <span className="xs muted">Needs: {missing.join(", ")}</span>}
              <span className="xs muted">Uploaded {fmtDate(d.createdAt, { month: "short", day: "numeric" })} • {(d.images as unknown[]).length} screenshot{(d.images as unknown[]).length === 1 ? "" : "s"}{isMain && by ? ` • ${by}` : ""}</span>
            </Link>
          );
        })}
      </div>

      {done.length > 0 && (
        <div className="card small" style={{ gap: 6, maxWidth: 640, width: "100%", boxSizing: "border-box" }}>
          <span className="eyebrow">Recently approved</span>
          {done.map(({ d }) => <Link key={d.id} className="link" href={`/admin/outreach/prospects/${d.prospectId}`}>{(d.fields as DraftFields).name || (d.fields as DraftFields).business}</Link>)}
        </div>
      )}
    </>
  );
}
