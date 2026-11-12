import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { maxActivations, activatedStudents } from "./vouchers";
import { liveCoverage } from "./demand";

export type VoucherFilters = { cityId?: number | null; category?: string | null; distributorId?: string | null; kind?: string | null; placeId?: string | null };

/**
 * Admin → GRANTED vouchers dashboard. Counts only — never names, addresses or contact details.
 * Votes funnel: submitted → registered (linked to a student; every student verified their email at sign-up) →
 * eligibility-verified (school ID approved). Official demand = verified students' votes (one per student).
 */
export async function voucherReport(f: VoucherFilters) {
  const vw: SQL[] = [sql`true`];
  if (f.cityId) vw.push(sql`v.city_id = ${f.cityId}`);
  if (f.category) vw.push(sql`${f.category} = any(v.categories)`);
  const voteWhere = sql.join(vw, sql` and `);
  const cw: SQL[] = [sql`b.shared_number is not null`];
  if (f.distributorId) cw.push(sql`b.distributor_id = ${f.distributorId}`);
  if (f.kind === "discount" || f.kind === "free") cw.push(sql`b.kind = ${f.kind}`);
  const campWhere = sql.join(cw, sql` and `);
  const placeFilter = f.placeId ? sql`and d.place_id = ${f.placeId}` : sql``;

  const [funnel, camps, byCity, cats, orgs, max, students] = await Promise.all([
    db.execute(sql`select count(*)::int as votes,
        count(*) filter (where v.user_id is not null)::int as registered,
        count(*) filter (where u.email_verified_at is not null)::int as "emailVerified",
        count(*) filter (where sp.verification_status = 'verified')::int as verified,
        count(*) filter (where exists (select 1 from nearest_cards c where c.shared and c.student_id = v.user_id and c.status = 'activated'))::int as activated
      from student_votes v left join users u on u.id = v.user_id left join student_profiles sp on sp.user_id = v.user_id where ${voteWhere}`),
    db.execute(sql`select b.id, b.name, b.kind, b.status, b.count as printed, b.amount_cents as "amountCents", b.valid_thru as "validThru", b.shared_number as number, b.shared_code as code, b.distributor_id as "distributorId",
        coalesce(nullif(trim(u.first_name || ' ' || coalesce(u.last_name, '')), ''), u.email) as distributor,
        (select coalesce(sum(d.quantity), 0)::int from voucher_distributions d where d.batch_id = b.id ${placeFilter}) as distributed,
        (select count(*)::int from nearest_cards c where c.batch_id = b.id and c.shared and c.status = 'activated') as activations,
        (select count(*)::int from nearest_cards c where c.batch_id = b.id and c.shared and c.credit_id is not null) as used
      from nearest_card_batches b left join users u on u.id = b.distributor_id where ${campWhere} order by distributor, b.kind`),
    db.execute(sql`select v.city_id as "cityId", ci.name as city, ci.state,
        count(*)::int as votes, count(*) filter (where v.user_id is not null)::int as registered,
        count(*) filter (where sp.verification_status = 'verified')::int as verified,
        count(*) filter (where exists (select 1 from nearest_cards c where c.shared and c.student_id = v.user_id and c.status = 'activated'))::int as activated
      from student_votes v join cities ci on ci.id = v.city_id left join student_profiles sp on sp.user_id = v.user_id
      where ${voteWhere} group by v.city_id, ci.name, ci.state order by votes desc limit 200`),
    db.execute(sql`select v.city_id as "cityId", x.cat as category, count(*)::int as votes,
        count(*) filter (where sp.verification_status = 'verified')::int as verified
      from student_votes v cross join lateral unnest(v.categories) as x(cat) left join student_profiles sp on sp.user_id = v.user_id
      where ${voteWhere} group by v.city_id, x.cat`),
    db.execute(sql`select p.id, p.name, ci.name as city, coalesce(sum(d.quantity), 0)::int as distributed, max(d.distributed_at) as last
      from voucher_distributions d join nearest_card_batches b on b.id = d.batch_id join card_places p on p.id = d.place_id left join cities ci on ci.id = p.city_id
      where ${campWhere} ${placeFilter} group by p.id, p.name, ci.name order by distributed desc`),
    maxActivations(), activatedStudents(),
  ]);
  const live = await liveCoverage();
  const liveSet = new Set(live.map((l) => `${l.cityId}|${l.category}`));
  const catRows = cats.rows as { cityId: number; category: string; votes: number; verified: number }[];
  const totals = new Map<string, { votes: number; verified: number }>();
  for (const r of catRows) { const t = totals.get(r.category) ?? { votes: 0, verified: 0 }; t.votes += r.votes; t.verified += r.verified; totals.set(r.category, t); }
  const campaigns = camps.rows as { id: string; name: string; kind: string; status: string; printed: number; amountCents: number; validThru: Date; number: string; code: string; distributorId: string | null; distributor: string | null; distributed: number; activations: number; used: number }[];
  const sum = (k: "printed" | "distributed" | "activations" | "used", kind?: string) => campaigns.filter((c) => !kind || c.kind === kind).reduce((n, c) => n + Number(c[k]), 0);
  return {
    funnel: funnel.rows[0] as { votes: number; registered: number; emailVerified: number; verified: number; activated: number },
    campaigns,
    totals: { printed: sum("printed"), distributed: sum("distributed"), activations: sum("activations"), discount: sum("activations", "discount"), free: sum("activations", "free"), used: sum("used"), students, max, left: Math.max(0, max - students) },
    byCity: (byCity.rows as { cityId: number; city: string; state: string; votes: number; registered: number; verified: number; activated: number }[]).map((c) => ({
      ...c,
      top: catRows.filter((r) => r.cityId === c.cityId).sort((a, b) => b.verified - a.verified || b.votes - a.votes).slice(0, 6).map((r) => ({ ...r, live: liveSet.has(`${c.cityId}|${r.category}`) })),
    })),
    categories: [...totals.entries()].map(([category, t]) => ({ category, ...t })).sort((a, b) => b.verified - a.verified || b.votes - a.votes),
    orgs: orgs.rows as { id: string; name: string; city: string | null; distributed: number; last: Date | null }[],
  };
}
