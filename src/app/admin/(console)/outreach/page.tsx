import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db, prospects, prospectEvents, users, adminMembers } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { CopyText } from "@/components/CopyText";
import { requireAdmin } from "@/lib/admin";
import { outreachScope, PROSPECT_STATUSES } from "@/lib/outreach";

export const metadata = { title: "Professional Outreach" };

/** Each partner works their own prospects; the main owner can switch to everyone combined. */
export default async function OutreachDashboard({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { user } = await requireAdmin();
  const { isMain } = await outreachScope(user.id);
  const all = isMain && (await searchParams).all === "1";
  const mine = all ? sql`true` : eq(prospects.recruiterId, user.id);
  const counts = await db.select({ status: prospects.status, n: sql<number>`count(*)::int` }).from(prospects).where(mine).groupBy(prospects.status);
  const n = (k: string) => counts.find((c) => c.status === k)?.n ?? 0;
  const total = counts.reduce((t, c) => t + c.n, 0);
  const me = await db.query.adminMembers.findFirst({ where: eq(adminMembers.userId, user.id) });
  const h = await (await import("next/headers")).headers();
  const link = me?.partnerCode ? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}/pro?ref=${me.partnerCode}` : null;
  const recent = await db.select({ e: prospectEvents, name: prospects.name, pid: prospects.id }).from(prospectEvents).innerJoin(prospects, eq(prospects.id, prospectEvents.prospectId)).where(mine).orderBy(desc(prospectEvents.createdAt)).limit(12);
  const byRecruiter = all ? await db.select({ first: users.firstName, total: sql<number>`count(*)::int`, reg: sql<number>`count(*) filter (where ${prospects.status} in ('registered','profile_complete'))::int` }).from(prospects).leftJoin(users, eq(users.id, prospects.recruiterId)).groupBy(users.firstName) : [];
  const ready = n("approved") + n("new");
  const kpi = (label: string, v: number, sub?: string) => <div className="card" style={{ gap: 4 }}><span className="xs muted">{label}</span><span className="stat">{v}</span>{sub && <span className="xs muted">{sub}</span>}</div>;
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title={all ? "Everyone's recruiting" : "My recruiting"} />
      <OutreachNav at="dashboard" />
      {isMain && <div className="row" style={{ gap: 6 }}><Link className={`chip${!all ? " on" : ""}`} href="/admin/outreach">Mine</Link><Link className={`chip${all ? " on" : ""}`} href="/admin/outreach?all=1">Everyone</Link></div>}
      {link && !all && (
        <div className="card" style={{ gap: 6 }}>
          <span className="eyebrow">Your recruiter link</span>
          <span className="small">Every professional who joins through this link is credited to you — from outreach, Facebook groups, QR codes, anywhere.</span>
          <CopyText text={link} />
        </div>
      )}
      <div className="kpis k4">
        {kpi("Prospects", total)}{kpi("Ready (not contacted)", ready, ready <= 15 && total > 0 ? "Running low — add more" : undefined)}{kpi("Registered", n("registered") + n("profile_complete"))}{kpi("Profiles complete", n("profile_complete"))}
      </div>
      <div className="kpis k4">
        {kpi("Contacted", n("contacted") + n("conversation") + n("interested"))}{kpi("Links sent", n("link_sent") + n("link_clicked"))}{kpi("Needs review", n("needs_review"))}{kpi("Opted out / declined", n("opted_out") + n("declined"))}
      </div>
      {total === 0 && <div className="card small"><span>No prospects yet. <Link className="link" href="/admin/outreach/add">Add one</Link> or <Link className="link" href="/admin/outreach/import">upload a list</Link>.</span></div>}
      <div className="card small"><span><span className="b">Email outreach and the AI recruiter are coming next.</span> For now, add and organize prospects, share your link, and watch registrations come in — anyone who registers is marked automatically and never recruited again.</span></div>
      {all && byRecruiter.length > 0 && (
        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">By partner</span>
          {byRecruiter.map((r, i) => <div key={i} className="row between small"><span>{r.first ?? "Unassigned"}</span><span>{r.total} prospects • <span className="b">{r.reg} registered</span></span></div>)}
        </div>
      )}
      <div className="card" style={{ gap: 6 }}>
        <span className="eyebrow">Recent activity</span>
        {recent.length === 0 && <span className="small muted">Nothing yet.</span>}
        {recent.map(({ e, name, pid }) => <Link key={e.id} href={`/admin/outreach/prospects/${pid}`} className="row between small" style={{ textDecoration: "none", color: "inherit" }}><span><span className="b">{name}</span> — {PROSPECT_STATUSES[e.kind] ?? e.kind.replace("_", " ")}{e.detail ? `: ${e.detail.slice(0, 80)}` : ""}</span><span className="xs muted">{e.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}</span></Link>)}
      </div>
    </>
  );
}
