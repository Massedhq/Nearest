import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { db, cardPlaces, nearestCardBatches, nearestCards, users, adminMembers, categories } from "@/db";
import { voucherReport } from "@/lib/voucher-report";
import { distributorsOverview, orgPerformance, unmatchedSources, typedSources, assignments, DIST_STATUS } from "@/lib/distribution";
import { saveVoucherCampaign, saveDistributorVouchers, setVoucherCampaignStatus, publishVoucherCampaign } from "@/app/admin/voucher-actions";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireMainOwner } from "@/lib/admin";
import { cardLabel, cardFund, digits, groupNumber, validThruLabel, activateBy, activateDays, CARD_LIMITS, ensurePrintSeq } from "@/lib/nearest-cards";
import { createCards, setCardBatchStatus, setCardStatus, setBatchHandout, discardCardBatch } from "@/app/admin/card-actions";
import { fmtDate, money } from "@/lib/time";

export const metadata = { title: "Nearest Cards" };
export const dynamic = "force-dynamic";

const field = { borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px", height: 40 } as const;
const STATUS: Record<string, string> = { issued: "Not added yet", activated: "On a student's account", off: "Turned off", locked: "Locked (too many wrong codes)", discarded: "Discarded" };
const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

const PER_PAGE = 100;

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

/**
 * Nearest Cards (main owner) — since 2026-11-12 this is where the Nearest GRANTED Certificate Vouchers are set up and
 * managed (they replace individually numbered cards as the handout). Top to bottom: set up a distributor's vouchers →
 * voucher batches → distributors → look up a card or voucher → cards on student accounts → organizations → reports with
 * filters → the older individually numbered cards (fund, make cards, batches, locked). Kisses and Lakeesha only ever
 * see their own vouchers on My Voucher Distribution.
 */
export default async function AdminCards({ searchParams }: { searchParams: Promise<{ q?: string; batch?: string; page?: string; city?: string; cat?: string; dist?: string; kind?: string; edit?: string }> }) {
  await requireMainOwner({ page: true });
  await ensurePrintSeq(); // also gives a new code to unsaved cards whose code started with 0
  const sp = await searchParams;
  const q = digits(sp.q ?? "").slice(0, 16);
  const openBatch = /^[0-9a-f-]{36}$/.test(sp.batch ?? "") ? sp.batch! : "";
  const page = Math.max(1, Math.floor(Number(sp.page) || 1));
  // Look up by any part of the card number (front), the exact code (back), or the card's # in its printer file.
  const lookup = q.length === 16 ? eq(nearestCards.number, q)
    : or(...(q.length >= 4 ? [like(nearestCards.number, `%${q}%`)] : []), ...(q.length >= 3 && q.length <= 4 ? [eq(nearestCards.code, q)] : []), ...(q.length <= 5 ? [eq(nearestCards.printSeq, Number(q))] : []));
  const days = await activateDays();
  const f = { cityId: Number(sp.city) || null, category: sp.cat || null, distributorId: sp.dist || null, kind: sp.kind || null, placeId: null };
  const [r, owners, catList, dists, orgs, unmatched, typed, recent, foundCampaigns] = await Promise.all([
    voucherReport(f),
    db.select({ id: users.id, first: users.firstName, last: users.lastName, email: users.email }).from(adminMembers).innerJoin(users, eq(users.id, adminMembers.userId)).where(eq(adminMembers.role, "OWNER")).orderBy(asc(users.firstName)),
    db.select({ name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort)),
    distributorsOverview(), orgPerformance(null), unmatchedSources(), typedSources(), assignments(null, 40),
    q.length >= 3 ? db.select().from(nearestCardBatches).where(or(...(q.length >= 4 ? [like(nearestCardBatches.sharedNumber, `%${q}%`)] : []), ...(q.length <= 4 ? [eq(nearestCardBatches.sharedCode, q)] : []))).limit(20) : Promise.resolve([]),
  ]);
  const ownerName = (o: { first: string | null; last: string | null; email: string | null }) => [o.first, o.last].filter(Boolean).join(" ") || o.email || "Owner";
  const nameOf = (id: string | null) => { const o = owners.find((x) => x.id === id); return o ? ownerName(o) : "—"; };
  const editing = sp.edit ? r.campaigns.find((c) => c.id === sp.edit) ?? null : null;
  const [fund, batches, totals, found, locked] = await Promise.all([
    cardFund(),
    db.select({
      b: nearestCardBatches,
      added: sql<number>`(select count(*)::int from nearest_cards c where c.batch_id = ${nearestCardBatches.id} and c.status = 'activated')`,
      used: sql<number>`(select count(*)::int from nearest_cards c where c.batch_id = ${nearestCardBatches.id} and c.credit_id is not null)`,
      notSaved: sql<number>`(select count(*)::int from nearest_cards c where c.batch_id = ${nearestCardBatches.id} and c.status = 'issued')`,
    }).from(nearestCardBatches).where(sql`${nearestCardBatches.sharedNumber} is null`).orderBy(desc(nearestCardBatches.createdAt)).limit(100), // GRANTED voucher campaigns live on /admin/vouchers
    db.select({
      made: sql<number>`count(*)::int`,
      added: sql<number>`count(*) filter (where ${nearestCards.status} = 'activated')::int`,
      used: sql<number>`count(*) filter (where ${nearestCards.creditId} is not null)::int`,
      value: sql<number>`(select coalesce(sum(bk.card_cents), 0)::int from bookings bk where bk.card_id is not null and bk.paid_at is not null)`,
    }).from(nearestCards).innerJoin(nearestCardBatches, eq(nearestCardBatches.id, nearestCards.batchId))
      // Discarded batches don't count (unless a card was already saved or used), and GRANTED voucher activations live on /admin/vouchers.
      .where(sql`not ${nearestCards.shared} and (${nearestCardBatches.status} <> 'discarded' or ${nearestCards.status} = 'activated' or ${nearestCards.creditId} is not null)`).then((r) => r[0]),
    q.length >= 1
      ? db.select({ c: nearestCards, b: nearestCardBatches, first: users.firstName, last: users.lastName, place: cardPlaces.name }).from(nearestCards)
          .innerJoin(nearestCardBatches, eq(nearestCardBatches.id, nearestCards.batchId)).leftJoin(users, eq(users.id, nearestCards.studentId))
          .leftJoin(cardPlaces, eq(cardPlaces.id, nearestCards.placeId))
          .where(lookup).orderBy(desc(nearestCardBatches.createdAt), asc(nearestCards.printSeq)).limit(50)
      : Promise.resolve([]),
    db.select({ c: nearestCards, b: nearestCardBatches, first: users.firstName, last: users.lastName, place: cardPlaces.name }).from(nearestCards)
      .innerJoin(nearestCardBatches, eq(nearestCardBatches.id, nearestCards.batchId)).leftJoin(users, eq(users.id, nearestCards.studentId))
      .leftJoin(cardPlaces, eq(cardPlaces.id, nearestCards.placeId))
      .where(eq(nearestCards.status, "locked")).limit(25),
  ]);
  // Saved on a student's account and not used yet (Active and assigned), and used on a paid booking (Used — no longer works).
  const withStudent = () => db.select({ c: nearestCards, b: nearestCardBatches, first: users.firstName, last: users.lastName, place: cardPlaces.name, paidAt: sql<Date | null>`(select bk.paid_at from bookings bk where bk.id = ${nearestCards.usedBookingId})` }).from(nearestCards)
    .innerJoin(nearestCardBatches, eq(nearestCardBatches.id, nearestCards.batchId)).leftJoin(users, eq(users.id, nearestCards.studentId))
    .leftJoin(cardPlaces, eq(cardPlaces.id, nearestCards.placeId));
  const [activeCards, usedCards] = await Promise.all([
    withStudent().where(and(eq(nearestCards.status, "activated"), sql`${nearestCards.creditId} is null`)).orderBy(desc(nearestCards.activatedAt)).limit(200),
    withStudent().where(sql`${nearestCards.creditId} is not null`).orderBy(desc(nearestCards.activatedAt)).limit(200),
  ]);
  // The cards of one batch, on screen (no spreadsheet needed): 100 per page, in printer-file order.
  const batchCards = openBatch
    ? await db.select({ c: nearestCards, b: nearestCardBatches, first: users.firstName, last: users.lastName, place: cardPlaces.name }).from(nearestCards)
        .innerJoin(nearestCardBatches, eq(nearestCardBatches.id, nearestCards.batchId)).leftJoin(users, eq(users.id, nearestCards.studentId))
        .leftJoin(cardPlaces, eq(cardPlaces.id, nearestCards.placeId))
        .where(and(eq(nearestCards.batchId, openBatch))).orderBy(asc(nearestCards.printSeq), asc(nearestCards.createdAt)).limit(PER_PAGE).offset((page - 1) * PER_PAGE)
    : [];
  const openInfo = batches.find((x) => x.b.id === openBatch)?.b;
  const pages = openInfo ? Math.max(1, Math.ceil(openInfo.count / PER_PAGE)) : 1;
  const batchLink = (id: string, p = 1) => `/admin/cards?batch=${id}${p > 1 ? `&page=${p}` : ""}#batch-cards`;
  const live = batches.filter((x) => x.b.status !== "discarded");
  const cardRow = ({ c, b, first, last, place }: (typeof locked)[number]) => (
    <tr key={c.id}>
      <td>{c.printSeq ?? "—"}</td>
      <td className="b" style={{ whiteSpace: "nowrap" }}>{groupNumber(c.number)}</td>
      <td className="b">{c.code}</td>
      <td>{cardLabel(b.kind, !!b.sharedNumber)} • {b.name}{place ? <div className="xs muted">At {place}</div> : null}</td>
      <td>{c.creditId ? <span className="tag">Used — no longer works</span> : c.status === "activated" ? <span className="tag ok">Active — on a student&apos;s account</span> : c.status === "issued" && activateBy(b, days) < new Date() ? `Inactive — not saved within ${days} days` : (STATUS[c.status] ?? c.status)}{c.failedAttempts > 0 && c.status !== "activated" ? ` • ${c.failedAttempts} wrong code${c.failedAttempts === 1 ? "" : "s"}` : ""}</td>
      <td>{c.studentId ? ([first, last].filter(Boolean).join(" ") || "Student") : "—"}{c.activatedAt ? <div className="xs muted">added {fmtDate(c.activatedAt)}</div> : null}</td>
      <td>{c.usedBookingId ? <span className="xs">{c.creditId ? "Paid booking" : "Chosen for a booking (not paid yet)"} {c.usedBookingId.slice(0, 8).toUpperCase()}</span> : "—"}</td>
      <td>
        {(c.status === "issued" || c.status === "locked" || (c.status === "activated" && !c.creditId && !c.usedBookingId)) && <form action={setCardStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="to" value="off" /><button className="btn ghost sm" type="submit">Turn off</button></form>}
        {(c.status === "off" || c.status === "locked") && <form action={setCardStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="to" value="on" /><button className="btn sm" type="submit">{c.status === "locked" ? "Unlock" : "Turn back on"}</button></form>}
      </td>
    </tr>
  );
  return (
    <>
      <AdminHead eyebrow="Business" title="Nearest Cards" />
      <span className="small muted">Nearest GRANTED Certificate Vouchers. Each distributor (Avy, Kisses, Lakeesha) has one 16-digit number on all their vouchers, a 3-digit code for discount vouchers and a 4-digit code for free-service vouchers. Kisses and Lakeesha see only their own in My Voucher Distribution. <a className="link" href="/admin/my-vouchers">Open my own distribution</a></span>
      <div className="card" style={{ gap: 10 }} id="voucher-setup">
        {editing ? (
          <>
            <span className="eyebrow">Change {editing.name}</span>
            <ActionForm action={saveVoucherCampaign} submitLabel="Save changes" buttonClass="btn sm" className="col g8">
              <input type="hidden" name="id" value={editing.id} />
              <input type="hidden" name="kind" value={editing.kind} />
              <div className="grid2" style={{ gap: 8 }}>
                <input name="name" maxLength={80} defaultValue={editing.name.replace(/ — (Free service|Discount)$/, "")} placeholder="Batch name" style={field} aria-label="Batch name" />
                <select name="distributorId" required defaultValue={editing.distributorId ?? ""} style={field} aria-label="Distributor"><option value="" disabled>Distributor…</option>{owners.map((o) => <option key={o.id} value={o.id}>{ownerName(o)}</option>)}</select>
                <input name="number" required inputMode="numeric" defaultValue={groupNumber(editing.number)} placeholder="16-digit number" style={field} aria-label="16-digit number" />
                <input name="code" required inputMode="numeric" defaultValue={editing.code} placeholder={editing.kind === "free" ? "4-digit code" : "3-digit code"} style={field} aria-label="Code" />
                {editing.kind === "discount" && <input name="amount" required inputMode="decimal" defaultValue={(editing.amountCents / 100).toFixed(2)} placeholder="$ off" style={field} aria-label="Dollars off" />}
                <input name="printed" required inputMode="numeric" defaultValue={editing.printed} placeholder="How many" style={field} aria-label="How many" />
                <input name="validThru" required type="month" defaultValue={new Date(editing.validThru).toISOString().slice(0, 7)} style={field} aria-label="Valid thru" />
              </div>
            </ActionForm>
            <a className="link xs" href="/admin/cards">Cancel</a>
          </>
        ) : (
          <>
            <span className="eyebrow">Set up a distributor&apos;s vouchers</span>
            <ActionForm action={saveDistributorVouchers} submitLabel="Save batch" buttonClass="btn sm" className="col g8">
              <div className="grid2" style={{ gap: 8 }}>
                <input name="name" maxLength={80} placeholder="Batch name (e.g. Fall 2026 — Kisses)" style={field} aria-label="Batch name" />
                <select name="distributorId" required defaultValue="" style={field} aria-label="Distributor"><option value="" disabled>Distributor…</option>{owners.map((o) => <option key={o.id} value={o.id}>{ownerName(o)}</option>)}</select>
                <input name="number" required inputMode="numeric" placeholder="16-digit number printed on their vouchers" style={field} aria-label="16-digit number" />
                <label className="xs muted col" style={{ gap: 2 }}>Valid thru<input name="validThru" required type="month" defaultValue="2030-05" style={field} aria-label="Valid thru" /></label>
              </div>
              <span className="small b">Discount vouchers</span>
              <div className="grid2" style={{ gap: 8 }}>
                <input name="discountCode" inputMode="numeric" maxLength={3} placeholder="3-digit code" style={field} aria-label="Discount code" />
                <input name="discountAmount" inputMode="decimal" placeholder="$ off (5 to 30)" style={field} aria-label="Dollars off" />
                <input name="discountCount" inputMode="numeric" placeholder="How many (e.g. 900)" style={field} aria-label="How many discount vouchers" />
              </div>
              <span className="small b">Free-service vouchers</span>
              <div className="grid2" style={{ gap: 8 }}>
                <input name="freeCode" inputMode="numeric" maxLength={4} placeholder="4-digit code" style={field} aria-label="Free-service code" />
                <input name="freeCount" inputMode="numeric" placeholder="How many (e.g. 100)" style={field} aria-label="How many free-service vouchers" />
              </div>
              <span className="xs muted">Type the exact number and codes printed on that person&apos;s vouchers — nothing is made up for you. Their discount and free-service vouchers share the one 16-digit number. How many = also the most students who can claim them. Saved batches are drafts until you tap Publish below.</span>
            </ActionForm>
          </>
        )}
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Voucher batches</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl"><thead><tr><th>Batch</th><th>Distributor</th><th>Number • code</th><th>Value</th><th>Valid thru</th><th className="num">Quantity (limit)</th><th className="num">Assigned to orgs</th><th className="num">Delivered</th><th className="num">Claimed</th><th className="num">Left to claim</th><th className="num">Rate</th><th /></tr></thead>
            <tbody>{r.campaigns.length === 0 ? <tr><td className="empty" colSpan={12}>No voucher batches yet. Set one up above for Avy, Kisses and Lakeesha (900 discount + 100 free service each).</td></tr> : r.campaigns.map((c) => (
              <tr key={c.id}><td className="b">{c.name}<div className="xs muted">{c.draft ? "Draft — not published" : c.status === "active" ? "Published • On" : "Off — no new activations"}</div></td><td>{nameOf(c.distributorId)}</td>
                <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{groupNumber(c.number)} • <b>{c.code}</b></td>
                <td>{c.kind === "free" ? "Free service" : `${money(c.amountCents)} off`}</td>
                <td>{validThruLabel(new Date(c.validThru))}</td>
                <td className="num">{c.printed}</td><td className="num">{c.assigned}</td><td className="num">{c.distributed}</td><td className="num b">{c.activations}</td><td className="num">{Math.max(0, c.printed - c.activations)}</td><td className="num">{pct(c.activations, c.distributed)}</td>
                <td>{<div className="row" style={{ gap: 8 }}>{c.draft && <form action={publishVoucherCampaign}><input type="hidden" name="id" value={c.id} /><button className="link xs b" type="submit">Publish</button></form>}<a className="link xs" href={`/admin/cards?edit=${c.id}#voucher-setup`}>Edit</a><form action={setVoucherCampaignStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="to" value={c.status === "active" ? "off" : "on"} /><button className="link xs" type="submit">{c.status === "active" ? "Turn off" : "Turn on"}</button></form></div>}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <span className="xs muted">Turning a campaign off stops new claims; students who already claimed keep their voucher. Changing the distributor (reassigning) is logged.</span>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Distributors</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl"><thead><tr><th>Distributor</th><th className="num">Assigned</th><th className="num">Distributed</th><th className="num">Remaining</th><th className="num">Votes</th><th className="num">Registrations</th><th className="num">Activations</th><th className="num">Free</th><th className="num">Discount</th><th className="num">Orgs visited</th><th className="num">Current activities</th><th>Last update</th><th /></tr></thead>
            <tbody>{dists.length === 0 ? <tr><td className="empty" colSpan={13}>No campaigns yet — set them up at the top.</td></tr> : dists.map((d) => (
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

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Look up a card or voucher</span>
        <form className="row" style={{ gap: 8 }}>
          <input name="q" defaultValue={q} inputMode="numeric" placeholder="Any part of the card or voucher number, the code, or its #" style={{ ...field, flex: 1 }} aria-label="Card number" />
          <button className="btn sm" type="submit">Find</button>
        </form>
        <span className="xs muted">Type any 4 or more digits from the front of a card or voucher (spaces are fine), the 3 or 4 digit code, or a card&apos;s # from its batch. Voucher matches show the batch and every student who activated it.</span>
        {foundCampaigns.length > 0 && (
          <div style={{ overflowX: "auto" }}><table className="tbl"><thead><tr><th>Voucher batch</th><th>Distributor</th><th>Number • code</th><th>Type</th><th className="num">How many</th><th className="num">Activated</th><th>Status</th></tr></thead>
            <tbody>{foundCampaigns.map((b) => <tr key={b.id}><td className="b">{b.name}</td><td>{nameOf(b.distributorId)}</td><td style={{ whiteSpace: "nowrap" }}>{groupNumber(b.sharedNumber ?? "")} • <b>{b.sharedCode}</b></td><td>{b.kind === "free" ? "Free service" : `${money(b.amountCents)} off`}</td><td className="num">{b.count}</td><td className="num">{b.claimed}</td><td>{b.draft ? "Draft" : b.status === "active" ? "On" : "Off"}</td></tr>)}</tbody>
          </table></div>
        )}
        {q.length >= 1 && (found.length === 0 && foundCampaigns.length === 0
          ? <span className="small muted">No card or voucher matches {q}.</span>
          : found.length > 0 && <div style={{ overflowX: "auto" }}><table className="tbl"><thead><tr><th>#</th><th>Number</th><th>Code</th><th>Card</th><th>Status</th><th>Student</th><th>Used on</th><th /></tr></thead><tbody>{found.map(cardRow)}</tbody></table></div>)}
      </div>

      <div className="card ok" style={{ gap: 10 }}>
        <span className="eyebrow">Active and assigned — saved on a student&apos;s account ({activeCards.length})</span>
        <span className="xs muted">These cards are on a student&apos;s account and haven&apos;t been used yet. A card chosen for a booking that isn&apos;t paid yet still counts as active.</span>
        {activeCards.length === 0 ? <span className="small muted">No cards saved on a student&apos;s account yet.</span> : (
          <div style={{ overflowX: "auto", maxHeight: 520 }}><table className="tbl"><thead><tr><th>#</th><th>Number</th><th>Code</th><th>Card</th><th>Status</th><th>Student</th><th>Used on</th><th /></tr></thead><tbody>{activeCards.map(cardRow)}</tbody></table></div>
        )}
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Used cards — no longer work ({usedCards.length})</span>
        <span className="xs muted">Each card works once. After it pays for a booking it moves here for good and can&apos;t be used again. The student sees it under Used cards on their account.</span>
        {usedCards.length === 0 ? <span className="small muted">No cards used yet.</span> : (
          <div style={{ overflowX: "auto", maxHeight: 520 }}><table className="tbl"><thead><tr><th>#</th><th>Number</th><th>Code</th><th>Card</th><th>Student</th><th>Used</th></tr></thead><tbody>
            {usedCards.map(({ c, b, first, last, place, paidAt }) => (
              <tr key={c.id} style={{ opacity: 0.75 }}>
                <td>{c.printSeq ?? "—"}</td><td style={{ whiteSpace: "nowrap" }}>{groupNumber(c.number)}</td><td>{c.code}</td>
                <td>{cardLabel(b.kind, !!b.sharedNumber)} • {b.name}{place ? <div className="xs muted">From {place}</div> : null}</td>
                <td>{[first, last].filter(Boolean).join(" ") || "Student"}</td>
                <td>{paidAt ? fmtDate(paidAt) : "—"}{c.usedBookingId ? <div className="xs muted">Booking {c.usedBookingId.slice(0, 8).toUpperCase()}</div> : null}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </div>

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
      <div className="col" id="reports" style={{ gap: 4, marginTop: 8 }}><span className="eyebrow">Reports</span></div>
      <form method="get" action="/admin/cards#reports" className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select name="city" defaultValue={sp.city ?? ""} style={field} aria-label="City"><option value="">All cities</option>{r.byCity.map((c) => <option key={c.cityId} value={c.cityId}>{c.city}, {c.state}</option>)}</select>
        <select name="cat" defaultValue={sp.cat ?? ""} style={field} aria-label="Service"><option value="">All services</option>{catList.map((c) => <option key={c.name}>{c.name}</option>)}</select>
        <select name="dist" defaultValue={sp.dist ?? ""} style={field} aria-label="Distributor"><option value="">All distributors</option>{owners.map((o) => <option key={o.id} value={o.id}>{ownerName(o)}</option>)}</select>
        <select name="kind" defaultValue={sp.kind ?? ""} style={field} aria-label="Voucher type"><option value="">Both types</option><option value="discount">Discount</option><option value="free">Free service</option></select>
        <button className="btn sm" type="submit" style={{ width: "auto" }}>Filter</button><a className="link xs" href="/admin/cards#reports" style={{ alignSelf: "center" }}>Clear filters</a>
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

      <div className="col" style={{ gap: 4, marginTop: 8 }}><span className="eyebrow">Individually numbered Nearest Cards</span><span className="xs muted">The older cards where every card had its own number. GRANTED vouchers above replace them as the handout.</span></div>
      <div className={`card${fund.available < fund.saved ? " warn" : " ok"}`} style={{ gap: 10 }}>
        <span className="eyebrow">Nearest Cards fund — what you can give back</span>
        <div className="kpis k4">
          <div className="col" style={{ gap: 2 }}><span className="xs muted">Set aside from booking fees</span><span className="stat">{money(fund.added)}</span><span className="xs muted">{fund.bookings} completed booking{fund.bookings === 1 ? "" : "s"} × up to {money(fund.perBooking)}</span></div>
          <div className="col" style={{ gap: 2 }}><span className="xs muted">Given back (cards used on paid bookings)</span><span className="stat">{money(fund.used)}</span></div>
          <div className="col" style={{ gap: 2 }}><span className="xs muted">Available to give back</span><span className="stat">{money(fund.available)}</span><span className="xs muted">{fund.available > 0 ? `= ${Math.floor(fund.available / 1000)} × $10 cards or ${Math.floor(fund.available / 500)} × $5 cards` : "Nothing available yet"}</span></div>
          <div className="col" style={{ gap: 2 }}><span className="xs muted">Already promised</span><span className="stat">{money(fund.saved)}</span><span className="xs muted">saved on student accounts, not used yet • {money(fund.unclaimed)} more printed and not saved yet</span></div>
        </div>
        <span className="xs muted">Every completed booking sets aside {money(fund.perBooking)} of its booking fee (never more than that booking&apos;s own fee) for Nearest Cards — change it in Rules &amp; Settings → Fees. When a student uses a card on a paid booking, its value comes out of the fund. It&apos;s a tracking number for planning only. Since November 4, 2026 professionals honor Nearest Cards (it&apos;s in the Professional Terms), so card value comes off the service and isn&apos;t paid out of Nearest&apos;s balance. Cards cover the service only — students still pay the booking fee and deposit.{fund.available < fund.saved ? " Cards already saved on student accounts are worth more than the fund right now — hold off on new cards until more bookings complete." : ""}</span>
      </div>
      <div className="kpis k4">
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Cards made</span><span className="stat">{totals.made}</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Saved by students</span><span className="stat">{totals.added}</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Used on a booking</span><span className="stat">{totals.used}</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Card value used on paid bookings</span><span className="stat">{money(totals.value)}</span></div>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Make cards</span>
        <span className="xs muted">Discount cards: 16-digit number + 3-digit code, $5–$30 off the service. Free cards: 16-digit number + 4-digit code, cover a professional's one free service up to the amount you set (at most ${CARD_LIMITS.freeMax / 100}). Every number starts with {CARD_LIMITS.prefix} and is random. Valid thru = the month printed on the card; after it, the card can&apos;t be added. Students have {days} days from the Handed out date to save a card to their account — after that it goes inactive and can&apos;t be added (change the number of days in Rules &amp; Settings → Fees). If you hand a batch out later than planned, change its Handed out date below.</span>
        <ActionForm action={createCards} submitLabel="Make cards" buttonClass="btn sm" className="col g8">
          <div className="row" style={{ gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <label className="check small"><input type="radio" name="kind" value="discount" defaultChecked /> <span>Discount card ($5–$30, 3-digit code)</span></label>
            <label className="check small"><input type="radio" name="kind" value="free" /> <span>Free card (4-digit code)</span></label>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input name="name" placeholder="Batch name (e.g. Homecoming giveaway)" maxLength={80} style={{ ...field, flex: "2 1 220px" }} aria-label="Batch name" />
            <input name="amount" inputMode="decimal" placeholder="Value $ (free: covers up to)" required style={{ ...field, flex: "1 1 160px" }} aria-label="Value in dollars" />
            <input name="count" type="number" min={1} max={CARD_LIMITS.batchMax} placeholder="How many" required style={{ ...field, width: 120 }} aria-label="How many cards" />
            <input name="validThru" type="month" required style={field} aria-label="Valid thru month" />
            <label className="xs muted col" style={{ gap: 2 }}>Handed out on
              <input name="handedOut" type="date" defaultValue={ymd(new Date())} required style={field} aria-label="Handed out on" />
            </label>
          </div>
        </ActionForm>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Batches</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Batch</th><th>Type</th><th>Value</th><th>Valid thru</th><th>Save by</th><th className="num">Made</th><th className="num">Added</th><th className="num">Used</th><th>Status</th><th /></tr></thead>
            <tbody>
              {live.length === 0 && <tr><td className="empty" colSpan={10}>No cards yet. Make your first batch above.</td></tr>}
              {live.map(({ b, added, used, notSaved }) => { const by = activateBy(b, days); const past = by < new Date(); return (
                <tr key={b.id}>
                  <td className="b">{b.name}<div className="xs muted">{fmtDate(b.createdAt)}</div></td>
                  <td>{b.kind === "free" ? "Free (4-digit)" : "Discount (3-digit)"}</td>
                  <td>{b.kind === "free" ? `Up to ${money(b.amountCents)}` : `${money(b.amountCents)} off`}</td>
                  <td>{validThruLabel(b.validThru)}</td>
                  <td>{fmtDate(by)}<div className="xs muted">{past ? `${notSaved} not saved — inactive` : `handed out ${fmtDate(b.handedOutAt ?? b.createdAt)}`}</div></td>
                  <td className="num">{b.count}</td><td className="num">{added}</td><td className="num">{used}</td>
                  <td><span className={`tag ${b.status === "active" ? "ok" : "bad"}`}>{b.status === "active" ? "On" : "Off"}</span></td>
                  <td>
                    <div className="col" style={{ gap: 6 }}>
                      <div className="row" style={{ gap: 6 }}>
                        <a className="btn sm" href={openBatch === b.id ? "/admin/cards" : batchLink(b.id)}>{openBatch === b.id ? "Hide cards" : "See cards"}</a>
                        <a className="btn ghost sm" href={`/api/admin/cards/${b.id}`}>Printer file</a>
                        <form action={setCardBatchStatus}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="to" value={b.status === "active" ? "off" : "on"} /><button className="btn ghost sm" type="submit">{b.status === "active" ? "Turn off" : "Turn on"}</button></form>
                      </div>
                      <details><summary className="link xs">Handed out date</summary>
                        <form action={setBatchHandout} className="row" style={{ gap: 6, marginTop: 6 }}><input type="hidden" name="id" value={b.id} /><input name="handedOut" type="date" defaultValue={ymd(b.handedOutAt ?? b.createdAt)} required style={field} aria-label="Handed out on" /><button className="btn ghost sm" type="submit">Save</button></form>
                      </details>
                      <details><summary className="link xs" style={{ color: "#F2A38F" }}>Discard batch</summary>
                        <form action={discardCardBatch} className="col" style={{ gap: 6, marginTop: 6, maxWidth: 280 }}><input type="hidden" name="id" value={b.id} />
                          <span className="xs muted">Every card in this batch stops working for good — including cards students saved but haven&apos;t used. Cards already used, or on a booking in progress, are left alone. This can&apos;t be undone.</span>
                          <label className="check xs"><input type="checkbox" name="sure" required /> <span>Discard these cards</span></label>
                          <button className="btn ghost sm" type="submit" style={{ color: "#F2A38F" }}>Discard batch</button>
                        </form>
                      </details>
                    </div>
                  </td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
        <span className="xs muted">See cards = every card in the batch right here — #, number, code and status — no spreadsheet needed. Printer file = a spreadsheet (CSV) of every card number and code in the batch, for your card printer. Keep it private — anyone with a number and code can add that card. Turn off stops cards that haven&apos;t been saved yet (you can turn it back on); cards already saved on a student&apos;s account keep working — to stop one of those, look it up below and tap Turn off. Discard stops the whole batch for good, saved cards included, and takes it off this page.</span>
        {openInfo && (
          <div className="col" id="batch-cards" style={{ gap: 8, marginTop: 6 }}>
            <span className="eyebrow">Cards in {openInfo.name} — {openInfo.kind === "free" ? "Free (4-digit code)" : "Discount (3-digit code)"}</span>
            <div style={{ overflowX: "auto", maxHeight: 560 }}>
              <table className="tbl"><thead><tr><th>#</th><th>Number</th><th>Code</th><th>Card</th><th>Status</th><th>Student</th><th>Used on</th><th /></tr></thead>
                <tbody>{batchCards.length === 0 ? <tr><td className="empty" colSpan={8}>No cards on this page.</td></tr> : batchCards.map(cardRow)}</tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {page > 1 && <a className="btn ghost sm" href={batchLink(openInfo.id, page - 1)}>Previous 100</a>}
                <span className="xs muted">Cards {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, openInfo.count)} of {openInfo.count} • page {page} of {pages}</span>
                {page < pages && <a className="btn ghost sm" href={batchLink(openInfo.id, page + 1)}>Next 100</a>}
              </div>
            )}
          </div>
        )}
      </div>

      {locked.length > 0 && (
        <div className="card warn" style={{ gap: 10 }}>
          <span className="eyebrow">Locked cards</span>
          <span className="xs">Someone typed the wrong code {CARD_LIMITS.lockAfter} times on these numbers, so they were locked. If the real card holder contacts support, Unlock it; if it looks like guessing, leave it locked or Turn off.</span>
          <div style={{ overflowX: "auto" }}><table className="tbl"><thead><tr><th>#</th><th>Number</th><th>Code</th><th>Card</th><th>Status</th><th>Student</th><th>Used on</th><th /></tr></thead><tbody>{locked.map(cardRow)}</tbody></table></div>
        </div>
      )}
    </>
  );
}
