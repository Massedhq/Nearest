import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, prospectImports } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import type { CheckResult, ProspectInput } from "@/lib/outreach";
import { approveImport } from "@/app/admin/outreach-actions";

export const metadata = { title: "Review import" };

const LABEL: Record<CheckResult["kind"], [string, string]> = {
  ready: ["Ready", "ok"], no_city: ["Missing city", "warn"], possible: ["Possible duplicate", "warn"], duplicate: ["Duplicate", "bad"],
  registered: ["Already on Nearest", "bad"], suppressed: ["Do not contact", "bad"], no_contact: ["No email or phone", "bad"],
};

export default async function ReviewImport({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const imp = await db.query.prospectImports.findFirst({ where: eq(prospectImports.id, id) });
  if (!imp) notFound();
  const rows = imp.rows as (ProspectInput & { check: CheckResult; include: boolean })[];
  const count = (k: CheckResult["kind"]) => rows.filter((r) => r.check.kind === k).length;
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="Review import" />
      <OutreachNav at="import" />
      <div className="card" style={{ gap: 4 }}>
        <span className="eyebrow">{imp.filename}</span>
        <span className="disp h2">{rows.length} prospects found</span>
        <span className="small">{count("ready")} ready • {count("possible")} possible duplicates • {count("duplicate")} duplicates • {count("registered")} already on Nearest • {count("no_city")} missing city • {count("no_contact")} missing email/phone • {count("suppressed")} do not contact</span>
      </div>
      {imp.status === "done" ? (
        <div className="card ok small"><span>This import is done. <Link className="link" href="/admin/outreach/prospects">See your prospects</Link>.</span></div>
      ) : (
        <ActionForm action={approveImport} submitLabel="Approve checked prospects">
          <input type="hidden" name="id" value={imp.id} />
          <span className="xs muted">Ready rows are checked. Rows missing a city can be approved and fixed later. Duplicates, existing accounts and do-not-contact rows can&apos;t be added — their notes go onto the existing record instead. Nothing is contacted yet.</span>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Add</th><th>Name</th><th>City</th><th>Category</th><th>Email</th><th>Phone</th><th>Source</th><th>Check</th></tr></thead>
              <tbody>
                {rows.map((r, i) => {
                  const [label, tone] = LABEL[r.check.kind];
                  const addable = r.check.kind === "ready" || r.check.kind === "no_city" || r.check.kind === "possible";
                  return (
                    <tr key={i}>
                      <td>{addable ? <input type="checkbox" name="row" value={i} defaultChecked={r.include} aria-label={`Add ${r.name}`} /> : "—"}{r.check.kind === "possible" && <input type="hidden" name={`force_${i}`} value="on" />}</td>
                      <td>{r.name || "—"}{r.business && <div className="xs muted">{r.business}</div>}</td>
                      <td>{r.city || "—"}</td><td>{r.category || "—"}</td><td className="xs">{r.email || "—"}</td><td className="xs">{r.phone || "—"}</td><td>{r.source || "—"}</td>
                      <td><span className={`tag ${tone}`}>{label}</span>{"recruiter" in r.check && r.check.recruiter ? <div className="xs muted">with {r.check.recruiter}</div> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ActionForm>
      )}
    </>
  );
}
