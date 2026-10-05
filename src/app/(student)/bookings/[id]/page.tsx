import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, bookings, professionalProfiles } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { bookingCode, confirmFromCheckout, expireStaleHolds } from "@/lib/bookings";
import { cancelBookingRequest } from "@/app/book-actions";
import { getSettings } from "@/lib/settings";
import { fmtDate, fmtTime, money } from "@/lib/time";
import { ShareProButton } from "@/components/ShareProButton";
import { ensureProSlug, proLink } from "@/lib/connections";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { cancelMyBooking, resumePayment, abandonBooking, payAcceptedBooking } from "@/app/book-actions";
import Link from "next/link";
import { addressUnlocked, checkinOpen, finishOpen } from "@/lib/appointment";
import { studentCheckIn } from "@/app/day-actions";
import { LocateForm } from "@/components/LocateButton";
import { RequiredPhoto } from "@/components/RequiredPhoto";

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
  const shareLink = proLink((await ensureProSlug(b.proId)) ?? b.proId);
  const s = await getSettings();
  const total = b.chargedCents + b.creditProCents + b.creditGeneralCents;
  const hoursAway = (b.startsAt.getTime() - Date.now()) / 3600000;
  const early = hoursAway >= Number(s["cancel.cutoff_hours"]);
  const started = hoursAway <= 0;
  void started;
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
        {b.status === "pending_payment" && (b.isRequest && b.respondedAt
          ? <div className="card ok small" style={{ gap: 4 }}><span className="b">Accepted! Complete payment to confirm.</span><span>{pro} accepted your request. Pay {money(b.chargedCents)}{b.holdExpiresAt ? ` by ${fmtDate(b.holdExpiresAt, { weekday: "short", month: "short", day: "numeric" })} at ${fmtTime(b.holdExpiresAt)}` : ""} to confirm your appointment — after that the time is released.</span></div>
          : <div className="card warn small"><span>Payment isn&apos;t finished, so this isn&apos;t booked yet and you haven&apos;t been charged. Finish paying to keep this time, or cancel to let it go.</span></div>)}
        {b.status === "requested" && (
          <div className="card warn" style={{ gap: 6 }}>
            <span className="b">Booking Request Sent</span>
            <span className="small">Your requested appointment has been sent to the professional for confirmation. Nothing is charged now — once they accept, you&apos;ll pay to confirm. We&apos;ll let you know as soon as they do.</span>
            <form action={cancelBookingRequest}><input type="hidden" name="id" value={b.id} /><button className="link xs" type="submit">Cancel this request</button></form>
          </div>
        )}
        {b.status === "expired" && b.isRequest && b.requestExpiresAt && <div className="card small"><span>The professional couldn&apos;t confirm this request in time, so it wasn&apos;t booked and you weren&apos;t charged.</span><Link className="btn sm" href="/home" style={{ alignSelf: "flex-start" }}>Back to Explore</Link></div>}
        {b.status === "cancelled_pro" && b.isRequest && <div className="card small"><span>This request wasn&apos;t confirmed, and you weren&apos;t charged.</span><Link className="btn sm" href="/home" style={{ alignSelf: "flex-start" }}>Find another time</Link></div>}
        {b.status === "expired" && !(b.isRequest && b.requestExpiresAt) && <div className="card small"><span>This wasn&apos;t booked — payment was never finished, and you weren&apos;t charged.</span><Link className="btn sm" href="/home" style={{ alignSelf: "flex-start" }}>Back to Explore</Link></div>}
        <div className="row"><span className={`tag ${b.status === "confirmed" ? "ok" : b.status.startsWith("cancelled") ? "bad" : b.status === "requested" ? "warn" : ""}`}>{b.status === "requested" ? "Pending professional approval" : b.status === "pending_payment" && b.isRequest && b.respondedAt ? "Accepted — pay to confirm" : b.status.replace("_", " ")}</span><span className="xs muted">Booking #{bookingCode(b.number)}</span></div>
        <div className="row between" style={{ gap: 10 }}>
          <h1 className="disp h2">{b.serviceName} with {pro}</h1>
          <ShareProButton proId={b.proId} proName={pro ?? "This professional"} link={shareLink} compact />
        </div>
        <div className="card">
          <div className="row"><Icon name="cal" /><div className="grow"><div className="b">{fmtDate(b.startsAt, { weekday: "long", month: "long", day: "numeric" })}</div><div className="small muted">{fmtTime(b.startsAt)} – {fmtTime(b.endsAt)}</div></div></div>
          <hr className="hr" />
          {addressUnlocked(b) || b.locationType === "student" ? (
            <div className="row top-a"><Icon name="pin" /><div className="grow"><div className="b">{b.locationType === "student" ? "At your place" : "Address"}</div><div className="small">{b.locationAddress ?? "Your professional will message you the address."}</div>
              {b.locationAddress && b.locationType === "pro" && <a className="link small" href={`https://maps.google.com/?q=${encodeURIComponent(b.locationAddress)}`} target="_blank" rel="noreferrer">Get directions</a>}</div></div>
          ) : (
            <div className="row"><Icon name="lock" /><div className="grow"><div className="b">Address locked</div><div className="small muted">Unlocks at 12:00 AM on your appointment day. Only you will see it.</div></div></div>
          )}
        </div>
        <div className="card">
          <div className="row between"><span>Service</span><span className="num">{money(b.priceCents)}</span></div>
          {b.creditProCents + b.creditGeneralCents > 0 && <div className="row between small muted"><span>Paid with credit</span><span className="num">{money(b.creditProCents + b.creditGeneralCents)}</span></div>}
          <div className="row between small muted"><span>Paid by card</span><span className="num">{money(b.chargedCents)}</span></div>
          <div className="row between small muted"><span>{b.status === "completed" ? "Released to your professional" : b.status === "requested" ? "Nothing charged yet — you pay after the professional accepts" : "Held until you release it"}</span><Icon name={b.status === "completed" ? "check" : "lock"} size="s" /></div>
        </div>

        {b.status === "pending_payment" && (
          <div className="col" style={{ gap: 10 }}>
            {b.isRequest && b.respondedAt
              ? <form action={payAcceptedBooking}><input type="hidden" name="id" value={b.id} /><button className="btn" type="submit" style={{ width: "100%" }}>Pay {money(b.chargedCents)} and confirm</button></form>
              : <form action={resumePayment}><input type="hidden" name="id" value={b.id} /><button className="btn" type="submit" style={{ width: "100%" }}>Finish payment</button></form>}
            <form action={abandonBooking}><input type="hidden" name="id" value={b.id} /><button className="btn ghost" type="submit" style={{ width: "100%" }}>Cancel — don&apos;t book</button></form>
            <Link className="link small" href="/home" style={{ textAlign: "center" }}>Back to Explore</Link>
          </div>
        )}

        {b.status === "confirmed" && (
          <Link className="btn ghost" href={`/bookings/${b.id}/messages`}><Icon name="msg" /> Message {pro}</Link>
        )}

        {b.status === "confirmed" && checkinOpen(b) && !b.checkedInAt && b.locationType === "pro" && (
          <div className="card" style={{ alignItems: "center", textAlign: "center", padding: 22 }}>
            <span className="disp h2">You&apos;re here?</span>
            <span className="small muted">Take your check-in photo, then check in. We&apos;ll confirm you&apos;re at the appointment location.</span>
            <LocateForm action={studentCheckIn} label="CHECK IN" big>
              <input type="hidden" name="id" value={b.id} />
              <RequiredPhoto userId={user.id} folder="checkin" name="checkinPhoto" label="Check-in photo" hint="A photo before your service starts. It protects you and your professional." />
            </LocateForm>
          </div>
        )}
        {b.checkedInAt && b.status === "confirmed" && !finishOpen(b) && (
          <div className="card ok"><div className="row"><Icon name="check" /><div className="grow"><div className="b">Checked in{b.checkinDistanceFt != null ? " — location confirmed" : ""}</div><div className="small muted">{fmtTime(b.checkedInAt)}{b.startedAt ? " • service in progress" : " • your professional has been notified"}</div></div></div></div>
        )}
        {b.status === "confirmed" && finishOpen(b) && (
          <Link className="btn" href={`/bookings/${b.id}/finish`}>Finish your appointment</Link>
        )}
        {b.status === "confirmed" && checkinOpen(b) && (
          <Link className="btn danger" href={`/bookings/${b.id}/problem`}><Icon name="flag" /> Report a problem</Link>
        )}
        {b.status === "no_show" && <div className="card bad small"><span className="b">Marked as a no-show</span><span className="muted">The deposit was forfeited; the rest became credit with {pro}.</span></div>}

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
