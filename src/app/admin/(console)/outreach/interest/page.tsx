import { desc, sql } from "drizzle-orm";
import { db, locationInterest, categories } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { requireAdmin } from "@/lib/admin";
import { markInterestContacted } from "@/app/admin/interest-actions";

export const metadata = { title: "City interest" };
export const dynamic = "force-dynamic";

/** People who used the public city checker and asked to hear when Nearest opens (opt-in), by place and role. */
export default async function CityInterest() {
  await requireAdmin();
  const [byPlace, recent, cats] = await Promise.all([
    db.select({ state: locationInterest.state, city: locationInterest.city,
      pros: sql<number>`count(*) filter (where ${locationInterest.role} = 'professional')::int`,
      students: sql<number>`count(*) filter (where ${locationInterest.role} = 'student')::int`,
      parents: sql<number>`count(*) filter (where ${locationInterest.role} = 'parent')::int`,
      status: sql<string>`max(${locationInterest.status})` })
      .from(locationInterest).groupBy(locationInterest.state, locationInterest.city).orderBy(sql`count(*) desc`).limit(200),
    db.select().from(locationInterest).orderBy(desc(locationInterest.createdAt)).limit(200),
    db.select({ id: categories.id, name: categories.name }).from(categories),
  ]);
  const cat = (id: number | null) => cats.find((c) => c.id === id)?.name ?? "—";
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="City interest" />
      <OutreachNav at="interest" />
      <span className="small muted">From the public city checker (usenearest.com/locations). Everyone here ticked a box agreeing Nearest may email them about Nearest in their city — nothing is sent automatically. Use it to decide where to open next and who to contact first.</span>
      <div className="card" style={{ overflowX: "auto" }}>
        <span className="eyebrow">Demand by city</span>
        <table className="tbl">
          <thead><tr><th>City</th><th>Professionals</th><th>Students</th><th>Parents</th><th>Status shown</th></tr></thead>
          <tbody>
            {byPlace.length === 0 && <tr><td className="empty" colSpan={5}>No one has asked yet.</td></tr>}
            {byPlace.map((r) => <tr key={`${r.state}-${r.city}`}><td>{r.city}, {r.state}</td><td className="num">{r.pros}</td><td className="num">{r.students}</td><td className="num">{r.parents}</td><td>{r.status.replace("_", " ")}</td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ overflowX: "auto" }}>
        <span className="eyebrow">Latest</span>
        <table className="tbl">
          <thead><tr><th>When</th><th>Who</th><th>Email</th><th>City</th><th>Service</th><th>From</th><th /></tr></thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id}>
                <td className="xs">{r.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}</td>
                <td>{r.role}{r.name ? ` · ${r.name}` : ""}</td><td className="xs">{r.email}</td><td>{r.city}, {r.state}</td><td>{cat(r.categoryId)}</td><td className="xs muted">{r.source ?? "—"}</td>
                <td>{r.contactedAt ? <span className="tag ok">Contacted</span> : <form action={markInterestContacted}><input type="hidden" name="id" value={r.id} /><button className="link xs" type="submit">Mark contacted</button></form>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
