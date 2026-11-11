import { asc, eq } from "drizzle-orm";
import { db, cities } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { cardTotals, ensurePrintSeq, groupNumber } from "@/lib/nearest-cards";
import { PLACE_KINDS, placesWithCounts, unassignedByBatch, cardsAtPlace, cardsInBatch, viewableBatches } from "@/lib/card-places";
import { addCardPlace, setCardPlaceActive, assignCardsToPlace, setCardPlaceAddress } from "@/app/admin/card-place-actions";
import { money } from "@/lib/time";

export const metadata = { title: "Card places" };
export const dynamic = "force-dynamic";

const field = { borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px", height: 40 } as const;
const mono = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } as const;

/**
 * Card places (card partners) — every owner (Avy, Kisses, Lakeesha) adds the youth programs, community centers, churches,
 * charities and shelters Nearest gives cards to (address required), gives them cards (full card numbers, a stack from the
 * first to the last card, or # numbers), and sees every card's full number + security code and which partner has it.
 * Making card batches stays the main owner's alone (Nearest Cards).
 */
export default async function CardPlaces({ searchParams }: { searchParams: Promise<{ place?: string; given?: string; batch?: string; page?: string; show?: string }> }) {
  const { role } = await requireAdmin();
  const isOwner = role === "OWNER";
  const sp = await searchParams;
  const open = sp.place ?? "";
  const show = sp.show === "given" || sp.show === "not_given" ? sp.show : "all";
  await ensurePrintSeq();
  const [totals, places, batches, allBatches, cityList] = await Promise.all([
    cardTotals(),
    placesWithCounts(),
    unassignedByBatch(),
    viewableBatches(),
    db.select({ id: cities.id, name: cities.name, state: cities.state }).from(cities).where(eq(cities.active, true)).orderBy(asc(cities.name)),
  ]);
  const detail = /^[0-9a-f-]{36}$/.test(open) ? await cardsAtPlace(open) : [];
  const batchView = sp.batch && /^[0-9a-f-]{36}$/.test(sp.batch) ? await cardsInBatch(sp.batch, { page: Number(sp.page) || 1, show }) : null;
  const atPlaces = places.reduce((n, p) => n + p.left, 0);
  const pageLink = (n: number) => `/admin/card-places?batch=${sp.batch}&show=${show}&page=${n}#batch-cards`;
  return (
    <>
      <AdminHead eyebrow="Business" title="Card places" />

      {isOwner && (
        <div className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Add a card partner</span>
          <span className="xs muted">A youth program, community center, church, charity or shelter that hands out Nearest Cards. The address is required — students see it so they know where to get a card.</span>
          <ActionForm action={addCardPlace} submitLabel="Add card partner" buttonClass="btn sm" className="col g8">
            <div className="grid2" style={{ gap: 8 }}>
              <input name="name" required maxLength={120} placeholder="Name (e.g. MLK Recreation Center)" style={field} aria-label="Name" />
              <select name="kind" defaultValue="youth_program" style={field} aria-label="Type">
                {Object.entries(PLACE_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input name="address" required minLength={6} maxLength={200} placeholder="Street address (e.g. 1234 Main St)" style={field} aria-label="Street address" />
              <input name="city" list="card-place-cities" required autoComplete="off" placeholder="City — start typing (e.g. Lewisville)" style={field} aria-label="City" />
            </div>
            <datalist id="card-place-cities">
              {cityList.map((c) => <option key={c.id} value={`${c.name}, ${c.state}`} />)}
            </datalist>
            <input name="notes" maxLength={500} placeholder="Notes for the team (optional — students never see these)" style={field} aria-label="Notes" />
          </ActionForm>
        </div>
      )}

      <div className="kpis k4">
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Card limit</span><span className="stat">{totals.max.toLocaleString()}</span><span className="xs muted">{totals.made.toLocaleString()} made so far</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Saved by students</span><span className="stat">{totals.activated.toLocaleString()}</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Left of the {totals.max.toLocaleString()}</span><span className="stat">{totals.leftToActivate.toLocaleString()}</span><span className="xs muted">goes down each time a student saves a card</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Still at partners, not saved yet</span><span className="stat">{atPlaces.toLocaleString()}</span></div>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Card partners</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Card partner</th><th>City</th><th className="num">Given</th><th className="num">Saved by students</th><th className="num">Left</th><th>Shown to students</th><th /></tr></thead>
            <tbody>
              {places.length === 0 && <tr><td className="empty" colSpan={7}>No card partners yet.{isOwner ? " Add the first one above." : ""}</td></tr>}
              {places.map((p) => (
                <tr key={p.id}>
                  <td className="b">{p.name}<div className="xs muted">{PLACE_KINDS[p.kind] ?? "Other"}{p.address ? ` • ${p.address}` : ""}</div>{p.notes && <div className="xs muted">{p.notes}</div>}
                    {isOwner && !p.address && (
                      <ActionForm action={setCardPlaceAddress} submitLabel="Save address" buttonClass="btn ghost sm" className="col g8">
                        <input type="hidden" name="id" value={p.id} />
                        <span className="xs" style={{ color: "#E3A08A" }}>Address needed</span>
                        <input name="address" required minLength={6} maxLength={200} placeholder="Street address" style={field} aria-label={`Address for ${p.name}`} />
                      </ActionForm>
                    )}
                  </td>
                  <td>{p.city ?? "—"}</td>
                  <td className="num">{p.assigned}</td><td className="num">{p.activated}</td><td className="num b">{p.left}</td>
                  <td>{!p.active ? <span className="tag bad">Hidden</span> : p.left > 0 ? <span className="tag ok">Yes</span> : <span className="tag">No cards left</span>}</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <a className="link xs" href={open === p.id ? "/admin/card-places" : `/admin/card-places?place=${p.id}#cards`}>{open === p.id ? "Hide cards" : "See cards"}</a>
                      {isOwner && <form action={setCardPlaceActive}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="to" value={p.active ? "off" : "on"} /><button className="link xs" type="submit">{p.active ? "Hide from students" : "Show to students"}</button></form>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <span className="xs muted">Left = cards given to the partner that no student has saved yet and that can still be saved (not past the save window or Valid thru, not turned off). Students see every partner that has cards left, by city — name, type and address only, never your notes.</span>
      </div>

      {open && (
        <div className="card" style={{ gap: 10 }} id="cards">
          <span className="eyebrow">Cards at {places.find((p) => p.id === open)?.name ?? "this partner"}</span>
          {sp.given && <span className="small" style={{ color: "#9FD8A8" }}>{sp.given}</span>}
          {detail.length === 0 ? <span className="small muted">No cards given to this partner yet.</span> : (
            <div style={{ overflowX: "auto", maxHeight: 520 }}>
              <table className="tbl"><thead><tr><th>#</th><th>Card number</th><th>Code</th><th>Batch</th><th>Status</th></tr></thead>
                <tbody>{detail.map((c) => <tr key={c.id}><td>{c.seq ?? "—"}</td><td style={mono}>{groupNumber(c.number)}</td><td style={mono} className="b">{c.code}</td><td>{c.batch}</td><td>{c.state}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <span className="xs muted">{detail.length} card{detail.length === 1 ? "" : "s"} at this partner. The code is the 3-digit (discount) or 4-digit (free) security code printed with each card.</span>
        </div>
      )}

      {isOwner ? (
        <div className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Give cards to a card partner</span>
          <span className="xs muted">Type the <b>full card number</b> of the first and last card in the stack you&apos;re dropping off — every card between them goes to the partner. You can also use the # from the printer file (then choose the batch), or paste exact card numbers one per line. Cards a student already saved are never moved. After you give cards, the partner&apos;s full list (number + code) opens below.</span>
          <ActionForm action={assignCardsToPlace} submitLabel="Give these cards" buttonClass="btn sm" className="col g8">
            <select name="placeId" required defaultValue={open || ""} style={field} aria-label="Card partner">
              <option value="" disabled>Choose a card partner…</option>
              {places.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}{p.city ? ` — ${p.city}` : ""}</option>)}
            </select>
            <div className="grid2" style={{ gap: 8 }}>
              <input name="from" inputMode="numeric" maxLength={24} placeholder="First card — full number (or #)" style={field} aria-label="First card number" />
              <input name="to" inputMode="numeric" maxLength={24} placeholder="Last card — full number (or #)" style={field} aria-label="Last card number" />
            </div>
            <select name="batchId" defaultValue="" style={field} aria-label="Batch">
              <option value="">Batch — only needed if you typed # numbers</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.kind === "free" ? "Free" : `${money(b.amountCents)} off`} • {b.free} not given out{b.firstSeq ? ` (#${b.firstSeq}–#${b.lastSeq})` : ""}</option>)}
            </select>
            <span className="xs muted">— or paste exact cards —</span>
            <textarea name="numbers" rows={4} placeholder={"Full card numbers, one per line\n8877 2436 9810 5524"} style={{ ...field, height: "auto", padding: 10 }} aria-label="Card numbers" />
            <label className="check xs"><input type="checkbox" name="move" /> <span>Move cards that are already at another partner</span></label>
          </ActionForm>
        </div>
      ) : (
        <span className="small muted">Only owners can add card partners and give cards to them.</span>
      )}

      <div className="card" style={{ gap: 10 }} id="batch-cards">
        <span className="eyebrow">Every card in a batch</span>
        <span className="xs muted">See each card&apos;s full number, security code, status and which card partner has it — no spreadsheet needed.</span>
        <form method="get" action="/admin/card-places#batch-cards" className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <select name="batch" defaultValue={sp.batch ?? ""} style={field} aria-label="Batch">
            <option value="" disabled>Choose a batch…</option>
            {allBatches.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.kind === "free" ? "Free" : `${money(b.amountCents)} off`} • {b.count} cards</option>)}
          </select>
          <select name="show" defaultValue={show} style={field} aria-label="Show">
            <option value="all">All cards</option>
            <option value="given">Given to a partner</option>
            <option value="not_given">Not given out yet</option>
          </select>
          <button className="btn sm" type="submit">Show cards</button>
        </form>
        {batchView && (
          <>
            <div style={{ overflowX: "auto", maxHeight: 620 }}>
              <table className="tbl">
                <thead><tr><th>#</th><th>Card number</th><th>Code</th><th>Card partner</th><th>Status</th></tr></thead>
                <tbody>
                  {batchView.rows.length === 0 && <tr><td className="empty" colSpan={5}>No cards here.</td></tr>}
                  {batchView.rows.map((c) => <tr key={c.id}><td>{c.seq ?? "—"}</td><td style={mono}>{groupNumber(c.number)}</td><td style={mono} className="b">{c.code}</td><td>{c.place ?? <span className="muted">Not given out</span>}</td><td>{c.state}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="row between xs muted">
              <span>{batchView.total.toLocaleString()} card{batchView.total === 1 ? "" : "s"} • page {batchView.page} of {batchView.pages}</span>
              <span className="row" style={{ gap: 10 }}>
                {batchView.page > 1 && <a className="link" href={pageLink(batchView.page - 1)}>‹ Previous 100</a>}
                {batchView.page < batchView.pages && <a className="link" href={pageLink(batchView.page + 1)}>Next 100 ›</a>}
              </span>
            </div>
          </>
        )}
      </div>
    </>
  );
}
