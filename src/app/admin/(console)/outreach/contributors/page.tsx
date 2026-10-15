import Link from "next/link";
import { headers } from "next/headers";
import { desc, eq, sql } from "drizzle-orm";
import { db, leadContributors, leadInvites, prospects, users } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { ActionForm } from "@/components/ActionForm";
import { CopyText } from "@/components/CopyText";
import { requireAdmin } from "@/lib/admin";
import { CONTRIBUTOR_REFERRAL_CODE, contributorRecruiterId } from "@/lib/lead-contributors";
import { fmtDate } from "@/lib/time";
import { inviteLeadContributor, newLeadContributorLink, removeLeadContributor, restoreLeadContributor } from "@/app/admin/lead-contributor-actions";

export const metadata = { title: "Lead contributors" };
export const dynamic = "force-dynamic";

/** Owner only: grant and revoke the Lead Contributor role, and see what each contributor entered. */
export default async function LeadContributors() {
  const { role } = await requireAdmin();
  if (role !== "OWNER") {
    return (<><AdminHead eyebrow="Professional Outreach" title="Lead contributors" /><OutreachNav at="contributors" /><div className="card warn small"><span>Only owners can manage Lead Contributors.</span></div></>);
  }
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const recruiterId = await contributorRecruiterId();
  const recruiter = recruiterId ? await db.query.users.findFirst({ where: eq(users.id, recruiterId) }) : null;
  const [rows, counts, linkCounts] = await Promise.all([
    db.select().from(leadContributors).orderBy(desc(leadContributors.createdAt)),
    db.select({ by: prospects.enteredBy, n: sql<number>`count(*)::int`, manual: sql<number>`count(*) filter (where ${prospects.entryMethod} = 'manual')::int`, invite: sql<number>`count(*) filter (where ${prospects.entryMethod} = 'invitation')::int` })
      .from(prospects).where(sql`${prospects.enteredBy} is not null`).groupBy(prospects.enteredBy),
    db.select({ c: leadInvites.contributorId, n: sql<number>`count(*)::int`, done: sql<number>`count(*) filter (where ${leadInvites.status} = 'submitted')::int` }).from(leadInvites).groupBy(leadInvites.contributorId),
  ]);
  const byUser = new Map(counts.map((c) => [c.by, c]));
  const byLinks = new Map(linkCounts.map((c) => [c.c, c]));
  const now = Date.now();
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="Lead contributors" />
      <OutreachNav at="contributors" />
      <p className="xs muted p">A Lead Contributor can only add professional prospects (by hand or through their own invitation links) on a separate page, /leads. They can&apos;t open any admin page, student information, payments, supporter submissions, exports or the prospect list. Every lead they add is attributed on the server to {recruiter?.firstName ?? "the owner"}&apos;s recruiter account and the {CONTRIBUTOR_REFERRAL_CODE} referral code; the contributor is recorded only as &ldquo;Entered by&rdquo; — no referral ownership, partner credit or compensation.</p>
      {!recruiterId && <div className="card warn small"><span>The {CONTRIBUTOR_REFERRAL_CODE} referral code isn&apos;t on an active owner account, so contributors can&apos;t be invited yet.</span></div>}

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Invite a Lead Contributor</span>
        <ActionForm action={inviteLeadContributor} submitLabel="Create invitation" buttonClass="btn sm" className="row g8" >
          <input name="name" className="ainput" placeholder="Full name" maxLength={120} required style={{ flex: 1, minWidth: 160 }} />
          <input name="email" type="email" className="ainput" placeholder="Their email (their login must use it)" maxLength={160} required style={{ flex: 1, minWidth: 200 }} />
        </ActionForm>
        <span className="xs muted">Nothing is emailed — copy the invitation link below and send it yourself. It works for 14 days.</span>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Contributor</th><th>Status</th><th>Leads entered</th><th>Invitation links</th><th>Since</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="empty" colSpan={6}>No Lead Contributors yet.</td></tr>}
            {rows.map((c) => {
              const n = c.userId ? byUser.get(c.userId) : undefined;
              const l = byLinks.get(c.id);
              const expired = c.status === "invited" && c.inviteExpiresAt.getTime() < now;
              return (
                <tr key={c.id}>
                  <td><div className="b">{c.name}</div><div className="xs muted">{c.email}</div>
                    {c.status === "invited" && !expired && <div className="row" style={{ gap: 6, marginTop: 6 }}><CopyText text={`${origin}/leads/join/${c.token}`} label="Copy invitation link" /></div>}
                  </td>
                  <td><span className={`tag${c.status === "active" ? " ok" : c.status === "removed" ? " bad" : ""}`}>{c.status === "active" ? "Active" : c.status === "removed" ? "Removed" : expired ? "Invitation expired" : "Invited"}</span></td>
                  <td>{n ? <Link className="link" href={`/admin/outreach/prospects?all=1&by=${c.userId}`}>{n.n} ({n.manual} manual, {n.invite} by link)</Link> : "0"}</td>
                  <td>{l ? `${l.n} created • ${l.done} submitted` : "—"}</td>
                  <td className="xs">{fmtDate(c.acceptedAt ?? c.createdAt, { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="xs">
                    {c.status === "invited" && <form action={newLeadContributorLink}><input type="hidden" name="id" value={c.id} /><button className="link xs" type="submit">New invitation link</button></form>}
                    {c.status !== "removed"
                      ? <form action={removeLeadContributor}><input type="hidden" name="id" value={c.id} /><button className="link xs" type="submit" style={{ color: "#E08A8A" }}>Revoke access</button></form>
                      : <form action={restoreLeadContributor}><input type="hidden" name="id" value={c.id} /><button className="link xs" type="submit">Restore access</button></form>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
