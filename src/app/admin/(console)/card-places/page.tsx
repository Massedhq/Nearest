import { asc, eq } from "drizzle-orm";
import { db, cities } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { cardTotals, ensurePrintSeq, groupNumber } from "@/lib/nearest-cards";
import { PLACE_KINDS, placesWithCounts, unassignedByBatch, cardsAtPlace } from "@/lib/card-places";
import { addCardPlace, setCardPlaceActive, assignCardsToPlace } from "@/app/admin/card-place-actions";
import { money } from "@/lib/time";

export const metadata = { title: "Card places" };
export const dynamic = "force-dynamic";

const field = { borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px", height: 40 } as const;

/**
 * Card places — every owner (Avy, Kisses, Lakeesha) adds the places Nearest gives cards to and assigns cards to them,
 * so we always know how many each place has left. Making card batches stays the main owner's alone (Nearest Cards).
 */
export default async function CardPlaces({ searchParams }: { searchParams: Promise<{ place?: string }> }) {
  const { role } = await requireAdmin();
  const isOwner = role === "OWNER";
  const open = (await searchParams).place ?? "";
  await ensurePrintSeq();
  const [totals, places, batches, cityList] = await Promise.all([
    cardTotals(),
    placesWithCounts(),
    unassignedByBatch(),
    db.select({ id: cities.id, name: cities.name, state: cities.state }).from(cities).where(eq(cities.active, true)).orderBy(asc(cities.name)),
  ]);
  const detail = /^[0-9a-f-]{36}$/.test(open) ? await cardsAtPlace(open) : [];
  const atPlaces = places.reduce((n, p) => n + p.left, 0);
  return (
    <>
      <AdminHead eyebrow="Business" title="Card places" />
      <div className="kpis k4">
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Card limit</span><span className="stat">{totals.max.toLocaleString()}</span><span className="xs muted">{totals.made.toLocaleString()} made so far</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Saved by students</span><span className="stat">{totals.activated.toLocaleString()}</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Left of the {totals.max.toLocaleString()}</span><span className="stat">{totals.leftToActivate.toLocaleString()}</span><span className="xs muted">goes down each time a student saves a card</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Still at places, not saved yet</span><span className="stat">{atPlaces.toLocaleString()}</span></div>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Places with cards</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Place</th><th>City</th><th className="num">Given</th><th className="num">Saved by students</th><th className="num">Left</th><th>Shown to students</th><th /></tr></thead>
            <tbody>
              {places.length === 0 && <tr><td className="empty" colSpan={7}>No places yet.{isOwner ? " Add the first one below." : ""}</td></tr>}
              {places.map((p) => (
                <tr key={p.id}>
                  <td className="b">{p.name}<div className="xs muted">{PLACE_KINDS[p.kind] ?? "Other"}{p.address ? ` • ${p.address}` : ""}</div>{p.notes && <div className="xs muted">{p.notes}</div>}</td>
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
        <span className="xs muted">Left = cards given to the place that no student has saved yet and that can still be saved (not past the save window or Valid thru, not turned off). Students see every place that has cards left, by city — name, type and address only, never your notes.</span>
      </div>

      {open && (
        <div className="card" style={{ gap: 10 }} id="cards">
          <span className="eyebrow">Cards at {places.find((p) => p.id === open)?.name ?? "this place"}</span>
          {detail.length === 0 ? <span className="small muted">No cards given to this place yet.</span> : (
            <div style={{ overflowX: "auto", maxHeight: 420 }}>
              <table className="tbl"><thead><tr><th>#</th><th>Card number</th><th>Batch</th><th>Status</th></tr></thead>
                <tbody>{detail.map((c) => <tr key={c.id}><td>{c.seq ?? "—"}</td><td>{groupNumber(c.number)}</td><td>{c.batch}</td><td>{c.state}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isOwner ? (
        <div className="acols">
          <div className="card" style={{ gap: 10 }}>
            <span className="eyebrow">Give cards to a place</span>
            <span className="xs muted">Every printer file has a # column — the card&apos;s place in the stack. Give a place a stack by its first and last #, or paste exact card numbers (one per line). Cards a student already saved are never moved.</span>
            <ActionForm action={assignCardsToPlace} submitLabel="Give these cards" buttonClass="btn sm" className="col g8">
              <select name="placeId" required defaultValue="" style={field} aria-label="Place">
                <option value="" disabled>Choose a place…</option>
                {places.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}{p.city ? ` — ${p.city}` : ""}</option>)}
              </select>
              <select name="batchId" defaultValue="" style={field} aria-label="Batch">
                <option value="">Batch (for a # range)…</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.kind === "free" ? "Free" : `${money(b.amountCents)} off`} • {b.free} not given out{b.firstSeq ? ` (#${b.firstSeq}–#${b.lastSeq})` : ""}</option>)}
              </select>
              <div className="row" style={{ gap: 8 }}>
                <input name="from" type="number" min={1} placeholder="First #" style={{ ...field, width: 120 }} aria-label="First #" />
                <input name="to" type="number" min={1} placeholder="Last #" style={{ ...field, width: 120 }} aria-label="Last #" />
              </div>
              <span className="xs muted">— or —</span>
              <textarea name="numbers" rows={4} placeholder={"Card numbers, one per line\n8877 2436 9810 5524"} style={{ ...field, height: "auto", padding: 10 }} aria-label="Card numbers" />
              <label className="check xs"><input type="checkbox" name="move" /> <span>Move cards that are already at another place</span></label>
            </ActionForm>
          </div>
          <div className="card" style={{ gap: 10 }}>
            <span className="eyebrow">Add a place</span>
            <ActionForm action={addCardPlace} submitLabel="Add place" buttonClass="btn sm" className="col g8">
              <input name="name" required maxLength={120} placeholder="Place name (e.g. MLK Recreation Center)" style={field} aria-label="Place name" />
              <select name="kind" defaultValue="youth_program" style={field} aria-label="Type">
                {Object.entries(PLACE_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select name="cityId" required defaultValue="" style={field} aria-label="City">
                <option value="" disabled>City…</option>
                {cityList.map((c) => <option key={c.id} value={c.id}>{c.name}, {c.state}</option>)}
              </select>
              <input name="address" maxLength={200} placeholder="Address (optional — students see it)" style={field} aria-label="Address" />
              <input name="notes" maxLength={500} placeholder="Notes for the team (optional — students never see these)" style={field} aria-label="Notes" />
            </ActionForm>
          </div>
        </div>
      ) : (
        <span className="small muted">Only owners can add places and give cards to them.</span>
      )}
    </>
  );
}
