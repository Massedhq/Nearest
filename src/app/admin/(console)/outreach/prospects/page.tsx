import Link from "next/link";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, prospects, users } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { requireAdmin } from "@/lib/admin";
import { outreachScope, PROSPECT_STATUSES, SOURCES } from "@/lib/outreach";

export const metadata = { title: "Prospects" };

export default async function Prospects({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { user } = await requireAdmin();
  const { isMain } = await outreachScope(user.id);
  const sp = await searchParams;
  const all = isMain && sp.all === "1";
  const where: SQL[] = [];
  if (!all) where.push(eq(prospects.recruiterId, user.id));
  if (sp.q) { const q = `%${sp.q.trim()}%`; where.push(or(ilike(prospects.name, q), ilike(prospects.business, q), ilike(prospects.email, q), ilike(prospects.phone, q))!); }
  if (sp.status) where.push(eq(prospects.status, sp.status));
  if (sp.city) where.push(ilike(prospects.city, sp.city));
  if (sp.category) where.push(ilike(prospects.category, `%${sp.category}%`));
  if (sp.source) where.push(eq(prospects.source, sp.source));
  const rows = await db.select({ p: prospects, r: users.firstName }).from(prospects).leftJoin(users, eq(users.id, prospects.recruiterId))
    .where(where.length ? and(...where) : sql`true`).orderBy(desc(prospects.createdAt)).limit(300);
  const tone = (st: string) => (["registered", "profile_complete"].includes(st) ? "ok" : ["opted_out", "declined", "ineligible"].includes(st) ? "bad" : st === "needs_review" ? "warn" : "");
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="Prospects" />
      <OutreachNav at="prospects" />
      <form className="card row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ minWidth: 200, flex: 1 }}><label htmlFor="q">Search</label><input id="q" name="q" defaultValue={sp.q} placeholder="Name, business, email or phone" /></div>
        <div className="field"><label htmlFor="st">Status</label><select id="st" name="status" defaultValue={sp.status ?? ""}><option value="">Any</option>{Object.entries(PROSPECT_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="field"><label htmlFor="ci">City</label><input id="ci" name="city" defaultValue={sp.city} placeholder="Any" /></div>
        <div className="field"><label htmlFor="ca">Category</label><input id="ca" name="category" defaultValue={sp.category} placeholder="Any" /></div>
        <div className="field"><label htmlFor="so">Source</label><select id="so" name="source" defaultValue={sp.source ?? ""}><option value="">Any</option>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select></div>
        {isMain && <label className="check xs"><input type="checkbox" name="all" value="1" defaultChecked={all} /><span>Everyone&apos;s</span></label>}
        <button className="btn sm" type="submit">Filter</button>
      </form>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Name</th><th>City</th><th>Category</th><th>Contact</th><th>Source</th>{all && <th>Partner</th>}<th>Status</th><th>Added</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="empty" colSpan={8}>No prospects match.</td></tr>}
            {rows.map(({ p, r }) => (
              <tr key={p.id}>
                <td><Link className="link" href={`/admin/outreach/prospects/${p.id}`}>{p.name}</Link>{p.business && <div className="xs muted">{p.business}</div>}</td>
                <td>{p.city ?? "—"}</td><td>{p.category ?? "—"}</td>
                <td className="xs">{p.email ?? ""}{p.email && p.phone ? <br /> : null}{p.phone ?? ""}</td>
                <td>{p.source ?? "—"}</td>{all && <td>{r ?? "—"}</td>}
                <td><span className={`tag ${tone(p.status)}`}>{PROSPECT_STATUSES[p.status] ?? p.status}</span></td>
                <td>{p.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
