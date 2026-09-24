import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, bookings, professionalProfiles } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { bookingCode, confirmFromCheckout, expireStaleHolds } from "@/lib/bookings";
import { getSettings } from "@/lib/settings";
import { fmtDate, fmtTime, money } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { cancelMyBooking, releaseMyPayment, resumePayment } from "@/app/book-actions";

export const metadata = { title: "Appointment" };

export default async function Booking({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ session_id?: string; cancelled?: string; booked?: string }> }) {
  const { user } = await requireVerifiedStudent();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  // Coming back from Stripe: confirm right away (the webhook does the same in the background).
  if (sp.session_id) {
    try { await confirmFromCheckout(sp.session_id); } catch (e) { console.error(e); }
  }
  await expireStaleHolds();
  const row = (await db.select({ b: bookings, pro: professionalProfiles.businessName }).from(bookings)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, bookings.proId))
    .where(and(eq(bookings.id, id), eq(bookings.studentId, user.id))).limit(1))[0];
  if (!row) notFound();
  const { b, pro } = row;
  const s = await getSettings();
  const total = b.chargedCents + b.creditProCents + b.creditGeneralCents;
  const hoursAway = (b.startsAt.getTime() - Date.now()) / 3600000;
  const early = hoursAway >= Number(s["cancel.cutoff_hours"]);
  const started = hoursAway <= 0;
  const justBooked = (sp.session_id || sp.booked) && b.status === "confirmed";

  return (
    <div className="scr">
      <TopBar title="Appointment" back="/bookings" />
      <div className="body">
        {justBooked && (
          <div className="card ok" style={{ alignItems: "center", textAlign: "center", padding: 22 }}>
            <Icon name="check" size="xl" /><span className="disp h2">You&apos;re Booked</span><span className="small muted">Your payment is held until you release it.</span>
          </div>
        )}
        {sp.cancelled && b.status === "pending_payment" && <div className="card warn small"><span>Payment wasn&apos;t finished. Your time is held for a few more minutes.</span></div>}
        <div className="row"><span className={`tag ${b.status === "confirmed" ? "ok" : b.status.startsWith("cancelled") ? "bad" : ""}`}>{b.status.replace("_", " ")}</span><span className="xs muted">Booking #{bookingCode(b.number)}</span></div>
        <h1 className="disp h2">{b.serviceName} with {pro}</h1>
        <div className="card">
          <div className="row"><Icon name="cal" /><div className="grow"><div className="b">{fmtDate(b.startsAt, { weekday: "long", month: "long", day: "numeric" })}</div><div className="small muted">{fmtTime(b.startsAt)} – {fmtTime(b.endsAt)}</div></div></div>
          <hr className="hr" />
          <div className="row"><Icon name="lock" /><div className="grow"><div className="b">Address</div><div className="small muted">Unlocks at 12:00 AM on your appointment day (coming with appointment-day tools).</div></div></div>
        </div>
        <div className="card">
          <div className="row between"><span>Service</span><span className="num">{money(b.priceCents)}</span></div>
          {b.creditProCents + b.creditGeneralCents > 0 && <div className="row between small muted"><span>Paid with credit</span><span className="num">{money(b.creditProCents + b.creditGeneralCents)}</span></div>}
          <div className="row between small muted"><span>Paid by card</span><span className="num">{money(b.chargedCents)}</span></div>
          <div className="row between small muted"><span>{b.status === "completed" ? "Released to your professional" : "Held until you release it"}</span><Icon name={b.status === "completed" ? "check" : "lock"} size="s" /></div>
        </div>

        {b.status === "pending_payment" && (
          <form action={resumePayment}><input type="hidden" name="id" value={b.id} /><button className="btn" type="submit">Finish payment</button></form>
        )}

        {b.status === "confirmed" && started && (
          <div className="card">
            <span className="b">How did it go?</span>
            <span className="small muted">Release payment once your service is complete. Photos and reviews arrive with appointment-day tools.</span>
            <ActionForm action={releaseMyPayment} submitLabel={`Release ${money(total)}`}><input type="hidden" name="id" value={b.id} /></ActionForm>
          </div>
        )}

        {b.status === "confirmed" && !started && (
          <details className="card">
            <summary className="b" style={{ cursor: "pointer" }}>Cancel appointment</summary>
            <p className="small p" style={{ marginTop: 8 }}>
              {early
                ? `More than ${s["cancel.cutoff_hours"]} hours away: the full ${money(total)} becomes credit with ${pro}.`
                : `Inside ${s["cancel.cutoff_hours"]} hours: the ${money(b.depositCents)} deposit is forfeited, and the rest becomes credit with ${pro}.`}
            </p>
            <p className="xs muted p">No cash refunds. Credits never expire and can&apos;t be transferred or withdrawn.</p>
            <ActionForm action={cancelMyBooking} submitLabel="Cancel appointment" buttonClass="btn danger"><input type="hidden" name="id" value={b.id} /></ActionForm>
          </details>
        )}
      </div>
    </div>
  );
}
