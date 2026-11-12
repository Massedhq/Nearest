import { asc, eq, sql } from "drizzle-orm";
import { db, cities } from "@/db";
import { ActionForm } from "@/components/ActionForm";
import { groupNumber, validThruLabel } from "@/lib/nearest-cards";
import { distributorCampaigns, distributorVotes, orgPerformance, assignments, assignmentHistory, ORG_KINDS, DIST_STATUS, pct } from "@/lib/distribution";
import { addOrganization, assignVouchers, updateAssignment, cancelAssignment } from "@/app/admin/distribution-actions";
import { fmtDate, money } from "@/lib/time";

const field = { borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px", height: 40 } as const;
const kindName = (k: string) => (k === "free" ? "Free service" : "Discount");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const day = (d: Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

/**
 * My Voucher Distribution — ONE distributor's assignment, progress, organization assignments and history.
 * Everything below is queried for `userId` only (server side). Used by /admin/my-vouchers (yourself) and by the main
 * owner's /admin/vouchers/d/[id]. Counts only — never a student's name or details.
 */
export async function VoucherDistributionView({ userId, own }: { userId: string; own: boolean }) {
  const [camps, votes, orgs, rows, history, places, txCities] = await Promise.all([
    distributorCampaigns(userId), distributorVotes(userId), orgPerformance(userId), assignments(userId), assignmentHistory(userId),
    db.execute(sql`select p.id, p.name, p.street, ci.name as city, coalesce(p.state, ci.state) as state from card_places p left join cities ci on ci.id = p.city_id
      where p.active order by p.name, ci.name`),
    db.select({ name: cities.name }).from(cities).where(eq(cities.state, "TX")).orderBy(asc(cities.name)),
  ]);
  const placeList = places.rows as { id: string; name: string; street: string | null; city: string | null; state: string | null }[];
  const disc = camps.find((c) => c.kind === "discount"), free = camps.find((c) => c.kind === "free");
  const total = (k: "count" | "assigned" | "delivered" | "activated", kind?: string) => camps.filter((c) => !kind || c.kind === kind).reduce((n, c) => n + Number(c[k]), 0);
  const delivered = total("delivered"), activated = total("activated");
  const you = own ? "you" : "they";

  if (camps.length === 0) return <div className="card"><span className="small muted">No vouchers are assigned to {own ? "you" : "this distributor"} yet.{own ? " They'll show here as soon as the main owner publishes them." : ""}</span></div>;

  return (
    <>
      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">{own ? "My Assignment" : "Assignment"}</span>
        <div className="row" style={{ gap: 18, flexWrap: "wrap" }}>
          <span className="col" style={{ gap: 0 }}><span className="xs muted">16-digit activation number</span><span className="b" style={{ fontVariantNumeric: "tabular-nums", fontSize: 18 }}>{groupNumber(camps[0].number)}</span></span>
          {disc && <span className="col" style={{ gap: 0 }}><span className="xs muted">Discount security code</span><span className="b" style={{ fontSize: 18 }}>{disc.code}</span></span>}
          {free && <span className="col" style={{ gap: 0 }}><span className="xs muted">Free-service security code</span><span className="b" style={{ fontSize: 18 }}>{free.code}</span></span>}
        </div>
        <table className="tbl"><thead><tr><th>Vouchers</th><th className="num">Quantity</th><th>Value</th><th>Valid thru</th><th>Status</th></tr></thead>
          <tbody>
            {camps.map((c) => <tr key={c.id}><td className="b">{kindName(c.kind)}</td><td className="num">{c.count.toLocaleString()}</td><td>{c.kind === "free" ? "One eligible free service" : `${money(c.amountCents)} off`}</td><td>{validThruLabel(new Date(c.validThru))}</td><td>{c.status === "active" ? "On" : "Off"}</td></tr>)}
            <tr><td className="b">Total</td><td className="num b">{total("count").toLocaleString()}</td><td colSpan={3} /></tr>
          </tbody>
        </table>
        <span className="xs muted">Every voucher {you} hand out carries this number. The code tells Nearest whether it&apos;s a discount or free-service voucher. Only the main owner can change numbers, codes or quantities.</span>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">{own ? "My Progress" : "Progress"}</span>
        <table className="tbl"><thead><tr><th /><th className="num">Discount</th><th className="num">Free service</th><th className="num">Total</th></tr></thead>
          <tbody>
            {([["Allocated", "count"], ["Assigned to organizations", "assigned"], ["Delivered (handed over)", "delivered"]] as const).map(([l, k]) => (
              <tr key={k}><td>{l}</td><td className="num">{total(k, "discount")}</td><td className="num">{total(k, "free")}</td><td className="num b">{total(k)}</td></tr>
            ))}
            <tr><td>Not yet assigned</td><td className="num">{total("count", "discount") - total("assigned", "discount")}</td><td className="num">{total("count", "free") - total("assigned", "free")}</td><td className="num b">{total("count") - total("assigned")}</td></tr>
            <tr><td>Left to distribute</td><td className="num">{total("count", "discount") - total("delivered", "discount")}</td><td className="num">{total("count", "free") - total("delivered", "free")}</td><td className="num b">{total("count") - delivered}</td></tr>
            <tr><td>Activated by students</td><td className="num">{total("activated", "discount")}</td><td className="num">{total("activated", "free")}</td><td className="num b">{activated}</td></tr>
          </tbody>
        </table>
        <div className="row" style={{ gap: 18, flexWrap: "wrap" }}>
          <span className="col" style={{ gap: 0 }}><span className="stat" style={{ fontSize: 22 }}>{votes.votes}</span><span className="xs muted">Student votes</span></span>
          <span className="col" style={{ gap: 0 }}><span className="stat" style={{ fontSize: 22 }}>{votes.registered}</span><span className="xs muted">Student registrations</span></span>
          <span className="col" style={{ gap: 0 }}><span className="stat" style={{ fontSize: 22 }}>{pct(activated, delivered)}</span><span className="xs muted">Activation rate (activated ÷ delivered)</span></span>
        </div>
        <span className="xs muted">Delivered = vouchers physically handed over. Activated = students who added the voucher to their account. Assigning vouchers doesn&apos;t mean they were delivered, and delivering them doesn&apos;t mean students activated them.</span>
      </div>

      <div className="card" style={{ gap: 10 }} id="assign">
        <span className="eyebrow">Assign vouchers to an organization</span>
        <ActionForm action={assignVouchers} submitLabel="Save assignment" buttonClass="btn sm" className="col g8">
          <div className="grid2" style={{ gap: 8 }}>
            <select name="placeId" required defaultValue="" style={field} aria-label="Organization">
              <option value="" disabled>Organization…</option>
              {placeList.map((p) => <option key={p.id} value={p.id}>{p.name}{p.street ? ` — ${p.street}` : ""}{p.city ? `, ${p.city}` : ""}{p.state ? `, ${p.state}` : ""}</option>)}
            </select>
            <select name="batchId" required defaultValue="" style={field} aria-label="Voucher type">
              <option value="" disabled>Voucher type…</option>
              {camps.map((c) => <option key={c.id} value={c.id}>{kindName(c.kind)} ({c.count - c.assigned} left to assign)</option>)}
            </select>
            <input name="quantity" required inputMode="numeric" placeholder="Quantity" style={field} aria-label="Quantity" />
            <select name="status" defaultValue="assigned" style={field} aria-label="Status">{["planned", "assigned", "delivered", "completed"].map((k) => <option key={k} value={k}>{DIST_STATUS[k]}</option>)}</select>
            <input name="date" required type="date" defaultValue={today()} style={field} aria-label="Distribution date" />
            <input name="delivered" inputMode="numeric" placeholder="Delivered so far (optional)" style={field} aria-label="Delivered" />
          </div>
          <input name="notes" maxLength={300} placeholder="Notes (optional)" style={field} aria-label="Notes" />
          <span className="xs muted">Assigned, Delivered and Completed locations show up for students on the voucher vote (usenearest.com/card) so they can say where they got it. Planned ones don&apos;t yet. Going back to the same place later? Add a new assignment — each delivery is kept.</span>
        </ActionForm>
        <details>
          <summary className="link small">Organization not in the list? Add it</summary>
          <ActionForm action={addOrganization} submitLabel="Add organization" buttonClass="btn sm" className="col g8">
            <div className="grid2" style={{ gap: 8, marginTop: 8 }}>
              <input name="name" required maxLength={120} placeholder="Organization name" style={field} aria-label="Organization name" />
              <select name="kind" defaultValue="school" style={field} aria-label="Organization type">{Object.entries(ORG_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <input name="street" required maxLength={160} placeholder="Street address" style={field} aria-label="Street address" />
              <input name="city" required list="dist-cities" autoComplete="off" placeholder="City" style={field} aria-label="City" />
              <input name="state" required maxLength={2} defaultValue="TX" placeholder="State" style={field} aria-label="State" />
              <input name="zip" required inputMode="numeric" maxLength={10} placeholder="ZIP code" style={field} aria-label="ZIP code" />
              <input name="contactName" maxLength={100} placeholder="Contact name (optional)" style={field} aria-label="Contact name" />
              <input name="contact" maxLength={120} placeholder="Contact phone or email (optional)" style={field} aria-label="Contact phone or email" />
            </div>
            <datalist id="dist-cities">{txCities.map((c) => <option key={c.name} value={c.name} />)}</datalist>
            <span className="xs muted">Each location is listed once. A different branch (another address) is its own location.</span>
          </ActionForm>
        </details>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">{own ? "My Organizations" : "Organizations"}</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl"><thead><tr><th>Organization</th><th className="num">Discount assigned</th><th className="num">Free assigned</th><th className="num">Delivered</th><th className="num">Votes</th><th className="num">Registrations</th><th className="num">Discount act.</th><th className="num">Free act.</th><th className="num">Total act.</th><th className="num">Rate</th><th>Last date</th></tr></thead>
            <tbody>{orgs.length === 0 ? <tr><td className="empty" colSpan={11}>No organizations yet.</td></tr> : [...orgs].sort((a, b) => (b.actDiscount + b.actFree) / Math.max(1, b.deliveredDiscount + b.deliveredFree) - (a.actDiscount + a.actFree) / Math.max(1, a.deliveredDiscount + a.deliveredFree)).map((o) => {
              const del = o.deliveredDiscount + o.deliveredFree, act = o.actDiscount + o.actFree;
              const over = o.actDiscount > o.deliveredDiscount || o.actFree > o.deliveredFree;
              return (
                <tr key={o.placeId}><td><span className="b">{o.name}</span><div className="xs muted">{[o.street, o.city, o.state].filter(Boolean).join(", ")}</div>{over && <span className="tag warn">More activations than delivered — check</span>}</td>
                  <td className="num">{o.assignedDiscount}</td><td className="num">{o.assignedFree}</td><td className="num">{del}{o.deliveries > 1 ? <div className="xs muted">{o.deliveries} deliveries</div> : null}</td>
                  <td className="num">{o.votes}</td><td className="num">{o.registered}</td><td className="num">{o.actDiscount}</td><td className="num">{o.actFree}</td><td className="num b">{act}</td><td className="num">{pct(act, del)}</td>
                  <td>{o.last ? fmtDate(new Date(o.last)) : "—"}</td></tr>
              );
            })}</tbody>
          </table>
        </div>
        <span className="xs muted">Highest activation rate first. Votes, registrations and activations here are student-reported — the student picked this location on the vote. They aren&apos;t confirmed proof of where a voucher was handed out.</span>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">{own ? "My Distribution Activity" : "Distribution activity"}</span>
        <div className="col" style={{ gap: 8 }}>
          {rows.length === 0 ? <span className="small muted">Nothing assigned yet.</span> : rows.map((a) => (
            <details key={a.id} className="card" style={{ padding: 10, gap: 6 }}>
              <summary style={{ cursor: "pointer" }}>
                <span className="b">{a.place ?? "—"}</span>{a.city ? <span className="muted">, {a.city}</span> : null} · {kindName(a.kind)} · {a.quantity} assigned · {a.delivered} delivered · <span className={`tag${a.status === "cancelled" ? " warn" : a.status === "completed" || a.status === "delivered" ? " ok" : ""}`}>{DIST_STATUS[a.status] ?? a.status}</span> · {fmtDate(new Date(a.at))}
                {a.notes && <div className="xs muted">{a.notes}</div>}
              </summary>
              {a.status !== "cancelled" && (
                <>
                  <ActionForm action={updateAssignment} submitLabel="Save changes" buttonClass="btn sm" className="col g8">
                    <input type="hidden" name="id" value={a.id} />
                    <div className="grid2" style={{ gap: 8 }}>
                      <input name="quantity" required inputMode="numeric" defaultValue={a.quantity} style={field} aria-label="Quantity assigned" />
                      <input name="delivered" inputMode="numeric" defaultValue={a.delivered} style={field} aria-label="Delivered" />
                      <select name="status" defaultValue={a.status} style={field} aria-label="Status">{["planned", "assigned", "delivered", "completed"].map((k) => <option key={k} value={k}>{DIST_STATUS[k]}</option>)}</select>
                      <input name="date" required type="date" defaultValue={day(a.at)} style={field} aria-label="Date" />
                    </div>
                    <input name="notes" maxLength={300} defaultValue={a.notes ?? ""} placeholder="Notes" style={field} aria-label="Notes" />
                  </ActionForm>
                  {a.delivered === 0 && <form action={cancelAssignment}><input type="hidden" name="id" value={a.id} /><button className="link xs" type="submit">Cancel this assignment (vouchers go back to available)</button></form>}
                </>
              )}
            </details>
          ))}
        </div>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">History</span>
        <table className="tbl"><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead>
          <tbody>{history.length === 0 ? <tr><td className="empty" colSpan={3}>No changes yet.</td></tr> : history.map((h) => {
            const af = (h.after ?? {}) as Record<string, unknown>, bf = (h.before ?? {}) as Record<string, unknown>;
            const what = h.action === "created" ? `Assigned ${af.quantity} ${kindName(h.kind).toLowerCase()} to ${h.place} (${DIST_STATUS[String(af.status)] ?? af.status})`
              : h.action === "cancelled" ? `Canceled ${bf.quantity} ${kindName(h.kind).toLowerCase()} at ${h.place}`
              : `${h.place}: ${bf.quantity}→${af.quantity} assigned, ${bf.delivered ?? bf.quantity}→${af.delivered} delivered, ${DIST_STATUS[String(bf.status)] ?? bf.status}→${DIST_STATUS[String(af.status)] ?? af.status}`;
            return <tr key={h.id}><td className="xs">{fmtDate(new Date(h.at))}</td><td className="xs">{h.actor}</td><td className="xs">{what}</td></tr>;
          })}</tbody>
        </table>
      </div>
    </>
  );
}

