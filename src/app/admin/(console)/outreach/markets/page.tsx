import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { db, cities, categories, slotOpenings } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { requireAdmin } from "@/lib/admin";
import { slotLimits } from "@/lib/slots";
import { ActionForm } from "@/components/ActionForm";
import { authorizeOpening } from "@/app/admin/capacity-actions";

export const metadata = { title: "Markets" };

/** Every city with joined professionals: how full each category is (the same count the Join page enforces). */
export default async function Markets({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { role } = await requireAdmin();
  const sp = await searchParams;
  const { firstIn, cap: max } = await slotLimits();
  const opened = new Set((await db.select({ c: slotOpenings.cityId, k: slotOpenings.categoryId }).from(slotOpenings)).map((o) => `${o.c}:${o.k}`));
  const capOf = (cityId: number, catId: number) => (opened.has(`${cityId}:${catId}`) ? max : firstIn);
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
      <span className="small muted">Every city, in every state, opens each service category with {firstIn} spots. When they&apos;re taken, enrollment closes for that category in that city (waitlist). An owner may authorize one additional opening of {max - firstIn} — {max} is the most any category can ever have. Nothing reopens automatically. Counts are the same ones the Join page and waitlist use.</span>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>City</th><th>Professionals</th><th>Categories closed</th><th>Booking</th></tr></thead>
          <tbody>
            {used.length === 0 && <tr><td className="empty" colSpan={4}>No professionals have joined yet.</td></tr>}
            {used.map((c) => {
              const mine = counts.filter((x) => x.city_id === c.id);
              return (
                <tr key={c.id}>
                  <td><Link className="link" href={`/admin/outreach/markets?city=${c.id}`}>{c.name}</Link></td>
                  <td className="num">{mine.reduce((t, x) => t + x.n, 0)}</td>
                  <td className="num">{mine.filter((x) => x.n >= capOf(c.id, x.category_id)).length}</td>
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
            const cap = capOf(sel.id, x.category_id), second = opened.has(`${sel.id}:${x.category_id}`);
            const closed = x.n >= cap;
            return (
              <div key={x.category_id} className="col" style={{ gap: 6, borderTop: "1px solid #1C1C1F", paddingTop: 8 }}>
                <div className="row between small"><span>{name}{second && <span className="xs muted"> · additional opening authorized</span>}</span><span><span className="b">{x.n}/{cap}</span> {closed ? <span className="tag bad">Closed</span> : <span className="tag ok">{cap - x.n} open</span>}</span></div>
                {closed && !second && max > firstIn && role === "OWNER" && (
                  <details><summary className="link xs">Authorize the additional opening ({max - firstIn} more spots)</summary>
                    <ActionForm action={authorizeOpening} submitLabel={`Open ${max - firstIn} more spots`} buttonClass="btn sm">
                      <input type="hidden" name="cityId" value={sel.id} /><input type="hidden" name="categoryId" value={x.category_id} />
                      <div className="field"><label htmlFor={`n-${x.category_id}`}>Note (optional)</label><input id={`n-${x.category_id}`} name="note" maxLength={300} placeholder="Why now — demand, waitlist, bookings" /></div>
                      <label className="check xs"><input type="checkbox" name="confirm" required /><span>Open {name} in {sel.name} to {max} in total. This is the only additional opening and can&apos;t be undone.</span></label>
                    </ActionForm>
                  </details>
                )}
              </div>
            );
          })}
          <span className="xs muted">Categories not listed have all {firstIn} spots open — good ones to prospect next.</span>
        </div>
      )}
    </>
  );
}
