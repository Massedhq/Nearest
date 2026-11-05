import { desc, eq, like, or, sql } from "drizzle-orm";
import { db, nearestCardBatches, nearestCards, users } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireMainOwner } from "@/lib/admin";
import { cardLabel, cardFund, digits, groupNumber, validThruLabel, activateBy, activateDays, CARD_LIMITS } from "@/lib/nearest-cards";
import { createCards, setCardBatchStatus, setCardStatus, setBatchHandout, discardCardBatch } from "@/app/admin/card-actions";
import { fmtDate, money } from "@/lib/time";

export const metadata = { title: "Nearest Cards" };
export const dynamic = "force-dynamic";

const field = { borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px", height: 40 } as const;
const STATUS: Record<string, string> = { issued: "Not added yet", activated: "On a student's account", off: "Turned off", locked: "Locked (too many wrong codes)", discarded: "Discarded" };
const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

/** Owners: make batches of printed Nearest Cards, download the printer file, and look up any card. */
export default async function AdminCards({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireMainOwner({ page: true });
  const q = digits((await searchParams).q ?? "").slice(0, 16);
  const days = await activateDays();
  const [fund, batches, totals, found, locked] = await Promise.all([
    cardFund(),
    db.select({
      b: nearestCardBatches,
      added: sql<number>`(select count(*)::int from nearest_cards c where c.batch_id = ${nearestCardBatches.id} and c.status = 'activated')`,
      used: sql<number>`(select count(*)::int from nearest_cards c where c.batch_id = ${nearestCardBatches.id} and c.credit_id is not null)`,
      notSaved: sql<number>`(select count(*)::int from nearest_cards c where c.batch_id = ${nearestCardBatches.id} and c.status = 'issued')`,
    }).from(nearestCardBatches).orderBy(desc(nearestCardBatches.createdAt)).limit(100),
    db.select({
      made: sql<number>`count(*)::int`,
      added: sql<number>`count(*) filter (where ${nearestCards.status} = 'activated')::int`,
      used: sql<number>`count(*) filter (where ${nearestCards.creditId} is not null)::int`,
      value: sql<number>`(select coalesce(sum(bk.card_cents), 0)::int from bookings bk where bk.card_id is not null and bk.paid_at is not null)`,
    }).from(nearestCards).innerJoin(nearestCardBatches, eq(nearestCardBatches.id, nearestCards.batchId)).then((r) => r[0]),
    q.length >= 4
      ? db.select({ c: nearestCards, b: nearestCardBatches, first: users.firstName, last: users.lastName }).from(nearestCards)
          .innerJoin(nearestCardBatches, eq(nearestCardBatches.id, nearestCards.batchId)).leftJoin(users, eq(users.id, nearestCards.studentId))
          .where(q.length === 16 ? eq(nearestCards.number, q) : like(nearestCards.number, `%${q}`)).limit(25)
      : Promise.resolve([]),
    db.select({ c: nearestCards, b: nearestCardBatches, first: users.firstName, last: users.lastName }).from(nearestCards)
      .innerJoin(nearestCardBatches, eq(nearestCardBatches.id, nearestCards.batchId)).leftJoin(users, eq(users.id, nearestCards.studentId))
      .where(or(eq(nearestCards.status, "locked"))).limit(25),
  ]);
  const live = batches.filter((x) => x.b.status !== "discarded");
  const gone = batches.filter((x) => x.b.status === "discarded");
  const cardRow = ({ c, b, first, last }: (typeof locked)[number]) => (
    <tr key={c.id}>
      <td className="b">{groupNumber(c.number)}</td>
      <td>{cardLabel(b.kind)} • {b.name}</td>
      <td>{c.status === "issued" && activateBy(b, days) < new Date() ? `Inactive — not saved within ${days} days` : (STATUS[c.status] ?? c.status)}{c.failedAttempts > 0 && c.status !== "activated" ? ` • ${c.failedAttempts} wrong code${c.failedAttempts === 1 ? "" : "s"}` : ""}</td>
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
                        <a className="btn sm" href={`/api/admin/cards/${b.id}`}>Printer file</a>
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
        <span className="xs muted">Printer file = a spreadsheet (CSV) of every card number and code in the batch, for your card printer. Keep it private — anyone with a number and code can add that card. Turn off stops cards that haven&apos;t been saved yet (you can turn it back on); cards already saved on a student&apos;s account keep working — to stop one of those, look it up below and tap Turn off. Discard stops the whole batch for good, saved cards included.</span>
        {gone.length > 0 && (
          <details><summary className="link xs">Discarded batches ({gone.length})</summary>
            <div style={{ overflowX: "auto", marginTop: 8 }}><table className="tbl"><thead><tr><th>Batch</th><th>Value</th><th className="num">Made</th><th className="num">Used</th><th>Discarded</th></tr></thead><tbody>
              {gone.map(({ b, used }) => <tr key={b.id}><td>{b.name}</td><td>{b.kind === "free" ? `Free, up to ${money(b.amountCents)}` : `${money(b.amountCents)} off`}</td><td className="num">{b.count}</td><td className="num">{used}</td><td>{b.discardedAt ? fmtDate(b.discardedAt) : "—"}</td></tr>)}
            </tbody></table></div>
          </details>
        )}
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Look up a card</span>
        <form className="row" style={{ gap: 8 }}>
          <input name="q" defaultValue={q} inputMode="numeric" placeholder="Full card number or last 4 digits" style={{ ...field, flex: 1 }} aria-label="Card number" />
          <button className="btn sm" type="submit">Find</button>
        </form>
        {q.length >= 4 && (found.length === 0
          ? <span className="small muted">No card matches {q}.</span>
          : <div style={{ overflowX: "auto" }}><table className="tbl"><thead><tr><th>Number</th><th>Card</th><th>Status</th><th>Student</th><th>Used on</th><th /></tr></thead><tbody>{found.map(cardRow)}</tbody></table></div>)}
      </div>

      {locked.length > 0 && (
        <div className="card warn" style={{ gap: 10 }}>
          <span className="eyebrow">Locked cards</span>
          <span className="xs">Someone typed the wrong code {CARD_LIMITS.lockAfter} times on these numbers, so they were locked. If the real card holder contacts support, Unlock it; if it looks like guessing, leave it locked or Turn off.</span>
          <div style={{ overflowX: "auto" }}><table className="tbl"><thead><tr><th>Number</th><th>Card</th><th>Status</th><th>Student</th><th>Used on</th><th /></tr></thead><tbody>{locked.map(cardRow)}</tbody></table></div>
        </div>
      )}
    </>
  );
}
