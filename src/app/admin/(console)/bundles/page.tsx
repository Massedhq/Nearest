import { desc, eq, sql } from "drizzle-orm";
import { db, bundles, bundleItems, bookings, categories, users } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { requireAdmin } from "@/lib/admin";
import { fmtDate, money } from "@/lib/time";

export const metadata = { title: "Bundle Me" };

/** Bundle Me usage: how many bundles were started, finished and booked, which categories, and who is using it. */
export default async function BundleMeAdmin() {
  await requireAdmin();
  const [totals] = await db.select({
    started: sql<number>`count(*)::int`,
    building: sql<number>`count(*) filter (where ${bundles.status} = 'building')::int`,
    ready: sql<number>`count(*) filter (where ${bundles.status} = 'ready')::int`,
    booked: sql<number>`count(*) filter (where ${bundles.status} = 'booked')::int`,
    expired: sql<number>`count(*) filter (where ${bundles.status} = 'expired')::int`,
    students: sql<number>`count(distinct ${bundles.studentId})::int`,
    avgBudget: sql<number>`coalesce(avg(${bundles.budgetCents}),0)::int`,
  }).from(bundles);
  const [bk] = await db.select({ n: sql<number>`count(*)::int`, revenue: sql<number>`coalesce(sum(${bookings.chargedCents}),0)::int` })
    .from(bookings).where(sql`${bookings.bundleId} is not null and ${bookings.status} in ('confirmed','completed')`);
  const cats = await db.select({ id: categories.id, name: categories.name }).from(categories);
  const catUse = await db.execute<{ cid: number; n: number }>(sql`select (jsonb_array_elements_text(category_ids))::int as cid, count(*)::int as n from bundles group by 1 order by 2 desc`).then((r) => r.rows);
  const recent = await db.select({
    b: bundles, first: users.firstName, last: users.lastName,
    saved: sql<number>`(select count(*)::int from ${bundleItems} where ${bundleItems.bundleId} = ${bundles.id})`,
    bookedN: sql<number>`(select count(*)::int from ${bookings} where ${bookings.bundleId} = ${bundles.id} and ${bookings.status} in ('confirmed','completed'))`,
  }).from(bundles).innerJoin(users, eq(users.id, bundles.studentId)).orderBy(desc(bundles.createdAt)).limit(60);
  const top = await db.select({ first: users.firstName, last: users.lastName, n: sql<number>`count(*)::int` })
    .from(bundles).innerJoin(users, eq(users.id, bundles.studentId)).groupBy(users.id, users.firstName, users.lastName).orderBy(desc(sql`count(*)`)).limit(10);
  const name = (f: string | null, l: string | null) => [f, l ? `${l[0]}.` : ""].filter(Boolean).join(" ") || "Student";
  const shortDay = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <>
      <AdminHead eyebrow="Business" title="Bundle Me" />
      <div className="kpis k4">
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Bundles started</span><span className="stat">{totals.started}</span><span className="xs muted">by {totals.students} student{totals.students === 1 ? "" : "s"}</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Fully booked</span><span className="stat">{totals.booked}</span><span className="xs muted">{totals.ready} ready • {totals.building} in progress</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Bundle bookings</span><span className="stat">{bk.n}</span><span className="xs muted">{money(bk.revenue)} paid</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Average budget</span><span className="stat">{money(totals.avgBudget)}</span><span className="xs muted">{totals.expired} expired unbooked</span></div>
      </div>
      <div className="acols even">
        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">Most bundled categories</span>
          {catUse.length === 0 && <span className="small muted">No bundles yet.</span>}
          {catUse.map((c) => <div key={c.cid} className="row between small"><span>{cats.find((k) => k.id === c.cid)?.name ?? "—"}</span><span className="b">{c.n}</span></div>)}
        </div>
        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">Students using it most</span>
          {top.length === 0 && <span className="small muted">No bundles yet.</span>}
          {top.map((t, i) => <div key={i} className="row between small"><span>{name(t.first, t.last)}</span><span className="b">{t.n}</span></div>)}
        </div>
      </div>
      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Recent bundles</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Student</th><th>Categories</th><th>Budget</th><th>Week of</th><th>Saved</th><th>Booked</th><th>Status</th><th>Started</th></tr></thead>
            <tbody>
              {recent.length === 0 && <tr><td className="empty" colSpan={8}>No bundles yet.</td></tr>}
              {recent.map(({ b, first, last, saved, bookedN }) => (
                <tr key={b.id}>
                  <td>{name(first, last)}</td>
                  <td>{b.categoryIds.map((id) => cats.find((c) => c.id === id)?.name).filter(Boolean).join(", ")}</td>
                  <td className="num">{money(b.budgetCents)}</td>
                  <td>{shortDay(b.startDate)}</td>
                  <td className="num">{saved} / {b.categoryIds.length}</td>
                  <td className="num">{bookedN}</td>
                  <td><span className={`tag ${b.status === "booked" ? "ok" : b.status === "expired" ? "bad" : "warn"}`}>{b.status === "booked" ? "Booked" : b.status === "ready" ? "Ready" : b.status === "expired" ? "Expired" : "In progress"}</span></td>
                  <td>{fmtDate(b.createdAt, { month: "short", day: "numeric" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
