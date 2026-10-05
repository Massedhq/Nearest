import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { db, cities, categories } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { requireAdmin } from "@/lib/admin";
import { slotLimits } from "@/lib/slots";

export const metadata = { title: "Markets" };

/** Every city with joined professionals: how full each category is (the same count the Join page enforces). */
export default async function Markets({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const { cap } = await slotLimits();
  const counts = await db.execute<{ city_id: number; category_id: number; n: number }>(sql`
    select x.city_id, x.category_id, count(distinct x.user_id)::int as n from (
      select ps.user_id, pp.city_id, ps.category_id from pro_services ps join professional_profiles pp on pp.user_id = ps.user_id
        where ps.active and pp.placement_released_at is null and (pp.entry_paid_at is not null or pp.entry_hold_until > now())
      union
      select pp.user_id, pp.slot_city_id, pp.slot_category_id from professional_profiles pp
        where pp.slot_city_id is not null and pp.placement_released_at is null and (pp.entry_paid_at is not null or pp.entry_hold_until > now())
    ) x where x.city_id is not null group by 1, 2`).then((r) => r.rows);
  const [cityList, cats] = await Promise.all([db.select().from(cities).orderBy(asc(cities.name)), db.select({ id: categories.id, name: categories.name }).from(categories)]);
  const used = cityList.filter((c) => counts.some((x) => x.city_id === c.id));
  const sel = sp.city ? cityList.find((c) => String(c.id) === sp.city) : null;
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="Markets" />
      <OutreachNav at="markets" />
      <span className="small muted">Each city has {cap} spots per category. This is the same count the Join page and the waitlist use — it updates the moment someone joins.</span>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>City</th><th>Professionals</th><th>Categories full</th><th>Booking</th></tr></thead>
          <tbody>
            {used.length === 0 && <tr><td className="empty" colSpan={4}>No professionals have joined yet.</td></tr>}
            {used.map((c) => {
              const mine = counts.filter((x) => x.city_id === c.id);
              return (
                <tr key={c.id}>
                  <td><Link className="link" href={`/admin/outreach/markets?city=${c.id}`}>{c.name}</Link></td>
                  <td className="num">{mine.reduce((t, x) => t + x.n, 0)}</td>
                  <td className="num">{mine.filter((x) => x.n >= cap).length}</td>
                  <td><span className="tag ok">Enrolling</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sel && (
        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">{sel.name} — by category</span>
          {counts.filter((x) => x.city_id === sel.id).sort((a, b) => b.n - a.n).map((x) => {
            const name = cats.find((k) => k.id === x.category_id)?.name ?? "—";
            return <div key={x.category_id} className="row between small"><span>{name}</span><span><span className="b">{x.n}/{cap}</span> {x.n >= cap ? <span className="tag bad">Full</span> : <span className="tag ok">{cap - x.n} open</span>}</span></div>;
          })}
          <span className="xs muted">Categories not listed have all {cap} spots open — good ones to prospect next.</span>
        </div>
      )}
    </>
  );
}
