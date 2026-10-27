import { and, asc, desc, eq, gte, lt, inArray } from "drizzle-orm";
import { db, meetSpots, outreachMeetings } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { CopyButton } from "@/components/CopyButton";
import { requireAdmin } from "@/lib/admin";
import { fmtDate, fmtTime } from "@/lib/time";
import { MEET_CITIES, MEET_HOST, SPECIALTIES, STATUSES, meetSettings, whereLabel, type Specialty, type ProStatus } from "@/lib/meet";
import { SITE_URL } from "@/lib/public/site";
import { addMeetSpots, removeMeetSpot, setMeetingState } from "@/app/admin/meet-actions";

export const metadata = { title: "Outreach meetings" };
export const dynamic = "force-dynamic";

type M = typeof outreachMeetings.$inferSelect;
const STATE_TAG: Record<string, [string, string]> = { booked: ["Booked", ""], showed: ["Showed up", "ok"], no_show: ["No-show", "bad"], cancelled: ["Cancelled", ""] };

/** Owner: every in-person meeting booked through /meet — the week on the road, spots per city, and the Starbucks list. */
export default async function MeetAdmin({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin({ owner: true });
  const sp = await searchParams;
  const past = sp.show === "past";
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 12 * 3600 * 1000);
  const [cfg, list, spots, held] = await Promise.all([
    meetSettings(),
    past
      ? db.select().from(outreachMeetings).where(lt(outreachMeetings.startsAt, dayAgo)).orderBy(desc(outreachMeetings.startsAt)).limit(200)
      : db.select().from(outreachMeetings).where(and(gte(outreachMeetings.startsAt, dayAgo), inArray(outreachMeetings.state, ["booked", "showed", "no_show"]))).orderBy(asc(outreachMeetings.startsAt)),
    db.select().from(meetSpots).where(eq(meetSpots.active, true)).orderBy(asc(meetSpots.city), asc(meetSpots.name)),
    db.select({ city: outreachMeetings.city, sp: outreachMeetings.specialty, fsp: outreachMeetings.friendSpecialty }).from(outreachMeetings).where(inArray(outreachMeetings.state, ["booked", "showed"])),
  ]);
  const filled = (city: string, k: string) => held.filter((h) => h.city === city && h.sp === k).length + held.filter((h) => h.city === city && h.fsp === k).length;
  const days = [...new Set(list.map((m) => fmtDate(m.startsAt, { weekday: "long", month: "long", day: "numeric" })))];
  const link = `${SITE_URL}/meet`;

  const card = (m: M) => {
    const [tag, cls] = STATE_TAG[m.state] ?? [m.state, ""];
    const ended = m.endsAt.getTime() < now.getTime();
    const btn = (to: string, label: string, klass = "btn ghost sm") => (
      <ActionForm action={setMeetingState} submitLabel={label} buttonClass={klass} className="col g4">
        <input type="hidden" name="id" value={m.id} /><input type="hidden" name="to" value={to} />
      </ActionForm>
    );
    return (
      <div key={m.id} id={`m-${m.id}`} className="card" style={{ gap: 10 }}>
        <div className="row between" style={{ flexWrap: "wrap", gap: 8 }}>
          <span className="b">{fmtTime(m.startsAt)} · {m.city}</span>
          <span className={`tag ${cls}`}>{ended && m.state === "booked" ? "Mark showed up or no-show" : tag}</span>
        </div>
        <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/admin/meet-photo/${m.id}/pro`} alt={`${m.legalFirst} ${m.legalLast}`} width={72} height={72} style={{ borderRadius: 36, objectFit: "cover", background: "#1C1C1F" }} />
          <div className="col g4 grow" style={{ minWidth: 200 }}>
            <span className="b">{m.legalFirst} {m.legalLast}{m.businessName ? <span className="muted small"> · {m.businessName}</span> : null}</span>
            <span className="small">{SPECIALTIES[m.specialty as Specialty]} · {STATUSES[m.proStatus as ProStatus]} · {m.homeBased ? "Home-based" : "Not home-based"}</span>
            <span className="small">{m.phone} · {m.email}</span>
            <span className="small"><span className="muted">{m.locationType === "starbucks" ? "Starbucks:" : "Their location:"}</span> {whereLabel(m)}{m.locationNotes ? <span className="muted"> — {m.locationNotes}</span> : null}</span>
          </div>
        </div>
        {m.friendFirst && (
          <div className="row" style={{ gap: 12, alignItems: "center", borderTop: "1px solid #1C1C1F", paddingTop: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/admin/meet-photo/${m.id}/friend`} alt={`${m.friendFirst} ${m.friendLast}`} width={48} height={48} style={{ borderRadius: 24, objectFit: "cover", background: "#1C1C1F" }} />
            <span className="small"><span className="muted">Friend:</span> <span className="b">{m.friendFirst} {m.friendLast}</span> · {SPECIALTIES[m.friendSpecialty as Specialty]} · {STATUSES[m.friendStatus as ProStatus]} · {m.friendContact}</span>
          </div>
        )}
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {m.state !== "showed" && btn("showed", "Mark showed up", "btn sm")}
          {m.state !== "no_show" && ended && btn("no_show", "Mark no-show (can't book again)")}
          {m.state === "booked" && !ended && btn("cancelled", "Cancel meeting")}
          {(m.state === "showed" || m.state === "no_show" || m.state === "cancelled") && btn("booked", "Undo")}
        </div>
      </div>
    );
  };

  return (
    <>
      <AdminHead eyebrow={`${MEET_HOST.title} · owner only`} title="Outreach meetings" />
      <div className="card" style={{ gap: 6 }}>
        <span className="small b">Your booking link</span>
        <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}><span className="small">{link}</span><CopyButton text={link} /></div>
        <span className="xs muted">Send this in your comments and DMs. Meetings are {cfg.meeting} minutes with {cfg.travel} minutes of travel after each, {cfg.spots} spots per specialty per city. Change the times, day off and spots in Rules &amp; Settings → Outreach meetings.</span>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <a className={`chip${past ? "" : " on"}`} href="/admin/meet">Upcoming</a>
        <a className={`chip${past ? " on" : ""}`} href="/admin/meet?show=past">Past &amp; cancelled</a>
      </div>
      {list.length === 0 && <div className="card"><span className="small muted">{past ? "No past meetings yet." : "No meetings booked yet."}</span></div>}
      {past
        ? list.map(card)
        : days.map((d) => (
          <div key={d} className="col" style={{ gap: 10 }}>
            <h2 className="disp h3">{d}</h2>
            {list.filter((m) => fmtDate(m.startsAt, { weekday: "long", month: "long", day: "numeric" }) === d).map(card)}
          </div>
        ))}

      <h2 className="disp h3">Spots filled</h2>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="small" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={{ textAlign: "left", padding: 6 }}>City</th>{Object.values(SPECIALTIES).map((s) => <th key={s} style={{ padding: 6 }}>{s}</th>)}</tr></thead>
          <tbody>
            {MEET_CITIES.map((c) => (
              <tr key={c} style={{ borderTop: "1px solid #1C1C1F" }}>
                <td style={{ padding: 6 }}>{c}</td>
                {Object.keys(SPECIALTIES).map((k) => { const n = filled(c, k); return <td key={k} style={{ padding: 6, textAlign: "center", color: n >= cfg.spots ? "#F2A38F" : n ? "#F4F1EA" : "#6F6A62", fontWeight: n >= cfg.spots ? 700 : 400 }}>{n}/{cfg.spots}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="disp h3">Starbucks meet-up spots</h2>
      <span className="xs muted">Professionals can pick one of these instead of you coming to them. A city with none listed shows &ldquo;No Starbucks listed yet&rdquo;. Copy names and addresses from the Starbucks store locator.</span>
      <ActionForm action={addMeetSpots} submitLabel="Add locations" buttonClass="btn sm" className="card">
        <label className="col g4"><span className="xs muted">City</span>
          <select name="city" className="ainput" defaultValue="">{[<option key="" value="" disabled>Choose a city</option>, ...MEET_CITIES.map((c) => <option key={c} value={c}>{c}</option>)]}</select>
        </label>
        <label className="col g4"><span className="xs muted">One per line: Name | Address</span>
          <textarea name="lines" rows={4} className="ainput" placeholder={"Store name | Street address, City, TX ZIP\nStore name | Street address, City, TX ZIP"} />
        </label>
      </ActionForm>
      {MEET_CITIES.map((c) => {
        const here = spots.filter((s) => s.city === c);
        return (
          <div key={c} className="card" style={{ gap: 6 }}>
            <span className="small b">{c} <span className="muted">({here.length})</span></span>
            {here.length === 0 && <span className="xs muted">No Starbucks listed yet.</span>}
            {here.map((s) => (
              <div key={s.id} className="row between" style={{ gap: 8, flexWrap: "wrap" }}>
                <span className="small">{s.name} <span className="muted">— {s.address}</span></span>
                <ActionForm action={removeMeetSpot} submitLabel="Remove" buttonClass="link xs" className="row"><input type="hidden" name="id" value={s.id} /></ActionForm>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
