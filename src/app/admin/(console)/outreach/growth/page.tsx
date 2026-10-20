import { sql } from "drizzle-orm";
import { db } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { requireAdmin } from "@/lib/admin";

export const metadata = { title: "Growth report" };
export const dynamic = "force-dynamic";

type Row = { wk: string; students: number; verified: number; pros: number; pros_referred: number; rep: number; requests: number; completed: number; interest: number };

/**
 * Weekly registrations, referrals, bookings and city-interest sign-ups — the numbers to read next to Search Console
 * (impressions/clicks) when judging whether the public resource center is working. Read-only.
 */
export default async function Growth() {
  await requireAdmin();
  const rows = (await db.execute<Row>(sql`
    with weeks as (select generate_series(date_trunc('week', now() at time zone 'America/Chicago') - interval '11 weeks', date_trunc('week', now() at time zone 'America/Chicago'), interval '1 week') as wk)
    select to_char(w.wk, 'Mon DD') as wk,
      (select count(*)::int from users u where u.account_type = 'student' and date_trunc('week', u.created_at at time zone 'America/Chicago') = w.wk) as students,
      (select count(*)::int from student_profiles sp join users u on u.id = sp.user_id where sp.verification_status = 'verified' and date_trunc('week', u.created_at at time zone 'America/Chicago') = w.wk) as verified,
      (select count(*)::int from users u where u.account_type = 'professional' and date_trunc('week', u.created_at at time zone 'America/Chicago') = w.wk) as pros,
      (select count(*)::int from professional_profiles p join users u on u.id = p.user_id where p.referred_by is not null and date_trunc('week', u.created_at at time zone 'America/Chicago') = w.wk) as pros_referred,
      (select count(*)::int from users u where u.rep_id is not null and date_trunc('week', u.created_at at time zone 'America/Chicago') = w.wk) as rep,
      (select count(*)::int from bookings b where date_trunc('week', b.created_at at time zone 'America/Chicago') = w.wk) as requests,
      (select count(*)::int from bookings b where b.status = 'completed' and date_trunc('week', b.starts_at at time zone 'America/Chicago') = w.wk) as completed,
      (select count(*)::int from location_interest li where date_trunc('week', li.created_at at time zone 'America/Chicago') = w.wk) as interest
    from weeks w order by w.wk desc`)).rows;
  const sum = (k: keyof Row) => rows.reduce((t, r) => t + Number(r[k]), 0);
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="Growth report" />
      <OutreachNav at="growth" />
      <span className="small muted">Last 12 weeks (Central time). Read it with Google Search Console: if impressions and clicks on the public pages rise, sign-ups, city interest and bookings here should follow a few weeks later. Partner and sales-rep columns show referral-driven sign-ups.</span>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Week of</th><th>Student sign-ups</th><th>…verified</th><th>Pro sign-ups</th><th>…via partner</th><th>Via sales rep</th><th>Booking requests</th><th>Completed</th><th>City interest</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.wk}><td>{r.wk}</td><td className="num">{r.students}</td><td className="num">{r.verified}</td><td className="num">{r.pros}</td><td className="num">{r.pros_referred}</td><td className="num">{r.rep}</td><td className="num">{r.requests}</td><td className="num">{r.completed}</td><td className="num">{r.interest}</td></tr>)}
            <tr><td className="b">12 weeks</td><td className="num b">{sum("students")}</td><td className="num b">{sum("verified")}</td><td className="num b">{sum("pros")}</td><td className="num b">{sum("pros_referred")}</td><td className="num b">{sum("rep")}</td><td className="num b">{sum("requests")}</td><td className="num b">{sum("completed")}</td><td className="num b">{sum("interest")}</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
