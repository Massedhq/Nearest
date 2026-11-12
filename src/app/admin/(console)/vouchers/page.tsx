import { asc, eq } from "drizzle-orm";
import { db, users, adminMembers, categories } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin, isMainOwner } from "@/lib/admin";
import { voucherReport } from "@/lib/voucher-report";
import { distributorsOverview, orgPerformance, unmatchedSources, typedSources, assignments, DIST_STATUS } from "@/lib/distribution";
import { groupNumber, validThruLabel } from "@/lib/nearest-cards";
import { saveVoucherCampaign, setVoucherCampaignStatus, publishVoucherCampaign } from "@/app/admin/voucher-actions";
import { fmtDate, money } from "@/lib/time";

export const metadata = { title: "Voucher Distribution Management" };
export const dynamic = "force-dynamic";

const field = { borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px", height: 40 } as const;
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

/**
 * Voucher Distribution Management (2026-11-12) — the MAIN OWNER's campaign-wide view of the Nearest GRANTED Certificate
 * Vouchers: every distributor (Avy, Kisses, Lakeesha), their campaigns (one 16-digit number each; 3-digit discount + 4-digit
 * free code; quantity = claim limit), organizations, unmatched student-reported sources, history, and the student demand
 * dashboard. Other owners are sent to their own My Voucher Distribution page. Counts only — no student details.
 */
export default async function Vouchers({ searchParams }: { searchParams: Promise<{ city?: string; cat?: string; dist?: string; kind?: string; edit?: string }> }) {
  const { user } = await requireAdmin();
  if (!(await isMainOwner(user.id))) { const { redirect } = await import("next/navigation"); redirect("/admin/my-vouchers"); }
  const main = true;
  const sp = await searchParams;
  const f = { cityId: Number(sp.city) || null, category: sp.cat || null, distributorId: sp.dist || null, kind: sp.kind || null, placeId: null };
  const [r, owners, catList, dists, orgs, unmatched, typed, recent] = await Promise.all([
    voucherReport(f),
    db.select({ id: users.id, first: users.firstName, last: users.lastName, email: users.email }).from(adminMembers).innerJoin(users, eq(users.id, adminMembers.userId)).where(eq(adminMembers.role, "OWNER")).orderBy(asc(users.firstName)),
    db.select({ name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort)),
    distributorsOverview(), orgPerformance(null), unmatchedSources(), typedSources(), assignments(null, 40),
  ]);
  const ownerName = (o: { first: string | null; last: string | null; email: string | null }) => [o.first, o.last].filter(Boolean).join(" ") || o.email || "Owner";
  const editing = main && sp.edit ? r.campaigns.find((c) => c.id === sp.edit) ?? null : null;
  return (
    <>
      <AdminHead eyebrow="Business" title="Voucher Distribution Management" />
      <span className="small muted">Nearest GRANTED Certificate Vouchers. Each distributor has ONE 16-digit number on all their vouchers, a 3-digit code for discount vouchers and a 4-digit code for free-service vouchers. A campaign&apos;s quantity is also the most students who can claim it. Distributors see only their own records in My Voucher Distribution. <a className="link" href="/admin/my-vouchers">Open my own distribution</a></span>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Distributors</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl"><thead><tr><th>Distributor</th><th className="num">Assigned</th><th className="num">Distributed</th><th className="num">Remaining</th><th className="num">Votes</th><th className="num">Registrations</th><th className="num">Activations</th><th className="num">Free</th><th className="num">Discount</th><th className="num">Orgs visited</th><th className="num">Current activities</th><th>Last update</th><th /></tr></thead>
            <tbody>{dists.length === 0 ? <tr><td className="empty" colSpan={13}>No campaigns yet — set them up below.</td></tr> : dists.map((d) => (
              <tr key={d.id}><td className="b">{d.name}{d.drafts > 0 && <div className="xs muted">{d.drafts} draft{d.drafts === 1 ? "" : "s"} not published</div>}</td>
                <td className="num">{d.allocated.toLocaleString()}</td><td className="num">{d.delivered.toLocaleString()}</td><td className="num">{d.remaining.toLocaleString()}</td>
                <td className="num">{d.votes}</td><td className="num">{d.registered}</td><td className="num b">{d.activated}</td><td className="num">{d.free}</td><td className="num">{d.discount}</td>
                <td className="num">{d.visited}</td><td className="num">{d.current}</td><td className="xs">{d.last ? fmtDate(new Date(d.last)) : "—"}</td>
                <td><a className="link xs" href={`/admin/vouchers/d/${d.id}`}>Open</a></td></tr>
            ))}</tbody>
          </table>
        </div>
        <span className="xs muted">Assigned = vouchers allocated to the distributor. Distributed = physically delivered to organizations. Remaining = not delivered yet. Current activities = Planned or Assigned, not delivered.</span>
      </div>

      <form method="get" className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select name="city" defaultValue={sp.city ?? ""} style={field} aria-label="City"><option value="">All cities</option>{r.byCity.map((c) => <option key={c.cityId} value={c.cityId}>{c.city}, {c.state}</option>)}</select>
        <select name="cat" defaultValue={sp.cat ?? ""} style={field} aria-label="Service"><option value="">All services</option>{catList.map((c) => <option key={c.name}>{c.name}</option>)}</select>
        <select name="dist" defaultValue={sp.dist ?? ""} style={field} aria-label="Distributor"><option value="">All distributors</option>{owners.map((o) => <option key={o.id} value={o.id}>{ownerName(o)}</option>)}</select>
        <select name="kind" defaultValue={sp.kind ?? ""} style={field} aria-label="Voucher type"><option value="">Both types</option><option value="discount">Discount</option><option value="free">Free service</option></select>
        <button className="btn sm" type="submit" style={{ width: "auto" }}>Filter</button>
      </form>
      <span className="xs muted">City and service filter the votes. Distributor and type filter the campaigns.</span>

      <div className="kpis k4">
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Vouchers in campaigns</span><span className="stat">{r.totals.printed.toLocaleString()}</span><span className="xs muted">{r.totals.distributed.toLocaleString()} delivered</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Votes</span><span className="stat">{r.funnel.votes.toLocaleString()}</span><span className="xs muted">{r.funnel.registered} registered • {r.funnel.verified} verified students</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Voucher activations</span><span className="stat">{r.totals.activations.toLocaleString()}</span><span className="xs muted">{r.totals.discount} discount • {r.totals.free} free service • {r.totals.used} used on a booking</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Claims left</span><span className="stat">{Math.max(0, r.totals.printed - r.totals.activations).toLocaleString()}</span><span className="xs muted">of {r.totals.printed.toLocaleString()} across every campaign</span></div>
      </div>

      <div className="card" style={{ gap: 8 }}>
        <span className="eyebrow">Student funnel</span>
        <div className="row" style={{ gap: 18, flexWrap: "wrap" }}>
          {[["Votes submitted", r.funnel.votes], ["Registered", r.funnel.registered], ["Email verified", r.funnel.emailVerified], ["School ID verified", r.funnel.verified], ["Activated a voucher", r.funnel.activated]].map(([l, n]) => (
            <span key={String(l)} className="col" style={{ gap: 0 }}><span className="stat" style={{ fontSize: 22 }}>{Number(n).toLocaleString()}</span><span className="xs muted">{l}</span></span>
          ))}
        </div>
        <span className="xs muted">Recruiting decisions should use verified students&apos; votes. Anonymous votes count as early interest only — each browser can vote once (voting again updates it), and a student keeps one vote.</span>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Most requested services</span>
        <table className="tbl"><thead><tr><th>Service</th><th className="num">Votes</th><th className="num">Verified students</th></tr></thead>
          <tbody>{r.categories.length === 0 ? <tr><td className="empty" colSpan={3}>No votes yet.</td></tr> : r.categories.map((c) => <tr key={c.category}><td>{c.category}</td><td className="num">{c.votes}</td><td className="num b">{c.verified}</td></tr>)}</tbody>
        </table>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Demand by city</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl"><thead><tr><th>City</th><th className="num">Votes</th><th className="num">Registered</th><th className="num">Verified</th><th className="num">Activated</th><th>Top requests (verified / all) — live pro?</th></tr></thead>
            <tbody>{r.byCity.length === 0 ? <tr><td className="empty" colSpan={6}>No votes yet.</td></tr> : r.byCity.map((c) => (
              <tr key={c.cityId}><td className="b">{c.city}, {c.state}</td><td className="num">{c.votes}</td><td className="num">{c.registered}</td><td className="num">{c.verified}</td><td className="num">{c.activated}</td>
                <td className="xs">{c.top.map((t) => <span key={t.category} style={{ marginRight: 10, whiteSpace: "nowrap" }}>{t.category} {t.verified}/{t.votes} {t.live ? <span className="tag ok">live</span> : <span className="tag warn">needed</span>}</span>)}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <span className="xs muted">&quot;Needed&quot; = students there want it and no live professional offers it in that city yet — recruit there first. City = where the student lives (from their vote).</span>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Campaigns</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl"><thead><tr><th>Campaign</th><th>Number • code</th><th>Value</th><th>Valid thru</th><th className="num">Quantity (limit)</th><th className="num">Assigned to orgs</th><th className="num">Delivered</th><th className="num">Claimed</th><th className="num">Left to claim</th><th className="num">Rate</th><th /></tr></thead>
            <tbody>{r.campaigns.length === 0 ? <tr><td className="empty" colSpan={11}>No campaigns yet. Set up six below: Avy, Kisses and Lakeesha × discount (900) and free service (100).</td></tr> : r.campaigns.map((c) => (
              <tr key={c.id}><td className="b">{c.name}<div className="xs muted">{c.draft ? "Draft — not published" : c.status === "active" ? "Published • On" : "Off — no new activations"}</div></td>
                <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{groupNumber(c.number)} • <b>{c.code}</b></td>
                <td>{c.kind === "free" ? "Free service" : `${money(c.amountCents)} off`}</td>
                <td>{validThruLabel(new Date(c.validThru))}</td>
                <td className="num">{c.printed}</td><td className="num">{c.assigned}</td><td className="num">{c.distributed}</td><td className="num b">{c.activations}</td><td className="num">{Math.max(0, c.printed - c.activations)}</td><td className="num">{pct(c.activations, c.distributed)}</td>
                <td>{main && <div className="row" style={{ gap: 8 }}>{c.draft && <form action={publishVoucherCampaign}><input type="hidden" name="id" value={c.id} /><button className="link xs b" type="submit">Publish</button></form>}<a className="link xs" href={`?edit=${c.id}#campaign-form`}>Edit</a><form action={setVoucherCampaignStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="to" value={c.status === "active" ? "off" : "on"} /><button className="link xs" type="submit">{c.status === "active" ? "Turn off" : "Turn on"}</button></form></div>}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <span className="xs muted">Turning a campaign off stops new claims; students who already claimed keep their voucher. Changing the distributor (reassigning) is logged.</span>
      </div>

      {main && (
        <div className="card" style={{ gap: 10 }} id="campaign-form">
          <span className="eyebrow">{editing ? `Change ${editing.name}` : "Set up a campaign (saved as a draft)"}</span>
          <ActionForm action={saveVoucherCampaign} submitLabel={editing ? "Save changes" : "Save draft"} buttonClass="btn sm" className="col g8">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid2" style={{ gap: 8 }}>
              <select name="distributorId" required defaultValue={editing?.distributorId ?? ""} style={field} aria-label="Distributor"><option value="" disabled>Distributor…</option>{owners.map((o) => <option key={o.id} value={o.id}>{ownerName(o)}</option>)}</select>
              <select name="kind" defaultValue={editing?.kind ?? "discount"} style={field} aria-label="Type"><option value="discount">Discount (3-digit code)</option><option value="free">Free service (4-digit code)</option></select>
              <input name="number" required inputMode="numeric" defaultValue={editing ? groupNumber(editing.number) : ""} placeholder="Distributor\u2019s 16-digit number" style={field} aria-label="Voucher number" />
              <input name="code" required inputMode="numeric" defaultValue={editing?.code ?? ""} placeholder="Code — 3 digits discount, 4 digits free" style={field} aria-label="Security code" />
              <input name="amount" required inputMode="decimal" defaultValue={editing ? (editing.amountCents / 100).toFixed(2) : ""} placeholder="Value — $ off (discount), or 5–150 (free)" style={field} aria-label="Value in dollars" />
              <input name="validThru" required type="month" defaultValue={editing ? new Date(editing.validThru).toISOString().slice(0, 7) : "2030-05"} style={field} aria-label="Valid thru" />
              <input name="printed" inputMode="numeric" defaultValue={editing?.printed ?? ""} required placeholder="Vouchers in this campaign (900 or 100) — also the claim limit" style={field} aria-label="Vouchers in this campaign" />
            </div>
            <span className="xs muted">Type the exact number and code printed on that distributor&apos;s vouchers — nothing is generated. A distributor&apos;s discount and free-service campaigns use the same 16-digit number; no other distributor can use it. Saved campaigns stay drafts until you Publish them. Once students claim a campaign, its number, code and type can&apos;t change.</span>
          </ActionForm>
        </div>
      )}

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Organizations — every distributor</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl"><thead><tr><th>Organization</th><th>Distributor</th><th>Contact</th><th className="num">Discount assigned</th><th className="num">Free assigned</th><th className="num">Delivered</th><th className="num">Votes</th><th className="num">Registrations</th><th className="num">Discount act.</th><th className="num">Free act.</th><th className="num">Rate</th><th>Last date</th></tr></thead>
            <tbody>{orgs.length === 0 ? <tr><td className="empty" colSpan={12}>No organizations assigned yet.</td></tr> : orgs.map((o) => {
              const del = o.deliveredDiscount + o.deliveredFree, act = o.actDiscount + o.actFree;
              return (
                <tr key={`${o.placeId}-${o.distributorId}`}><td><span className="b">{o.name}</span><div className="xs muted">{[o.street, o.city, [o.state, o.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</div>{(o.actDiscount > o.deliveredDiscount || o.actFree > o.deliveredFree) && <span className="tag warn">More activations than delivered</span>}</td>
                  <td>{o.distributor}</td><td className="xs">{[o.contactName, o.contact].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="num">{o.assignedDiscount}</td><td className="num">{o.assignedFree}</td><td className="num">{del}</td><td className="num">{o.votes}</td><td className="num">{o.registered}</td>
                  <td className="num">{o.actDiscount}</td><td className="num">{o.actFree}</td><td className="num">{pct(act, del)}</td><td>{o.last ? fmtDate(new Date(o.last)) : "—"}</td></tr>
              );
            })}</tbody>
          </table>
        </div>
        <span className="xs muted">Activations by organization are student-reported (the location the student picked on the vote), not confirmed proof of delivery.</span>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Unmatched student-reported sources</span>
        <table className="tbl"><thead><tr><th>Student said</th><th>How</th><th>Voucher of</th><th>Type</th><th className="num">Activations</th><th>Latest</th></tr></thead>
          <tbody>{unmatched.length === 0 ? <tr><td className="empty" colSpan={6}>Nothing to review.</td></tr> : unmatched.map((u, n) => (
            <tr key={n}><td className="b">{u.source}</td><td className="xs">{u.how}</td><td>{u.distributor}</td><td>{u.kind === "free" ? "Free service" : "Discount"}</td><td className="num">{u.n}</td><td className="xs">{fmtDate(new Date(u.last))}</td></tr>
          ))}</tbody>
        </table>
        <span className="xs muted">The student activated a distributor&apos;s voucher but the place they picked (or typed) has no assignment from that distributor. Kept as reported — never moved to another organization.</span>
        {typed.length > 0 && (
          <>
            <span className="small b">Names typed on the vote (Other / Someone gave it to me)</span>
            <table className="tbl"><thead><tr><th>Typed</th><th>Choice</th><th className="num">Votes</th><th>Latest</th></tr></thead>
              <tbody>{typed.map((t, n) => <tr key={n}><td>{t.text}</td><td className="xs">{t.kind === "someone" ? "Someone gave it to me" : "Other / Not listed"}</td><td className="num">{t.n}</td><td className="xs">{fmtDate(new Date(t.last))}</td></tr>)}</tbody>
            </table>
          </>
        )}
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Recent distribution activity</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl"><thead><tr><th>Date</th><th>Distributor</th><th>Organization</th><th>Type</th><th className="num">Assigned</th><th className="num">Delivered</th><th>Status</th></tr></thead>
            <tbody>{recent.length === 0 ? <tr><td className="empty" colSpan={7}>Nothing yet.</td></tr> : recent.map((a) => (
              <tr key={a.id}><td className="xs">{fmtDate(new Date(a.at))}</td><td>{a.distributor}</td><td>{a.place ?? "—"}{a.city ? <span className="xs muted">, {a.city}</span> : null}{a.notes && <div className="xs muted">{a.notes}</div>}</td><td>{a.kind === "free" ? "Free service" : "Discount"}</td><td className="num">{a.quantity}</td><td className="num">{a.delivered}</td><td>{DIST_STATUS[a.status] ?? a.status}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <span className="xs muted">Open a distributor above for their full assignment list and change history.</span>
      </div>
      <a className="link xs" href="/admin/vouchers">Clear filters</a>
    </>
  );
}
