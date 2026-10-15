import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, asc } from "drizzle-orm";
import { db, prospects, prospectEvents, users, adminMembers, prospectMessages, leadInvites } from "@/db";
import { canSeeContributorLeads, CONTRIBUTOR_REFERRAL_CODE } from "@/lib/lead-contributors";
import { reviewLeadConflict } from "@/app/admin/lead-contributor-actions";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { outreachScope, PROSPECT_STATUSES, SOURCES } from "@/lib/outreach";
import { updateProspect, doNotContact, setProspectPaused, replyToProspect, setAiMode, answerWithAi } from "@/app/admin/outreach-actions";

export const metadata = { title: "Prospect" };

export default async function ProspectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { user, role } = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await db.query.prospects.findFirst({ where: eq(prospects.id, id) });
  const thread = p ? await db.select().from(prospectMessages).where(eq(prospectMessages.prospectId, p.id)).orderBy(asc(prospectMessages.createdAt)) : [];
  const when = (d: Date | null) => d ? d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) : "—";
  if (!p) notFound();
  // Lead Contributor records and outcomes: only the lead's recruiter (Avy) and the main owner.
  if (p.enteredBy && !(await canSeeContributorLeads(user.id, role, p.recruiterId))) notFound();
  const { isMain } = await outreachScope(user.id);
  const [enteredBy, invite, original] = await Promise.all([
    p.enteredBy ? db.query.users.findFirst({ where: eq(users.id, p.enteredBy) }) : null,
    p.leadInviteId ? db.query.leadInvites.findFirst({ where: eq(leadInvites.id, p.leadInviteId) }) : null,
    p.duplicateOf ? db.query.prospects.findFirst({ where: eq(prospects.id, p.duplicateOf), columns: { id: true, name: true, recruiterId: true } }) : null,
  ]);
  const mine = p.recruiterId === user.id || isMain;
  const [recruiter, events, partners] = await Promise.all([
    p.recruiterId ? db.query.users.findFirst({ where: eq(users.id, p.recruiterId) }) : null,
    db.select({ e: prospectEvents, by: users.firstName }).from(prospectEvents).leftJoin(users, eq(users.id, prospectEvents.actorId)).where(eq(prospectEvents.prospectId, p.id)).orderBy(desc(prospectEvents.createdAt)),
    isMain ? db.select({ id: users.id, first: users.firstName }).from(adminMembers).innerJoin(users, eq(users.id, adminMembers.userId)).where(and(eq(adminMembers.role, "OWNER"), eq(adminMembers.active, true))) : [],
  ]);
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title={p.name} />
      <OutreachNav at="prospects" />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <span className="tag">{PROSPECT_STATUSES[p.status] ?? p.status}</span>
        <span className="small muted">Partner: {recruiter?.firstName ?? "—"} • Source: {p.source ?? "—"} • Added {p.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" })}</span>
        {p.registeredUserId && <Link className="link small" href={`/admin/professionals/${p.registeredUserId}`}>Open their Nearest account →</Link>}
      </div>
      {(p.enteredBy || p.conflictNote || p.duplicateOf) && (
        <div className={`card${p.conflictNote && !p.conflictReviewedAt ? " warn" : ""}`} style={{ gap: 6 }}>
          <span className="eyebrow">Attribution</span>
          <div className="row between small"><span className="muted">Referral attribution</span><span>{recruiter?.firstName ?? "—"}{p.enteredBy ? ` (${CONTRIBUTOR_REFERRAL_CODE} code)` : ""}</span></div>
          {p.enteredBy && <div className="row between small"><span className="muted">Entered by (internal only — no referral credit)</span><span>{[enteredBy?.firstName, enteredBy?.lastName].filter(Boolean).join(" ") || "Lead Contributor"}</span></div>}
          {p.entryMethod && <div className="row between small"><span className="muted">Submission method</span><span>{p.entryMethod === "invitation" ? `Invitation link${invite?.label ? ` — "${invite.label}"` : ""}` : "Manual entry"}</span></div>}
          {invite && <div className="row between small"><span className="muted">Invitation</span><span className="xs">{invite.id.slice(0, 8).toUpperCase()} • created {invite.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}{invite.submittedAt ? ` • submitted ${invite.submittedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}` : ""}</span></div>}
          <div className="row between small"><span className="muted">Prospect ID</span><span className="xs">{p.id}</span></div>
          {p.duplicateOf && <div className="small">{p.status === "duplicate" ? "Duplicate of " : "Possible duplicate of "}{original ? <Link className="link" href={`/admin/outreach/prospects/${original.id}`}>{original.name}</Link> : "an earlier record"}. The original lead and its history were not changed.</div>}
          {p.conflictNote && (
            <div className="col" style={{ gap: 6 }}>
              <span className="small"><span className="b">Attribution conflict:</span> {p.conflictNote}</span>
              {p.conflictReviewedAt
                ? <span className="xs muted">Reviewed {p.conflictReviewedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}.</span>
                : <form action={reviewLeadConflict} className="row" style={{ gap: 6, flexWrap: "wrap" }}><input type="hidden" name="id" value={p.id} /><input name="note" className="ainput" placeholder="What you decided (optional)" maxLength={500} style={{ flex: 1, minWidth: 160 }} /><button className="btn sm" type="submit">Mark reviewed</button></form>}
            </div>
          )}
        </div>
      )}
      <div className="acols">
        <div className="card">
          {mine ? (
            <ActionForm action={updateProspect} submitLabel="Save">
              <input type="hidden" name="id" value={p.id} />
              <div className="grid2">
                <div className="field"><label htmlFor="pd-name">Name</label><input id="pd-name" name="name" defaultValue={p.name} maxLength={120} /></div>
                <div className="field"><label htmlFor="pd-bus">Business</label><input id="pd-bus" name="business" defaultValue={p.business ?? ""} maxLength={120} /></div>
                <div className="field"><label htmlFor="pd-city">City</label><input id="pd-city" name="city" defaultValue={p.city ?? ""} maxLength={80} /></div>
                <div className="field"><label htmlFor="pd-county">County</label><input id="pd-county" name="county" defaultValue={p.county ?? ""} maxLength={80} /></div>
                <div className="field"><label htmlFor="pd-state">State</label><input id="pd-state" name="state" defaultValue={p.state ?? "TX"} maxLength={20} /></div>
                <div className="field"><label htmlFor="pd-cat">Category</label><input id="pd-cat" name="category" defaultValue={p.category ?? ""} maxLength={80} /></div>
                <div className="field"><label htmlFor="pd-src">Source</label><select id="pd-src" name="source" defaultValue={p.source ?? ""}><option value="">—</option>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select></div>
                <div className="field"><label htmlFor="pd-email">Email</label><input id="pd-email" name="email" defaultValue={p.email ?? ""} maxLength={120} /></div>
                <div className="field"><label htmlFor="pd-phone">Phone</label><input id="pd-phone" name="phone" defaultValue={p.phone ?? ""} maxLength={30} /></div>
                <div className="field"><label htmlFor="pd-social">Social profile or website</label><input id="pd-social" name="social" defaultValue={p.socialUrl ?? ""} maxLength={300} /></div>
                <div className="field"><label htmlFor="pd-status">Status</label><select id="pd-status" name="status" defaultValue={p.status}>{Object.entries(PROSPECT_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                {isMain && <div className="field"><label htmlFor="pd-rec">Partner</label><select id="pd-rec" name="recruiter" defaultValue={p.recruiterId ?? ""}>{partners.map((x) => <option key={x.id} value={x.id}>{x.first}</option>)}</select></div>}
              </div>
              <div className="field"><label htmlFor="pd-note">Add a note</label><textarea id="pd-note" name="note" rows={2} maxLength={1000} /></div>
            </ActionForm>
          ) : <span className="small muted">This prospect belongs to {recruiter?.firstName ?? "another partner"}.</span>}
          {mine && p.status !== "opted_out" && (
            <form action={doNotContact}><input type="hidden" name="id" value={p.id} /><button className="link xs" type="submit">Mark do not contact (never re-added from any upload)</button></form>
          )}
        </div>
        <div className="card" style={{ gap: 8 }}>
          <div className="row between" style={{ gap: 6, flexWrap: "wrap" }}>
            <span className="eyebrow">Conversation</span>
            {mine && !["registered", "profile_complete", "opted_out"].includes(p.status) && (
              <form action={setAiMode}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="mode" value={p.aiMode === "human" ? "ai" : "human"} /><button className="btn ghost sm" type="submit">{p.aiMode === "human" ? "Hand back to the AI" : "Take over (AI stops replying)"}</button></form>
            )}
          </div>
          {thread.length === 0 && <span className="small muted">No emails yet.</span>}
          {thread.map((m) => (
            <div key={m.id} className="card small" style={{ gap: 2, ...(m.direction === "in" ? {} : { borderColor: "#2E5A43", background: "#0B1510" }) }}>
              <span className="xs muted">{m.direction === "in" ? p.name : m.author === "ai" ? "Nearest (automatic)" : "You"} • {when(m.createdAt)}{m.subject ? ` • ${m.subject}` : ""}</span>
              <span style={{ whiteSpace: "pre-wrap" }}>{m.body}</span>
            </div>
          ))}
          {mine && p.status === "needs_review" && thread.some((m) => m.direction === "in") && (
            <ActionForm action={answerWithAi} submitLabel="Answer with AI" buttonClass="btn sm" className="col g4"><input type="hidden" name="id" value={p.id} /></ActionForm>
          )}
          {mine && p.email && !["opted_out"].includes(p.status) && (
            <ActionForm action={replyToProspect} submitLabel="Send reply" buttonClass="btn sm" className="col g8">
              <input type="hidden" name="id" value={p.id} />
              <textarea name="body" rows={3} placeholder="Write a reply (sent from you at Nearest, replies come back here)" maxLength={5000} aria-label="Reply" style={{ width: "100%", borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "10px 12px", font: "inherit" }} />
              <label className="check xs"><input type="checkbox" name="withLink" /><span>Add their personal invite link (24 hours)</span></label>
            </ActionForm>
          )}
        </div>
        <div className="card" style={{ gap: 6 }}>
          <span className="eyebrow">Email outreach</span>
          <div className="row between small"><span className="muted">Emails sent</span><span className="b">{p.emailsSent} of 3</span></div>
          <div className="row between small"><span className="muted">Next email</span><span>{p.paused ? "Paused" : p.nextEmailAt ? when(p.nextEmailAt) : "None scheduled"}</span></div>
          <div className="row between small"><span className="muted">Invite link sent</span><span>{when(p.linkSentAt)}</span></div>
          <div className="row between small"><span className="muted">Invite link opened</span><span>{when(p.linkClickedAt)}</span></div>
          {!["registered", "profile_complete", "opted_out"].includes(p.status) && (
            <form action={setProspectPaused}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="paused" value={p.paused ? "0" : "1"} /><button className={p.paused ? "btn sm" : "btn ghost sm"} type="submit">{p.paused ? "Resume emails" : "Pause emails"}</button></form>
          )}
          <span className="xs muted">Replied to the email? Pause emails if you&apos;d rather handle them yourself.</span>
        </div>
        <div className="card" style={{ gap: 6 }}>
          <span className="eyebrow">History</span>
          {p.notes && <span className="small"><span className="b">Notes:</span> {p.notes}</span>}
          {events.map(({ e, by }) => (
            <div key={e.id} className="small" style={{ borderTop: "1px solid #1C1C1F", paddingTop: 6 }}>
              <div className="row between"><span className="b">{PROSPECT_STATUSES[e.kind] ?? e.kind.replace(/_/g, " ")}</span><span className="xs muted">{e.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}</span></div>
              {e.detail && <div>{e.detail}</div>}
              {by && <div className="xs muted">by {by}</div>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
