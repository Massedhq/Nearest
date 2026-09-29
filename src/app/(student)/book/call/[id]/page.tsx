import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, modelCalls, professionalProfiles } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { liveProWhere } from "@/lib/search";
import { creditBalances, applyCredits } from "@/lib/credits";
import { getSettings } from "@/lib/settings";
import { fmtDate, fmtTime, chicagoToUtc } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { PriceBox, Terms } from "@/components/BookingTerms";
import { Icon } from "@/components/Icon";
import { bookModelCall } from "@/app/book-actions";
import { WherePicker } from "@/components/WherePicker";
import Link from "next/link";
import { openSlots, nextDays } from "@/lib/availability";

export const metadata = { title: "Book a model call" };

export default async function BookCall({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string; time?: string }> }) {
  const { user } = await requireVerifiedStudent();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const call = await db.query.modelCalls.findFirst({ where: eq(modelCalls.id, id) });
  if (!call) notFound();
  const [pro] = await db.select().from(professionalProfiles).where(and(eq(professionalProfiles.userId, call.userId), ...liveProWhere(null, "all"))).limit(1);
  if (!pro) notFound();
  const full = call.status !== "open" || call.spotsTaken >= call.spots || call.startsAt.getTime() < Date.now();
  const s = await getSettings();
  const deposit = Math.min(Number(s["appt.deposit_cents"]), call.priceCents);
  const use = applyCredits(call.priceCents, await creditBalances(user.id, call.userId));
  // Open time: the model picks a day and time from the pro's availability (up to the open-until date).
  const sp = await searchParams;
  const untilDay = new Date(call.startsAt.toLocaleString("en-US", { timeZone: "America/Chicago" })).toISOString().slice(0, 10);
  const days = call.flexible ? nextDays(30).filter((d) => d <= untilDay).slice(0, 21) : [];
  const day = call.flexible ? (sp.day && days.includes(sp.day) ? sp.day : days[0]) : null;
  const slots = call.flexible && day ? await openSlots(call.userId, call.durationMin, day) : [];
  const time = call.flexible && sp.time && slots.includes(sp.time) ? sp.time : null;
  return (
    <div className="scr">
      <TopBar title="Book a Model Call" back="/model-calls" />
      <div className="body">
        <div className="card">
          <div className="b">{call.serviceName} (Model Call)</div><div className="small muted">{pro.businessName}</div>
          <hr className="hr" />
          {call.flexible
            ? <div className="row small"><Icon name="cal" size="s" /> Open time — pick yours below (through {fmtDate(call.startsAt, { month: "short", day: "numeric" })})</div>
            : <div className="row small"><Icon name="cal" size="s" /> {fmtDate(call.startsAt, { weekday: "long", month: "long", day: "numeric" })} • {fmtTime(call.startsAt)}</div>}
          <div className="row small"><Icon name="clock" size="s" /> About {call.durationMin} minutes</div>
          {call.requirements && call.requirements.length > 0 && <div className="chips">{call.requirements.map((r) => <span key={r} className="tag">{r}</span>)}</div>}
        </div>
        {call.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={call.photoUrl} alt={`The look for this ${call.serviceName} model call`} style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 18 }} />
        )}
        {call.about && <div className="card" style={{ gap: 6 }}><span className="eyebrow">Additional information</span><p className="small p" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{call.about}</p></div>}
        {call.flexible && !full && (
          <div className="card" style={{ gap: 10 }}>
            <span className="eyebrow">Pick your time</span>
            <div className="row" style={{ gap: 6, overflowX: "auto" }}>
              {days.map((d) => <Link key={d} href={`/book/call/${call.id}?day=${d}`} className={`slot${d === day ? " on" : ""}`} style={{ flexDirection: "column", height: 60, minWidth: 64, gap: 0, textDecoration: "none" }}><span className="xs">{fmtDate(new Date(`${d}T12:00:00Z`), { weekday: "short" })}</span><span className="b">{Number(d.slice(8))}</span></Link>)}
            </div>
            {slots.length === 0 ? <span className="small muted">No open times this day — try another.</span> : (
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {slots.map((t) => <Link key={t} href={`/book/call/${call.id}?day=${day}&time=${t}`} className={`slot${t === time ? " on" : ""}`} style={{ textDecoration: "none" }}>{fmtTime(chicagoToUtc(day!, t))}</Link>)}
              </div>
            )}
          </div>
        )}
        {full ? (
          <div className="card bad small"><span>This model call is full or no longer open.</span></div>
        ) : (
          <>
            {call.priceCents > 0 && <PriceBox price={call.priceCents} deposit={deposit} pro={use.pro} general={use.general} charge={use.charge} />}
            <Terms deposit={deposit} cutoffHours={Number(s["cancel.cutoff_hours"])} graceMin={Number(s["appt.grace_minutes"])} />
            {call.flexible && !time ? <div className="card small"><span>Pick a day and time above to claim your spot.</span></div> : (
            <ActionForm action={bookModelCall} submitLabel={use.charge > 0 ? "Continue to payment" : "Claim my spot"}>
              <input type="hidden" name="modelCallId" value={call.id} />
              {call.flexible && <><input type="hidden" name="day" value={day!} /><input type="hidden" name="time" value={time!} /><span className="small b">{fmtDate(chicagoToUtc(day!, time!), { weekday: "long", month: "long", day: "numeric" })} • {fmtTime(chicagoToUtc(day!, time!))}</span></>}
              {!pro.addressLine && <WherePicker mode="travel" proCity="" travelFee={pro.travelFeeCents ?? 3500} />}
              <label className="check"><input type="checkbox" name="agree" required />I meet the requirements and agree to the booking terms</label>
            </ActionForm>
            )}
          </>
        )}
      </div>
    </div>
  );
}
