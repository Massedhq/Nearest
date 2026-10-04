import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db, prospects, prospectEvents, users, adminMembers } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { outreachScope, PROSPECT_STATUSES, SOURCES } from "@/lib/outreach";
import { updateProspect, doNotContact } from "@/app/admin/outreach-actions";

export const metadata = { title: "Prospect" };

export default async function ProspectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await db.query.prospects.findFirst({ where: eq(prospects.id, id) });
  if (!p) notFound();
  const { isMain } = await outreachScope(user.id);
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
      <div className="acols">
        <div className="card">
          {mine ? (
            <ActionForm action={updateProspect} submitLabel="Save">
              <input type="hidden" name="id" value={p.id} />
              <div className="grid2">
                <div className="field"><label htmlFor="pd-name">Name</label><input id="pd-name" name="name" defaultValue={p.name} maxLength={120} /></div>
                <div className="field"><label htmlFor="pd-bus">Business</label><input id="pd-bus" name="business" defaultValue={p.business ?? ""} maxLength={120} /></div>
                <div className="field"><label htmlFor="pd-city">City</label><input id="pd-city" name="city" defaultValue={p.city ?? ""} maxLength={80} /></div>
                <div className="field"><label htmlFor="pd-state">State</label><input id="pd-state" name="state" defaultValue={p.state ?? "TX"} maxLength={20} /></div>
                <div className="field"><label htmlFor="pd-cat">Category</label><input id="pd-cat" name="category" defaultValue={p.category ?? ""} maxLength={80} /></div>
                <div className="field"><label htmlFor="pd-src">Source</label><select id="pd-src" name="source" defaultValue={p.source ?? ""}><option value="">—</option>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select></div>
                <div className="field"><label htmlFor="pd-email">Email</label><input id="pd-email" name="email" defaultValue={p.email ?? ""} maxLength={120} /></div>
                <div className="field"><label htmlFor="pd-phone">Phone</label><input id="pd-phone" name="phone" defaultValue={p.phone ?? ""} maxLength={30} /></div>
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
