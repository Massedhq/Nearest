import Link from "next/link";
import { and, asc, desc, eq, gte, ilike, isNotNull, lt, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, prospects, users, categories, leadContributors } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { requireAdmin } from "@/lib/admin";
import { chicagoToUtc } from "@/lib/time";
import { outreachScope, PROSPECT_STATUSES, SOURCES } from "@/lib/outreach";

export const metadata = { title: "Prospects" };

export default async function Prospects({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { user, role } = await requireAdmin();
  const { isMain } = await outreachScope(user.id);
  const sp = await searchParams;
  const all = isMain && sp.all === "1";
  const where: SQL[] = [];
  if (!all) where.push(eq(prospects.recruiterId, user.id));
  // Lead Contributor records and outcomes: only the lead's recruiter (an owner) and the main owner.
  if (role !== "OWNER") where.push(sql`${prospects.enteredBy} is null`);
  if (sp.q) { const q = `%${sp.q.trim()}%`; where.push(or(ilike(prospects.name, q), ilike(prospects.business, q), ilike(prospects.email, q), ilike(prospects.phone, q), ilike(prospects.socialUrl, q))!); }
  if (sp.status) where.push(eq(prospects.status, sp.status));
  if (sp.city) where.push(ilike(prospects.city, sp.city.trim()));
  if (sp.county) where.push(ilike(prospects.county, `${sp.county.trim().replace(/\s+county$/i, "")}%`));
  if (sp.category) where.push(ilike(prospects.category, sp.category));
  if (sp.source) where.push(eq(prospects.source, sp.source));
  if (sp.by && /^[0-9a-f-]{36}$/.test(sp.by)) where.push(eq(prospects.enteredBy, sp.by));
  if (sp.method === "manual" || sp.method === "invitation") where.push(eq(prospects.entryMethod, sp.method));
  if (sp.method === "contributor") where.push(isNotNull(prospects.enteredBy));
  if (sp.flag === "conflict") where.push(sql`${prospects.conflictNote} is not null and ${prospects.conflictReviewedAt} is null`);
  if (sp.flag === "duplicate") where.push(isNotNull(prospects.duplicateOf));
  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) where.push(gte(prospects.createdAt, chicagoToUtc(sp.from, "00:00")));
  if (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) where.push(lt(prospects.createdAt, new Date(chicagoToUtc(sp.to, "00:00").getTime() + 86400000)));
  const entered = alias(users, "entered");
  const [rows, cats, contributors] = await Promise.all([
    db.select({ p: prospects, r: users.firstName, eFirst: entered.firstName, eLast: entered.lastName }).from(prospects)
      .leftJoin(users, eq(users.id, prospects.recruiterId)).leftJoin(entered, eq(entered.id, prospects.enteredBy))
      .where(where.length ? and(...where) : sql`true`).orderBy(desc(prospects.createdAt)).limit(300),
    db.select({ name: categories.name }).from(categories).orderBy(asc(categories.sort), asc(categories.name)),
    role === "OWNER" ? db.select({ userId: leadContributors.userId, name: leadContributors.name }).from(leadContributors).where(and(isNotNull(leadContributors.userId), ...(isMain ? [] : [eq(leadContributors.recruiterId, user.id)]))) : [],
  ]);
  const tone = (st: string) => (["registered", "profile_complete"].includes(st) ? "ok" : ["opted_out", "declined", "ineligible", "duplicate"].includes(st) ? "bad" : ["needs_review", "needs_info"].includes(st) ? "warn" : "");
  const showLeads = role === "OWNER";
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="Prospects" />
      <OutreachNav at="prospects" />
      <form className="card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10, alignItems: "end" }}>
        <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="q">Search</label><input id="q" name="q" defaultValue={sp.q} placeholder="Name, business, email, phone or social" /></div>
        <div className="field"><label htmlFor="st">Status</label><select id="st" name="status" defaultValue={sp.status ?? ""}><option value="">Any</option>{Object.entries(PROSPECT_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="field"><label htmlFor="ci">City</label><input id="ci" name="city" defaultValue={sp.city} placeholder="Any" /></div>
        <div className="field"><label htmlFor="co">County</label><input id="co" name="county" defaultValue={sp.county} placeholder="Any" /></div>
        <div className="field"><label htmlFor="ca">Category</label><select id="ca" name="category" defaultValue={sp.category ?? ""}><option value="">Any</option>{cats.map((c) => <option key={c.name}>{c.name}</option>)}</select></div>
        <div className="field"><label htmlFor="so">Source</label><select id="so" name="source" defaultValue={sp.source ?? ""}><option value="">Any</option>{[...new Set([...SOURCES, "Invitation link", "TikTok"])].map((x) => <option key={x}>{x}</option>)}</select></div>
        {showLeads && (
          <>
            <div className="field"><label htmlFor="by">Entered by</label><select id="by" name="by" defaultValue={sp.by ?? ""}><option value="">Anyone</option>{contributors.map((c) => <option key={c.userId!} value={c.userId!}>{c.name}</option>)}</select></div>
            <div className="field"><label htmlFor="me">Method</label><select id="me" name="method" defaultValue={sp.method ?? ""}><option value="">Any</option><option value="contributor">Lead Contributor (any)</option><option value="manual">Contributor — manual</option><option value="invitation">Contributor — invitation</option></select></div>
            <div className="field"><label htmlFor="fl">Flags</label><select id="fl" name="flag" defaultValue={sp.flag ?? ""}><option value="">Any</option><option value="conflict">Attribution conflict to review</option><option value="duplicate">Duplicate or possible duplicate</option></select></div>
          </>
        )}
        <div className="field"><label htmlFor="fr">From</label><input id="fr" name="from" type="date" defaultValue={sp.from} /></div>
        <div className="field"><label htmlFor="to">To</label><input id="to" name="to" type="date" defaultValue={sp.to} /></div>
        {isMain && <label className="check xs"><input type="checkbox" name="all" value="1" defaultChecked={all} /><span>Everyone&apos;s</span></label>}
        <button className="btn sm" type="submit" style={{ alignSelf: "end" }}>Filter</button>
      </form>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Professional</th><th>Category &amp; location</th><th>Contact</th><th>Source</th>{all && <th>Partner</th>}{showLeads && <th>Entered by</th>}<th>Status</th><th>Received</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="empty" colSpan={9}>No prospects match.</td></tr>}
            {rows.map(({ p, r, eFirst, eLast }) => (
              <tr key={p.id}>
                <td><Link className="link" href={`/admin/outreach/prospects/${p.id}`}>{p.name}</Link>{p.business && <div className="xs muted">{p.business}</div>}</td>
                <td>{p.category ?? "—"}<div className="xs muted">{[p.city, p.county ? `${p.county.replace(/\s+county$/i, "")} County` : null, p.state].filter(Boolean).join(", ") || "—"}</div></td>
                <td className="xs">{[p.email, p.phone, p.socialUrl].filter(Boolean).map((x, i) => <div key={i}>{x}</div>)}</td>
                <td>{p.source ?? "—"}</td>{all && <td>{r ?? "—"}</td>}
                {showLeads && <td className="xs">{p.enteredBy ? <>{[eFirst, eLast].filter(Boolean).join(" ") || "Lead Contributor"}<div className="muted">{p.entryMethod === "invitation" ? "Invitation link" : "Manual entry"}</div></> : <span className="muted">—</span>}</td>}
                <td>
                  <span className={`tag ${tone(p.status)}`}>{PROSPECT_STATUSES[p.status] ?? p.status}</span>
                  {p.conflictNote && !p.conflictReviewedAt && <div><span className="tag warn" style={{ marginTop: 4 }}>Attribution conflict</span></div>}
                  {p.duplicateOf && p.status !== "duplicate" && <div><span className="tag warn" style={{ marginTop: 4 }}>Possible duplicate</span></div>}
                </td>
                <td>{p.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
