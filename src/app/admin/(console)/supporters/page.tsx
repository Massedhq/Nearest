import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db, supporters, supporterInvites } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { CopyButton } from "@/components/CopyButton";
import { requireAdmin } from "@/lib/admin";
import { INVITE_DAYS_DEFAULT, STATUS_LABEL, SUPPORTER_STATUSES, inviteLink } from "@/lib/supporters";
import { fmtDate } from "@/lib/time";
import { createSupporterInvite, revokeSupporterInvite } from "@/app/admin/supporter-actions";

export const metadata = { title: "Supporters" };
export const dynamic = "force-dynamic";

/** Educator/supporter endorsements: invitations (copy the link and share it yourself) and every submission by status. */
export default async function SupportersAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [invites, rows] = await Promise.all([
    db.select().from(supporterInvites).orderBy(desc(supporterInvites.createdAt)).limit(200),
    db.select({ id: supporters.id, name: supporters.name, title: supporters.title, organization: supporters.organization, status: supporters.status, submittedAt: supporters.submittedAt, updatedAt: supporters.updatedAt, proposed: sql<boolean>`${supporters.statementProposed} is not null` })
      .from(supporters).orderBy(desc(supporters.updatedAt)),
  ]);
  const now = Date.now();
  const openInvites = invites.filter((i) => i.status === "invited");
  const counts: Record<string, number> = Object.fromEntries(SUPPORTER_STATUSES.map((k) => [k, 0]));
  counts.invited = openInvites.filter((i) => i.expiresAt.getTime() > now).length;
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const filter = sp.status && SUPPORTER_STATUSES.includes(sp.status as (typeof SUPPORTER_STATUSES)[number]) ? sp.status : "";
  const shown = filter && filter !== "invited" ? rows.filter((r) => r.status === filter) : rows;

  return (
    <>
      <AdminHead eyebrow="Educator & supporter endorsements" title="Supporters" />
      <div className="chips">
        <Link className={`chip${!filter ? " on" : ""}`} href="/admin/supporters">All</Link>
        {SUPPORTER_STATUSES.map((k) => <Link key={k} className={`chip${filter === k ? " on" : ""}`} href={`/admin/supporters?status=${k}`}>{STATUS_LABEL[k]} {counts[k]}</Link>)}
      </div>
      <p className="xs muted p">Only Published records with the supporter&apos;s permission for their statement and name appear on the homepage and /supporters. With none published, the homepage section is hidden. These are separate from student reviews and professional ratings.</p>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Invite a supporter</span>
        <span className="xs muted">Creates a private, expiring link to a short form inside Nearest (no account needed). Nothing is sent automatically — copy the link and share it yourself.</span>
        <ActionForm action={createSupporterInvite} submitLabel="Create invitation link" buttonClass="btn sm" className="col g8">
          <input name="label" className="ainput" placeholder="Who it's for (private note, optional)" maxLength={120} />
          <label className="xs muted">Expires after (days)<input name="days" type="number" min={1} max={60} defaultValue={INVITE_DAYS_DEFAULT} className="ainput" style={{ width: 90, marginLeft: 8 }} /></label>
        </ActionForm>
      </div>

      {(filter === "" || filter === "invited") && (
        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">Invitations</span>
          {invites.length === 0 && <span className="small muted">No invitations yet.</span>}
          {invites.map((i) => {
            const expired = i.status === "invited" && i.expiresAt.getTime() <= now;
            const state = i.status === "submitted" ? "Submitted" : i.status === "revoked" ? "Cancelled" : expired ? "Expired" : "Invited";
            return (
              <div key={i.id} className="row small" style={{ gap: 8, flexWrap: "wrap", borderTop: "1px solid #1C1C1F", paddingTop: 8 }}>
                <span className="grow"><span className="b">{i.label || "Invitation"}</span> • <span className="tag">{state}</span><br /><span className="xs muted">Created {fmtDate(i.createdAt)} • {i.status === "submitted" && i.usedAt ? `used ${fmtDate(i.usedAt)}` : `expires ${fmtDate(i.expiresAt)}`}</span></span>
                {state === "Invited" && <CopyButton text={inviteLink(i.token)} />}
                {state === "Invited" && <form action={revokeSupporterInvite}><input type="hidden" name="id" value={i.id} /><button className="link xs" type="submit">Cancel</button></form>}
                {i.supporterId && <Link className="link xs" href={`/admin/supporters/${i.supporterId}`}>Open submission</Link>}
              </div>
            );
          })}
        </div>
      )}

      {filter !== "invited" && (
        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">Submissions</span>
          {shown.length === 0 && <span className="small muted">Nothing here.</span>}
          {shown.map((r) => (
            <Link key={r.id} href={`/admin/supporters/${r.id}`} className="row small" style={{ gap: 8, textDecoration: "none", color: "inherit", borderTop: "1px solid #1C1C1F", paddingTop: 8 }}>
              <span className="grow"><span className="b">{r.name}</span> — {r.title}, {r.organization}<br /><span className="xs muted">Submitted {fmtDate(r.submittedAt)} • updated {fmtDate(r.updatedAt)}{r.proposed ? " • wording change waiting for supporter" : ""}</span></span>
              <span className={`tag ${r.status === "published" ? "ok" : ["submitted", "needs_correction"].includes(r.status) ? "warn" : ""}`}>{STATUS_LABEL[r.status]}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
