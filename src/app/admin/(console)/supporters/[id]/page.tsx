import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, supporters, supporterEvents } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { EXPERIENCE_LABEL, RELATIONSHIP_LABEL, STATUS_LABEL, publishProblems, isOrganizational } from "@/lib/supporters";
import { fmtDate, fmtTime } from "@/lib/time";
import {
  approveSupporter, requestSupporterFix, declineSupporter, publishSupporter, unpublishSupporter, proposeSupporterWording, cancelSupporterWording, newSupporterManageLink,
} from "@/app/admin/supporter-actions";

export const metadata = { title: "Supporter" };
export const dynamic = "force-dynamic";

const box = { border: "1px solid #2A2A2D", borderRadius: 12, padding: "10px 12px", background: "#0E0E10", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" as const };
const field = { width: "100%", borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "8px 10px", font: "inherit" } as const;
const yes = (b: boolean) => (b ? "Yes" : "No");
const EVENT: Record<string, string> = {
  submitted: "Submitted", permissions_changed: "Supporter changed permissions", correction_submitted: "Supporter sent a correction",
  revision_approved: "Supporter approved the wording change", revision_declined: "Supporter kept their wording", withdrawn: "Supporter withdrew",
  approved: "Approved", correction_requested: "Correction requested", declined: "Declined", published: "Published", unpublished: "Unpublished",
  revision_proposed: "Wording change suggested", revision_cancelled: "Wording change removed", manage_link_reissued: "New management link issued",
};

/** Review one supporter: everything submitted, permissions, experience, disclosures, authorization, decisions, history. */
export default async function SupporterReview({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const s = await db.query.supporters.findFirst({ where: eq(supporters.id, id) });
  if (!s) notFound();
  const events = await db.select().from(supporterEvents).where(eq(supporterEvents.supporterId, id)).orderBy(asc(supporterEvents.at));
  const problems = publishProblems(s);
  const closed = ["declined", "withdrawn"].includes(s.status);
  const v = <><input type="hidden" name="id" value={s.id} /><input type="hidden" name="version" value={s.version} /></>;
  const rel = (s.relationships ?? []).filter((r) => r in RELATIONSHIP_LABEL);

  return (
    <>
      <AdminHead eyebrow="Supporter" title={s.name} />
      <Link className="link small" href="/admin/supporters">← All supporters</Link>

      <div className={`card ${s.status === "published" ? "ok" : ["submitted", "needs_correction"].includes(s.status) ? "warn" : ""}`} style={{ gap: 4 }}>
        <span className="row between"><span className="eyebrow">Status</span><span className="tag">{STATUS_LABEL[s.status]}</span></span>
        {s.adminNote && <span className="small"><span className="b">Note to supporter:</span> {s.adminNote}</span>}
        {s.statementProposed && <span className="small b">Your wording change is waiting for the supporter&apos;s approval.</span>}
      </div>

      <div className="acols even">
        <div className="card" style={{ gap: 6 }}>
          <span className="eyebrow">Submitted information</span>
          <div className="row" style={{ gap: 12 }}>
            {s.portraitUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={`/api/supporters/portrait/${s.id}`} alt="" width={72} height={72} style={{ borderRadius: 36, objectFit: "cover", border: "1px solid #ECE8E1" }} />
              : <span style={{ width: 72, height: 72, borderRadius: 36, border: "1px solid #ECE8E1", display: "flex", alignItems: "center", justifyContent: "center" }} className="disp">—</span>}
            <span className="small"><span className="b">{s.name}</span><br />{s.title}<br />{s.affiliationStatus === "none" ? "Not with a school or organization" : `${s.affiliationStatus === "former" ? "Previously with" : "Currently with"} ${s.organization}`}</span>
          </div>
          <span className="small"><span className="muted">Contact email (private):</span> {s.email}</span>
          {s.benefitCurrent && <><span className="small b" style={{ marginTop: 6 }}>How Nearest could benefit students and parents</span><div style={box}>{s.benefitCurrent}</div></>}
          <span className="small b" style={{ marginTop: 6 }}>Original opinion statement (never changed)</span>
          <div style={box}>{s.statementOriginal}</div>
          {s.statementCurrent !== s.statementOriginal && <><span className="small b">Current wording (supporter-approved)</span><div style={box}>{s.statementCurrent}</div></>}
          {s.statementProposed && <><span className="small b">Your suggested wording (waiting)</span><div style={box}>{s.statementProposed}</div></>}
          {s.statementPublished && <><span className="small b">Published wording</span><div style={box}>{s.statementPublished}</div></>}
        </div>

        <div className="col" style={{ gap: 12 }}>
          <div className="card" style={{ gap: 4 }}>
            <span className="eyebrow">Publication consent</span>
            <span className="small">{s.status === "withdrawn" ? "Withdrawn — publication consent removed." : "Agreed to publication when submitting (statement, name, title, affiliation" + (s.portraitUrl ? ", photo" : "") + ")."}</span>
            {!s.portraitUrl && <span className="small">No photo — initials are shown.</span>}
            <span className="small">Confirmed honest perspective: {yes(s.confirmHonest)}{s.portraitUrl ? ` • Has permission for the photo: ${yes(s.confirmPhoto)}` : ""}</span>
          </div>
          <div className="card" style={{ gap: 4 }}>
            <span className="eyebrow">What they reviewed or experienced</span>
            <span className="small">{EXPERIENCE_LABEL[s.experience]}{s.experienceOther ? `: ${s.experienceOther}` : ""}</span>
            <span className="xs muted">{s.experience === "platform_use" ? "Shown publicly as based on using Nearest." : "Shown publicly as a prelaunch perspective — not actual service experience."}</span>
          </div>
          <div className="card" style={{ gap: 4 }}>
            <span className="eyebrow">Relationship / incentive disclosure</span>
            <span className="small">{rel.length ? rel.map((r) => RELATIONSHIP_LABEL[r]).join("; ") : "None"}{s.relationshipNote ? ` — ${s.relationshipNote}` : ""}</span>
            {rel.length > 0 && <span className="xs muted">Shown publicly next to the statement.</span>}
          </div>
          <div className="card" style={{ gap: 4 }}>
            <span className="eyebrow">Endorsement type</span>
            {s.endorsementType === "organizational"
              ? <><span className="small">Organizational — on behalf of {s.organization}</span><span className="small">Authority: {s.orgAuthorityNote}</span><span className="small">Supporter confirmed authorization: {yes(s.orgAuthorityConfirmed)} • Reviewed by an admin: {yes(Boolean(s.orgAuthorityReviewedBy))}</span></>
              : <span className="small">Personal endorsement{s.permAffiliation ? ` (affiliation ${s.organization} shown for context only)` : ""}</span>}
            <span className="xs muted">School affiliation alone never makes it an organizational endorsement. Public label: {isOrganizational(s) ? `Endorsement on behalf of ${s.organization}` : "Personal endorsement"}.</span>
          </div>
        </div>
      </div>

      {!closed && (
        <div className="acols even">
          <div className="card" style={{ gap: 10 }}>
            <span className="eyebrow">Decision</span>
            {["submitted", "needs_correction"].includes(s.status) && (
              <ActionForm action={approveSupporter} submitLabel="Approve" buttonClass="btn sm" className="col g8">
                {v}
                {s.endorsementType === "organizational" && (
                  <>
                    <label className="check xs"><input type="radio" name="org" value="confirm" required /><span>I reviewed their organizational authorization — label it as on behalf of {s.organization}</span></label>
                    <label className="check xs"><input type="radio" name="org" value="personal" /><span>Approve as a personal endorsement instead</span></label>
                  </>
                )}
              </ActionForm>
            )}
            {["approved", "published"].includes(s.status) && (s.status === "published"
              ? <ActionForm action={unpublishSupporter} submitLabel="Unpublish" buttonClass="btn ghost sm" className="col">{v}</ActionForm>
              : <>
                  {problems.length > 0 && <div className="small">{problems.map((p) => <div key={p}>• {p}</div>)}</div>}
                  <ActionForm action={publishSupporter} submitLabel="Publish" buttonClass="btn sm" className="col">{v}</ActionForm>
                </>)}
            <ActionForm action={requestSupporterFix} submitLabel="Request correction" buttonClass="btn ghost sm" className="col g8">
              {v}<input name="note" required maxLength={1000} placeholder="What needs correcting (shown on their management link)" style={field} />
            </ActionForm>
            <ActionForm action={declineSupporter} submitLabel="Decline" buttonClass="btn danger sm" className="col g8">
              {v}<input name="note" required maxLength={1000} placeholder="Reason (shown on their management link)" style={field} />
            </ActionForm>
          </div>
          <div className="card" style={{ gap: 10 }}>
            <span className="eyebrow">Suggest different wording</span>
            <span className="xs muted">The original stays saved. Your wording is only used after the supporter approves it on their management link.</span>
            <ActionForm action={proposeSupporterWording} submitLabel="Send for the supporter's approval" buttonClass="btn ghost sm" className="col g8">
              {v}<textarea name="statement" defaultValue={s.statementProposed ?? s.statementCurrent} maxLength={1500} rows={6} style={field} />
            </ActionForm>
            {s.statementProposed && <ActionForm action={cancelSupporterWording} submitLabel="Remove suggested wording" buttonClass="link xs" className="col">{v}</ActionForm>}
            <span className="eyebrow" style={{ marginTop: 8 }}>Management link</span>
            <span className="xs muted">The supporter got a private link after submitting. If they lost it, issue a new one and share it yourself (the old one stops working).</span>
            <ActionForm action={newSupporterManageLink} submitLabel="Issue a new management link" buttonClass="btn ghost sm" className="col">{v}</ActionForm>
          </div>
        </div>
      )}

      <div className="card" style={{ gap: 6 }}>
        <span className="eyebrow">History</span>
        {events.map((e) => (
          <div key={e.id} className="small" style={{ borderTop: "1px solid #1C1C1F", paddingTop: 6 }}>
            <span className="b">{EVENT[e.kind] ?? e.kind}</span> <span className="xs muted">• {e.actor} • {fmtDate(e.at)} {fmtTime(e.at)}</span>
            {e.detail ? <pre className="xs muted" style={{ whiteSpace: "pre-wrap", margin: "4px 0 0", fontFamily: "inherit" }}>{JSON.stringify(e.detail, null, 1)}</pre> : null}
          </div>
        ))}
      </div>
    </>
  );
}
