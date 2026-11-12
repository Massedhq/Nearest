import { asc, eq, sql } from "drizzle-orm";
import { db, users, adminMembers, cardPlaces, cities, categories } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin, isMainOwner } from "@/lib/admin";
import { voucherReport } from "@/lib/voucher-report";
import { groupNumber, validThruLabel } from "@/lib/nearest-cards";
import { saveVoucherCampaign, setVoucherCampaignStatus, logVoucherDistribution, removeVoucherDistribution } from "@/app/admin/voucher-actions";
import { fmtDate, money } from "@/lib/time";

export const metadata = { title: "GRANTED vouchers" };
export const dynamic = "force-dynamic";

const field = { borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px", height: 40 } as const;
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

/**
 * Nearest GRANTED Certificate Vouchers (2026-11-11): campaigns (6 = 3 distributors × discount/free, shared number + code),
 * distribution log by organization, and the "YOUR CITY. YOUR CHOICE." student demand dashboard. Owners only. Setting up
 * campaigns is the main owner's; each owner logs the vouchers they handed out.
 */
export default async function Vouchers({ searchParams }: { searchParams: Promise<{ city?: string; cat?: string; dist?: string; kind?: string; org?: string; edit?: string }> }) {
  const { user, role } = await requireAdmin();
  if (role !== "OWNER") { const { notFound } = await import("next/navigation"); notFound(); }
  const main = await isMainOwner(user.id);
  const sp = await searchParams;
  const f = { cityId: Number(sp.city) || null, category: sp.cat || null, distributorId: sp.dist || null, kind: sp.kind || null, placeId: sp.org || null };
  const [r, owners, places, catList] = await Promise.all([
    voucherReport(f),
    db.select({ id: users.id, first: users.firstName, last: users.lastName, email: users.email }).from(adminMembers).innerJoin(users, eq(users.id, adminMembers.userId)).where(eq(adminMembers.role, "OWNER")).orderBy(asc(users.firstName)),
    db.select({ id: cardPlaces.id, name: cardPlaces.name, city: cities.name }).from(cardPlaces).leftJoin(cities, eq(cities.id, cardPlaces.cityId)).orderBy(asc(cardPlaces.name)),
    db.select({ name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort)),
  ]);
  const ownerName = (o: { first: string | null; last: string | null; email: string | null }) => [o.first, o.last].filter(Boolean).join(" ") || o.email || "Owner";
  const editing = main && sp.edit ? r.campaigns.find((c) => c.id === sp.edit) ?? null : null;
  const mine = r.campaigns.filter((c) => main || c.distributorId === user.id);
  const dists = await db.execute(sql`select d.id, d.quantity, d.distributed_at as "at", d.notes, d.created_by as "by", p.name as place, b.name as campaign
    from voucher_distributions d join nearest_card_batches b on b.id = d.batch_id left join card_places p on p.id = d.place_id
    ${main ? sql`` : sql`where b.distributor_id = ${user.id}`} order by d.distributed_at desc limit 100`);
  const byDist = new Map<string, { name: string; printed: number; distributed: number; activations: number }>();
  for (const c of r.campaigns) {
    const k = c.distributorId ?? "none";
    const t = byDist.get(k) ?? { name: c.distributor ?? "—", printed: 0, distributed: 0, activations: 0 };
    t.printed += c.printed; t.distributed += c.distributed; t.activations += c.activations; byDist.set(k, t);
  }
  return (
    <>
      <AdminHead eyebrow="Business" title="GRANTED vouchers" />
      <span className="small muted">Nearest GRANTED Certificate Vouchers. Students scan the QR (usenearest.com/card), vote for the services they want in their city, then activate the voucher on their new account. Each campaign has ONE shared number + code (discount = 3 digits, free service = 4 digits); every student gets their own activation, one discount + one free-service voucher each, up to {r.totals.max.toLocaleString()} students in all.</span>

      <form method="get" className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select name="city" defaultValue={sp.city ?? ""} style={field} aria-label="City"><option value="">All cities</option>{r.byCity.map((c) => <option key={c.cityId} value={c.cityId}>{c.city}, {c.state}</option>)}</select>
        <select name="cat" defaultValue={sp.cat ?? ""} style={field} aria-label="Service"><option value="">All services</option>{catList.map((c) => <option key={c.name}>{c.name}</option>)}</select>
        <select name="dist" defaultValue={sp.dist ?? ""} style={field} aria-label="Distributor"><option value="">All distributors</option>{owners.map((o) => <option key={o.id} value={o.id}>{ownerName(o)}</option>)}</select>
        <select name="kind" defaultValue={sp.kind ?? ""} style={field} aria-label="Voucher type"><option value="">Both types</option><option value="discount">Discount</option><option value="free">Free service</option></select>
        <select name="org" defaultValue={sp.org ?? ""} style={field} aria-label="Organization"><option value="">All organizations</option>{places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <button className="btn sm" type="submit" style={{ width: "auto" }}>Filter</button>
      </form>
      <span className="xs muted">City and service filter the votes. Distributor, type and organization filter the vouchers.</span>

      <div className="kpis k4">
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Vouchers printed</span><span className="stat">{r.totals.printed.toLocaleString()}</span><span className="xs muted">{r.totals.distributed.toLocaleString()} handed out</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Votes</span><span className="stat">{r.funnel.votes.toLocaleString()}</span><span className="xs muted">{r.funnel.registered} registered • {r.funnel.verified} verified students</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Voucher activations</span><span className="stat">{r.totals.activations.toLocaleString()}</span><span className="xs muted">{r.totals.discount} discount • {r.totals.free} free service • {r.totals.used} used on a booking</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Students left of {r.totals.max.toLocaleString()}</span><span className="stat">{r.totals.left.toLocaleString()}</span><span className="xs muted">{r.totals.students} different students activated</span></div>
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
        <span className="eyebrow">Distributors</span>
        <table className="tbl"><thead><tr><th>Distributor</th><th className="num">Printed</th><th className="num">Handed out</th><th className="num">Activations</th><th className="num">Activation rate</th></tr></thead>
          <tbody>{[...byDist.values()].map((d) => <tr key={d.name}><td className="b">{d.name}</td><td className="num">{d.printed}</td><td className="num">{d.distributed}</td><td className="num">{d.activations}</td><td className="num">{pct(d.activations, d.distributed)}</td></tr>)}</tbody>
        </table>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Campaigns</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl"><thead><tr><th>Campaign</th><th>Number • code</th><th>Value</th><th>Valid thru</th><th className="num">Printed</th><th className="num">Handed out</th><th className="num">Activated</th><th className="num">Rate</th><th /></tr></thead>
            <tbody>{r.campaigns.length === 0 ? <tr><td className="empty" colSpan={9}>No campaigns yet.{main ? " Set up the six below (3 distributors × discount / free service)." : ""}</td></tr> : r.campaigns.map((c) => (
              <tr key={c.id}><td className="b">{c.name}<div className="xs muted">{c.status === "active" ? "On" : "Off — no new activations"}</div></td>
                <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{groupNumber(c.number)} • <b>{c.code}</b></td>
                <td>{c.kind === "free" ? "Free service" : `${money(c.amountCents)} off`}</td>
                <td>{validThruLabel(new Date(c.validThru))}</td>
                <td className="num">{c.printed}</td><td className="num">{c.distributed}</td><td className="num">{c.activations}</td><td className="num">{pct(c.activations, c.distributed)}</td>
                <td>{main && <div className="row" style={{ gap: 8 }}><a className="link xs" href={`?edit=${c.id}#campaign-form`}>Edit</a><form action={setVoucherCampaignStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="to" value={c.status === "active" ? "off" : "on"} /><button className="link xs" type="submit">{c.status === "active" ? "Turn off" : "Turn on"}</button></form></div>}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <span className="xs muted">Organization-level activations can&apos;t be known from a shared number — the Organizations table shows what was handed out where.</span>
      </div>

      {main && (
        <div className="card" style={{ gap: 10 }} id="campaign-form">
          <span className="eyebrow">{editing ? `Change ${editing.name}` : "Set up a campaign"}</span>
          <ActionForm action={saveVoucherCampaign} submitLabel={editing ? "Save changes" : "Set up campaign"} buttonClass="btn sm" className="col g8">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid2" style={{ gap: 8 }}>
              <select name="distributorId" required defaultValue={editing?.distributorId ?? ""} style={field} aria-label="Distributor"><option value="" disabled>Distributor…</option>{owners.map((o) => <option key={o.id} value={o.id}>{ownerName(o)}</option>)}</select>
              <select name="kind" defaultValue={editing?.kind ?? "discount"} style={field} aria-label="Type"><option value="discount">Discount (3-digit code)</option><option value="free">Free service (4-digit code)</option></select>
              <input name="number" required inputMode="numeric" defaultValue={editing ? groupNumber(editing.number) : ""} placeholder="16-digit number printed on the voucher" style={field} aria-label="Voucher number" />
              <input name="code" required inputMode="numeric" defaultValue={editing?.code ?? ""} placeholder="Security code" style={field} aria-label="Security code" />
              <input name="amount" required inputMode="decimal" defaultValue={editing ? (editing.amountCents / 100).toFixed(2) : ""} placeholder="Value — $ off, or free service up to $" style={field} aria-label="Value in dollars" />
              <input name="validThru" required type="month" defaultValue={editing ? new Date(editing.validThru).toISOString().slice(0, 7) : "2030-05"} style={field} aria-label="Valid thru" />
              <input name="printed" inputMode="numeric" defaultValue={editing?.printed ?? ""} placeholder="How many were printed" style={field} aria-label="Printed" />
            </div>
            <span className="xs muted">Use the exact number and code printed on that distributor&apos;s vouchers. Once students have activated a campaign, its number and type can&apos;t change.</span>
          </ActionForm>
        </div>
      )}

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Log vouchers you handed out</span>
        {mine.length === 0 ? <span className="small muted">{main ? "Set up a campaign first." : "No campaign is set up for you yet — ask the main owner."}</span> : (
          <ActionForm action={logVoucherDistribution} submitLabel="Log handout" buttonClass="btn sm" className="col g8">
            <div className="grid2" style={{ gap: 8 }}>
              <select name="batchId" required defaultValue="" style={field} aria-label="Campaign"><option value="" disabled>Which vouchers…</option>{mine.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <select name="placeId" required defaultValue="" style={field} aria-label="Organization"><option value="" disabled>Organization…</option>{places.map((p) => <option key={p.id} value={p.id}>{p.name}{p.city ? ` — ${p.city}` : ""}</option>)}</select>
              <input name="quantity" required inputMode="numeric" placeholder="How many" style={field} aria-label="Quantity" />
              <input name="date" required type="date" style={field} aria-label="Date" />
            </div>
            <input name="notes" maxLength={300} placeholder="Notes (optional)" style={field} aria-label="Notes" />
            <span className="xs muted">New organization? Add it in Card places first (address required).</span>
          </ActionForm>
        )}
        <div style={{ overflowX: "auto" }}>
          <table className="tbl"><thead><tr><th>Date</th><th>Campaign</th><th>Organization</th><th className="num">Quantity</th><th /></tr></thead>
            <tbody>{(dists.rows as { id: string; quantity: number; at: Date; notes: string | null; by: string; place: string | null; campaign: string }[]).map((d) => (
              <tr key={d.id}><td>{fmtDate(new Date(d.at))}</td><td>{d.campaign}{d.notes && <div className="xs muted">{d.notes}</div>}</td><td>{d.place ?? "—"}</td><td className="num">{d.quantity}</td>
                <td>{(main || d.by === user.id) && <form action={removeVoucherDistribution}><input type="hidden" name="id" value={d.id} /><button className="link xs" type="submit">Remove</button></form>}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Organizations</span>
        <table className="tbl"><thead><tr><th>Organization</th><th>City</th><th className="num">Vouchers handed out</th><th>Last handout</th></tr></thead>
          <tbody>{r.orgs.length === 0 ? <tr><td className="empty" colSpan={4}>Nothing logged yet.</td></tr> : r.orgs.map((o) => <tr key={o.id}><td className="b">{o.name}</td><td>{o.city ?? "—"}</td><td className="num">{o.distributed}</td><td>{o.last ? fmtDate(new Date(o.last)) : "—"}</td></tr>)}</tbody>
        </table>
      </div>
      <a className="link xs" href="/admin/vouchers">Clear filters</a>
    </>
  );
}
