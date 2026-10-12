import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { CAMPAIGN_KEY, CLOCK_LABEL, PLATFORM_LABEL, STATUS_LABEL, bookingOpensLabel, campaignCounts, fmtWhen, getCampaign, readinessProblems } from "@/lib/campaign";
import { setCampaignStatus, removeFromWaitlist } from "@/app/admin/campaign-actions";

export const metadata = { title: "Launch campaign" };
export const dynamic = "force-dynamic";

type Row = {
  id: string; status: string; first: string | null; last: string | null; platform: string | null; profile_url: string | null;
  started_at: Date | null; completes_at: Date | null; final_proof_at: Date | null; city: string | null; county: string | null;
  evidence: number; checks: number; flags: string | null; pending_link: string | null; eff: string;
};
const sel = { height: 38, borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 8px" } as const;

/** Launch campaign: status controls, readiness, counts, participants (filter by city, county, platform, status), waitlist. */
export default async function CampaignAdmin({ searchParams }: { searchParams: Promise<{ status?: string; platform?: string; city?: string; county?: string }> }) {
  const { role } = await requireAdmin();
  const c = await getCampaign();
  const sp = await searchParams;
  const [counts, problems] = await Promise.all([campaignCounts(), readinessProblems(c)]);
  const pc = await db.execute<{ agreed: number; declined: number; waiting: number; offering: number }>(sql`select
    count(*) filter (where campaign_choice = 'agreed')::int as agreed, count(*) filter (where campaign_choice = 'declined')::int as declined,
    count(*) filter (where campaign_choice is null)::int as waiting,
    (select count(*)::int from campaign_offers o where o.campaign_key = ${CAMPAIGN_KEY} and o.active and o.slots_used < o.slots_total) as offering
    from professional_profiles where entry_paid_at is not null`);
  const proCount = pc.rows[0] ?? { agreed: 0, declined: 0, waiting: 0, offering: 0 };
  const effSql = sql`case when e.status = 'in_progress' and e.completes_at <= now() then 'ready_for_review' else e.status end`;
  const rows = (await db.execute<Row>(sql`
    select e.id, e.status, u.first_name as first, u.last_name as last, e.platform, e.profile_url, e.started_at, e.completes_at, e.final_proof_at,
      ci.name as city, co.name as county, e.flags, e.pending_profile_url as pending_link, ${effSql} as eff,
      (select count(*)::int from campaign_evidence x where x.entry_id = e.id) as evidence,
      (select count(*)::int from campaign_checks k where k.entry_id = e.id) as checks
    from campaign_entries e join users u on u.id = e.student_id
    left join cities ci on ci.id = e.city_id left join counties co on co.id = e.county_id
    where e.campaign_key = ${CAMPAIGN_KEY}
      ${sp.status ? sql`and ${effSql} = ${sp.status}` : sql``}
      ${sp.platform ? sql`and e.platform = ${sp.platform}` : sql``}
      ${sp.city ? sql`and ci.name = ${sp.city}` : sql``}
      ${sp.county ? sql`and co.name = ${sp.county}` : sql``}
    order by (${effSql} = 'ready_for_review') desc, e.pending_profile_url is not null desc, e.reserved_at asc
    limit 500`)).rows;
  const places = (await db.execute<{ city: string | null; county: string | null }>(sql`
    select distinct ci.name as city, co.name as county from campaign_entries e left join cities ci on ci.id = e.city_id left join counties co on co.id = e.county_id where e.campaign_key = ${CAMPAIGN_KEY}`)).rows;
  const cityList = [...new Set(places.map((p) => p.city).filter(Boolean))].sort() as string[];
  const countyList = [...new Set(places.map((p) => p.county).filter(Boolean))].sort() as string[];
  const waitlist = (await db.execute<{ id: string; first: string | null; last: string | null; joined_at: Date }>(sql`
    select w.id, u.first_name as first, u.last_name as last, w.joined_at from campaign_waitlist w join users u on u.id = w.student_id
    where w.campaign_key = ${CAMPAIGN_KEY} and w.status = 'waiting' order by w.joined_at asc limit 200`)).rows;
  const now = Date.now();

  return (
    <>
      <AdminHead eyebrow={`${CLOCK_LABEL}`} title="Launch campaign" />
      <div className={`card ${c.status === "open" ? "ok" : c.status === "draft" ? "warn" : ""}`} style={{ gap: 10 }}>
        <div className="row between" style={{ flexWrap: "wrap", gap: 8 }}>
          <span className="disp h1" style={{ letterSpacing: 1 }}>{c.status === "open" ? "LIVE" : c.status === "paused" ? "PAUSED" : c.status === "closed" ? "CLOSED" : "DRAFT"}</span>
          {role === "OWNER" && <Link className="btn ghost sm" href="/admin/campaign/settings">Settings</Link>}
        </div>
        <span className="small">{c.status === "open" ? "Students can see the campaign and join." : c.status === "paused" ? "New students can't join. Students already in keep going." : c.status === "closed" ? "Enrollment has stopped. Students already in can finish." : "Students can't see the campaign yet."}</span>
        <span className="xs muted">{c.occupied} of {c.capacity} places taken • {c.market} • Booking opens {c.bookingOpensAt ? fmtWhen(c.bookingOpensAt) : "—"}</span>
        {role === "OWNER" && (
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {c.status !== "open" && (problems.length > 0
              ? <button className="btn sm" type="button" disabled style={{ opacity: 0.45 }}>{c.status === "draft" ? "Go live" : "Reopen enrollment"}</button>
              : <ActionForm action={setCampaignStatus} submitLabel={c.status === "draft" ? "Go live" : "Reopen enrollment"} buttonClass="btn sm" className="row"><input type="hidden" name="to" value="open" /></ActionForm>)}
            {c.status === "open" && <ActionForm action={setCampaignStatus} submitLabel="Pause" buttonClass="btn ghost sm" className="row"><input type="hidden" name="to" value="paused" /></ActionForm>}
            {(c.status === "open" || c.status === "paused") && <ActionForm action={setCampaignStatus} submitLabel="Stop (close enrollment)" buttonClass="btn ghost sm" className="row"><input type="hidden" name="to" value="closed" /></ActionForm>}
          </div>
        )}
        {problems.length > 0 && c.status !== "open" && (
          <div className="col" style={{ gap: 2 }}>
            <span className="xs b">Finish these in Settings to go live:</span>
            {problems.map((p) => <span key={p} className="xs">• {p}</span>)}
          </div>
        )}
        <span className="xs muted">Approved participants see &ldquo;Qualified—booking opens {bookingOpensLabel(c)}.&rdquo; Nothing here watches social media — the clock measures elapsed time from the server-recorded start; approval is always manual.</span>
      </div>

      <Link className="card" href="/admin/campaign/settings#pros" style={{ textDecoration: "none", color: "inherit", gap: 2 }}>
        <span className="small b">Participating professionals: {proCount.offering} offering a free service</span>
        <span className="xs muted">{proCount.agreed} agreed • {proCount.declined} declined • {proCount.waiting} haven&apos;t answered the home-screen card yet — see who and which service</span>
      </Link>

      <div className="kpis k4">
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Reserved (not started)</span><span className="stat">{counts.reserved}</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Active (clock running)</span><span className="stat">{counts.active}</span><span className="xs muted">{counts.needs_correction} needs correction</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Ready for final review</span><span className="stat">{counts.ready}</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Approved • Redeemed</span><span className="stat">{counts.approved} • {counts.redeemed}</span><span className="xs muted">{counts.cancelled} cancelled • {counts.rejected} not approved • {counts.waitlist} waitlisted</span></div>
      </div>
      {counts.occupied_actual !== c.occupied && <div className="card warn xs"><span>Place counter ({c.occupied}) differs from occupied entries ({counts.occupied_actual}) — released places or a manual change may explain it.</span></div>}

      <form className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select name="status" defaultValue={sp.status ?? ""} style={sel} aria-label="Status"><option value="">All statuses</option>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select name="platform" defaultValue={sp.platform ?? ""} style={sel} aria-label="Platform"><option value="">All platforms</option>{Object.entries(PLATFORM_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select name="city" defaultValue={sp.city ?? ""} style={sel} aria-label="City"><option value="">All cities</option>{cityList.map((x) => <option key={x}>{x}</option>)}</select>
        <select name="county" defaultValue={sp.county ?? ""} style={sel} aria-label="County"><option value="">All counties</option>{countyList.map((x) => <option key={x}>{x}</option>)}</select>
        <button className="btn sm" type="submit">Filter</button>
        <Link className="link xs" href="/admin/campaign">Clear</Link>
      </form>

      <div className="card" style={{ gap: 8 }}>
        <span className="eyebrow">Participants ({rows.length})</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Student</th><th>Status</th><th>Clock</th><th>Platform</th><th>City / county</th><th className="num">Screenshots</th><th className="num">Checks</th><th>Flags</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td className="empty" colSpan={8}>No participants match.</td></tr>}
              {rows.map((r) => {
                const done = r.completes_at && new Date(r.completes_at).getTime() <= now;
                return (
                  <tr key={r.id}>
                    <td><Link className="b link" href={`/admin/campaign/${r.id}`}>{[r.first, r.last].filter(Boolean).join(" ") || "Student"}</Link></td>
                    <td><span className={`tag ${r.eff === "ready_for_review" ? "warn" : r.eff === "approved" || r.eff === "redeemed" ? "ok" : r.eff === "cancelled" || r.eff === "rejected" ? "bad" : ""}`}>{STATUS_LABEL[r.eff] ?? r.eff}</span></td>
                    <td className="xs">{r.started_at ? (done ? `Complete ${fmtWhen(new Date(r.completes_at!))}` : `Ends ${fmtWhen(new Date(r.completes_at!))}`) : "Not started"}{done && !r.final_proof_at ? <div style={{ color: "#F2A38F" }}>Final proof missing</div> : null}</td>
                    <td>{PLATFORM_LABEL[r.platform ?? ""] ?? "—"}</td>
                    <td className="xs">{[r.city, r.county].filter(Boolean).join(" • ") || "—"}</td>
                    <td className="num">{r.evidence}</td><td className="num">{r.checks}</td>
                    <td className="xs">{[r.flags ? "Possible duplicate" : null, r.pending_link ? "Link change" : null].filter(Boolean).join(", ") || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ gap: 8 }}>
        <span className="eyebrow">Waitlist ({waitlist.length})</span>
        <span className="xs muted">When a place is released or capacity goes up, the next eligible student is enrolled automatically and notified — nobody is notified until a place is actually reserved for them.</span>
        {waitlist.map((w, i) => (
          <div key={w.id} className="row small" style={{ gap: 8 }}>
            <span className="grow">{i + 1}. {[w.first, w.last].filter(Boolean).join(" ") || "Student"} — joined {fmtWhen(new Date(w.joined_at))}</span>
            <form action={removeFromWaitlist}><input type="hidden" name="id" value={w.id} /><button className="link xs" type="submit">Remove</button></form>
          </div>
        ))}
      </div>
    </>
  );
}
