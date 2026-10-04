import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { requireAdmin } from "@/lib/admin";
import { outreachScope } from "@/lib/outreach";

export const metadata = { title: "Outreach reports" };
type Row = { k: string | null; added: number; emailed: number; replied: number; links: number; clicked: number; joined: number; complete: number };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

function Table({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="card" style={{ gap: 8 }}>
      <span className="eyebrow">{title}</span>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th /><th className="num">Added</th><th className="num">Emailed</th><th className="num">Replied</th><th className="num">Clicked</th><th className="num">Joined</th><th className="num">Joined %</th><th className="num">Profile done</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="empty" colSpan={8}>No prospects in this period.</td></tr>}
            {rows.map((r) => <tr key={r.k ?? "?"}><td className="b">{r.k}</td><td className="num">{r.added}</td><td className="num">{r.emailed}</td><td className="num">{r.replied}</td><td className="num">{r.clicked}</td><td className="num b">{r.joined}</td><td className="num">{pct(r.joined, r.added)}</td><td className="num">{r.complete}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Which recruiters, sources, cities and categories actually produce professionals. */
export default async function OutreachReports({ searchParams }: { searchParams: Promise<{ range?: string; who?: string }> }) {
  const { user } = await requireAdmin();
  const { isMain } = await outreachScope(user.id);
  const sp = await searchParams;
  const range = ["today", "week", "month"].includes(sp.range ?? "") ? sp.range! : "all";
  const everyone = isMain && sp.who !== "mine";
  const since = range === "today" ? sql`date_trunc('day', now() at time zone 'America/Chicago') at time zone 'America/Chicago'` : range === "week" ? sql`now() - interval '7 days'` : range === "month" ? sql`now() - interval '30 days'` : sql`'-infinity'::timestamptz`;
  const scope = everyone ? sql`true` : sql`p.recruiter_id = ${user.id}::uuid`;
  const group = async (col: ReturnType<typeof sql>) => (await db.execute<Row>(sql`select ${col} as k,
      count(*)::int as added,
      count(*) filter (where p.emails_sent > 0)::int as emailed,
      count(*) filter (where exists (select 1 from prospect_messages m where m.prospect_id = p.id and m.direction = 'in'))::int as replied,
      count(*) filter (where p.link_sent_at is not null)::int as links,
      count(*) filter (where p.link_clicked_at is not null)::int as clicked,
      count(*) filter (where p.status in ('registered','profile_complete'))::int as joined,
      count(*) filter (where p.status = 'profile_complete')::int as complete
    from prospects p left join users u on u.id = p.recruiter_id
    where p.created_at >= ${since} and ${scope}
    group by 1 order by joined desc, added desc limit 30`)).rows;
  const [total] = await group(sql`'All'`);
  const [byRecruiter, bySource, byCity, byCategory] = await Promise.all([
    group(sql`coalesce(u.first_name, 'Unassigned')`), group(sql`coalesce(p.source, 'Unknown')`), group(sql`coalesce(p.city, 'Unknown')`), group(sql`coalesce(p.category, 'Unknown')`),
  ]);
  const t = total ?? { added: 0, emailed: 0, replied: 0, links: 0, clicked: 0, joined: 0, complete: 0 };
  const q = (o: Record<string, string>) => `?${new URLSearchParams({ range, ...(everyone ? {} : { who: "mine" }), ...o }).toString()}`;
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="Reports" />
      <OutreachNav at="reports" />
      <div className="chips">
        {(["today", "week", "month", "all"] as const).map((r) => <Link key={r} className={`chip${range === r ? " on" : ""}`} href={q({ range: r })}>{r === "today" ? "Today" : r === "week" ? "This week" : r === "month" ? "This month" : "All time"}</Link>)}
        {isMain && <><Link className={`chip${everyone ? " on" : ""}`} href={`?range=${range}`}>Everyone</Link><Link className={`chip${!everyone ? " on" : ""}`} href={`?range=${range}&who=mine`}>Mine</Link></>}
      </div>
      <div className="kpis k4">
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Prospects added</span><span className="stat">{t.added}</span><span className="xs muted">{t.emailed} emailed</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Replied</span><span className="stat">{t.replied}</span><span className="xs muted">{pct(t.replied, t.emailed)} of emailed</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Links sent • clicked</span><span className="stat">{t.links} • {t.clicked}</span><span className="xs muted">{pct(t.clicked, t.links)} click rate</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Joined • profile done</span><span className="stat">{t.joined} • {t.complete}</span><span className="xs muted">{pct(t.joined, t.added)} of prospects joined</span></div>
      </div>
      {everyone && <Table title="By recruiter" rows={byRecruiter} />}
      <Table title="By source (where you found them)" rows={bySource} />
      <Table title="By city" rows={byCity} />
      <Table title="By category" rows={byCategory} />
    </>
  );
}
