import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { requireAdmin } from "@/lib/admin";
import { INSURANCE_CHOICES, INSURANCE_INTERESTS } from "@/lib/insurance";
import { fmtDate } from "@/lib/time";
import { personName } from "@/lib/pro-name";

export const metadata = { title: "Insurance interest" };
export const dynamic = "force-dynamic";

type Row = { user_id: string; display_name: string | null; first_name: string | null; last_name: string | null; business_name: string | null; choice: string | null; interest: string | null; answered: string | null; registered: string | null; signed_up: string };

/**
 * Insurance Interest report: each professional's self-reported Professional Protection preference. Read-only —
 * there are no documents, policy checks, expiration tracking or approvals; Nearest doesn't sell or verify insurance.
 */
export default async function InsuranceInterest({ searchParams }: { searchParams: Promise<{ choice?: string; interest?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const choice = sp.choice && (sp.choice in INSURANCE_CHOICES || sp.choice === "none") ? sp.choice : "";
  const interest = sp.interest && sp.interest in INSURANCE_INTERESTS ? sp.interest : "";
  const r = await db.execute<Row>(sql`
    select p.user_id, p.display_name, u.first_name, u.last_name, p.business_name, p.insurance_choice as choice, p.insurance_interest as interest,
      p.insurance_choice_at::text as answered, p.entry_paid_at::text as registered, u.created_at::text as signed_up
    from professional_profiles p join users u on u.id = p.user_id
    where u.account_type <> 'student'
    order by p.insurance_choice_at desc nulls last, u.created_at desc`);
  const all = r.rows;
  const count = (f: (x: Row) => boolean) => all.filter(f).length;
  const rows = all.filter((x) => (!choice || (choice === "none" ? !x.choice : x.choice === choice)) && (!interest || x.interest === interest));
  const d = (v: string | null) => (v ? fmtDate(new Date(v), { month: "short", day: "numeric", year: "numeric" }) : "—");
  const stat = { flex: "1 1 140px", minWidth: 0, gap: 2 } as const;
  return (
    <>
      <AdminHead eyebrow="Professional Protection" title="Insurance interest" />
      <p className="xs muted p">What professionals told us on the Professional Protection question (on the last registration page, or on their home screen if they registered earlier). It&apos;s self-reported only: Nearest doesn&apos;t sell, quote or verify insurance and never collects insurers, policy numbers, dates or documents. The $3-per-booking and $49-a-year models are proposals for a future licensed insurance partner — nothing is charged.</p>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <div className="card" style={stat}><span className="xs muted">Already have insurance</span><span className="disp h2" style={{ margin: 0 }}>{count((x) => x.choice === "has")}</span></div>
        <div className="card" style={stat}><span className="xs muted">Interested through Nearest</span><span className="disp h2" style={{ margin: 0 }}>{count((x) => x.choice === "interested")}</span></div>
        <div className="card" style={stat}><span className="xs muted">— pay per booking / annual / more info</span><span className="disp h2" style={{ margin: 0 }}>{count((x) => x.interest === "per_booking")} / {count((x) => x.interest === "annual")} / {count((x) => x.interest === "more_info")}</span></div>
        <div className="card" style={stat}><span className="xs muted">Not interested right now</span><span className="disp h2" style={{ margin: 0 }}>{count((x) => x.choice === "not_now")}</span></div>
        <div className="card" style={stat}><span className="xs muted">Haven&apos;t answered yet</span><span className="disp h2" style={{ margin: 0 }}>{count((x) => !x.choice)}</span></div>
      </div>
      <form className="card" method="get" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, alignItems: "end" }}>
        <div className="field"><label htmlFor="ii-c">Preference</label><select id="ii-c" name="choice" defaultValue={choice}><option value="">Everyone</option>{Object.entries(INSURANCE_CHOICES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}<option value="none">Haven&apos;t answered yet</option></select></div>
        <div className="field"><label htmlFor="ii-i">Coverage model</label><select id="ii-i" name="interest" defaultValue={interest}><option value="">Any</option>{Object.entries(INSURANCE_INTERESTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <button className="btn sm" type="submit">Apply</button>
      </form>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Professional</th><th>Insurance preference</th><th>Interested coverage model</th><th>Registered</th><th>Answered</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="small muted">No professionals match.</td></tr>}
            {rows.map((x) => (
              <tr key={x.user_id}>
                <td><Link className="link" href={`/admin/professionals/${x.user_id}`}>{personName(x.display_name, x.first_name, x.last_name)}</Link>{x.business_name ? <div className="xs muted">{x.business_name}</div> : null}</td>
                <td>{x.choice ? INSURANCE_CHOICES[x.choice as keyof typeof INSURANCE_CHOICES] ?? x.choice : <span className="muted">Not answered yet</span>}</td>
                <td>{x.interest ? INSURANCE_INTERESTS[x.interest as keyof typeof INSURANCE_INTERESTS] ?? x.interest : "—"}</td>
                <td>{d(x.registered ?? x.signed_up)}</td>
                <td>{d(x.answered)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
