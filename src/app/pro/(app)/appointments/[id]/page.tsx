import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, bookings, users, studentProfiles, incidents, reviews } from "@/db";
import { requirePro } from "@/lib/pro";
import { addressUnlocked, noShowAllowedAt } from "@/lib/appointment";
import { bookingCode } from "@/lib/bookings";
import { fmtDate, fmtTime, money } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { ServiceTimer } from "@/components/ServiceTimer";
import { proStart, proFinish, proNoShow } from "@/app/day-actions";
import { proCancelBooking } from "@/app/pro/pay-actions";

export const metadata = { title: "Appointment" };
export const dynamic = "force-dynamic";

export default async function ProAppointment({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requirePro();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const row = (await db.select({ b: bookings, first: users.firstName, last: users.lastName, sp: studentProfiles }).from(bookings)
    .innerJoin(users, eq(users.id, bookings.studentId)).leftJoin(studentProfiles, eq(studentProfiles.userId, bookings.studentId))
    .where(and(eq(bookings.id, id), eq(bookings.proId, user.id))).limit(1))[0];
  if (!row) notFound();
  const { b, first, last, sp } = row;
  const complaint = await db.query.incidents.findFirst({ where: eq(incidents.bookingId, b.id) });
  const review = await db.query.reviews.findFirst({ where: eq(reviews.bookingId, b.id) });
  const student = { firstName: first, lastName: last };
  const noShowAt = await noShowAllowedAt(b);
  const canNoShow = b.status === "confirmed" && !b.checkedInAt && Date.now() >= noShowAt.getTime();
  const total = b.chargedCents + b.creditProCents + b.creditGeneralCents;
  const live = b.status === "confirmed";

  return (
    <div className="scr">
      <TopBar title={`${fmtTime(b.startsAt)} appointment`} back="/pro/appointments" />
      <div className="body">
        {b.checkedInAt && live && !b.startedAt && (
          <div className="card ok"><div className="row"><Icon name="check" /><div className="grow"><div className="b">Your client has checked in</div><div className="small muted">{fmtTime(b.checkedInAt)}{b.checkinDistanceFt != null ? ` • location confirmed (${b.checkinDistanceFt} ft)` : " • location not compared"}</div></div></div></div>
        )}
        {complaint && <div className="card bad small"><span className="b">The student reported a problem: {complaint.reason}</span><span className="muted">Nearest is reviewing it.</span></div>}

        <div className="card">
          <div className="row between"><span className="b">{b.serviceName}</span><span className="xs muted">#{bookingCode(b.number)}</span></div>
          <div className="small">{fmtDate(b.startsAt, { weekday: "long", month: "short", day: "numeric" })} • {fmtTime(b.startsAt)} – {fmtTime(b.endsAt)}</div>
          <hr className="hr" />
          <div className="row"><div className="avatar sm">{(first ?? "?")[0]}{(last ?? "")[0]}</div><div className="grow"><div className="b">{first} {last?.[0]}.</div><div className="xs badge"><Icon name="shield" size="s" /> Verified Student</div></div>
            <Link className="iconbtn" href={`/pro/appointments/${b.id}/messages`} aria-label="Message"><Icon name="msg" /></Link></div>
          {(sp?.prefersText || sp?.wantsAsl) && <div className="row small"><Icon name="hand" size="s" /><span className="muted">{[sp?.prefersText && "Prefers text communication", sp?.wantsAsl && "Looking for ASL"].filter(Boolean).join(" • ")}</span></div>}
          {b.locationType === "student" && (
            <div className="row small top-a"><Icon name="car" size="s" /><span>{addressUnlocked(b) ? <>You travel to: <span className="b">{b.locationAddress}</span></> : "You travel to the student. Their address unlocks at 12:00 AM on the appointment day."}</span></div>
          )}
          <hr className="hr" />
          <div className="row between"><span>Price</span><span className="b">{money(b.priceCents)}</span></div>
          <span className="xs muted">{b.status === "completed" ? "Released to you" : "Paid in full • held until the student releases it"}</span>
        </div>

        {live && !b.startedAt && <form action={proStart}><input type="hidden" name="id" value={b.id} /><button className="btn" type="submit">Start service</button></form>}
        {live && b.startedAt && !b.finishedAt && (
          <>
            <div className="card" style={{ alignItems: "center", gap: 10, padding: 22 }}>
              <span className="tag warn">Service in progress</span>
              <ServiceTimer startedAt={b.startedAt.toISOString()} />
              <span className="small muted">Started {fmtTime(b.startedAt)}</span>
            </div>
            <p className="xs muted p" style={{ textAlign: "center", margin: 0 }}>When you finish, we send {student?.firstName ?? "your client"} the completion steps. Only the customer can release payment.</p>
            <form action={proFinish}><input type="hidden" name="id" value={b.id} /><button className="btn" type="submit">Finish service &amp; send completion steps</button></form>
          </>
        )}
        {live && b.finishedAt && (
          <>
            <div className="card"><div className="row"><Icon name="send" /><div className="grow"><div className="b">Completion link sent</div><div className="small muted">{fmtTime(b.finishedAt)} • to {student?.firstName ?? "your client"}&apos;s Nearest app</div></div></div></div>
            <div className="card" style={{ gap: 0 }}>
              {[
                ["Service confirmed", b.serviceConfirmedAt ? fmtTime(b.serviceConfirmedAt) : null, Boolean(b.serviceConfirmedAt)],
                ["Photo submitted", b.photoUrl ? `Portfolio permission: ${b.photoForPortfolio ? "Yes" : "No"}` : null, Boolean(b.photoUrl)],
                ["Review", review ? `${"★".repeat(review.rating)}` : b.photoUrl ? "In progress" : null, Boolean(review)],
                ["Customer releases payment", b.releasedAt ? fmtTime(b.releasedAt) : null, Boolean(b.releasedAt)],
              ].map(([label, sub, done], i, arr) => {
                const current = !done && (i === 0 || arr[i - 1][2]);
                return (
                  <div key={label as string} className="row top-a" style={{ gap: 12, padding: "8px 0" }}>
                    <span aria-hidden="true" style={{ width: 14, height: 14, marginTop: 3, borderRadius: 7, flex: "none", background: done ? "#ECE8E1" : current ? "#E3C58A" : "transparent", border: done || current ? "none" : "1.5px solid #6E6A63" }} />
                    <div className="col g4"><span className={done || current ? "b small" : "small"}>{label as string}</span>{sub && <span className="xs muted">{sub as string}</span>}</div>
                  </div>
                );
              })}
            </div>
            <div className="card"><div className="row between"><span>When released</span><span className="b">{money(Math.max(0, b.priceCents - (b.stripeFeeCents ?? 0)))} → Available</span></div></div>
            <p className="xs muted p" style={{ margin: 0 }}>If the customer leaves without finishing, Nearest applies its completion policy automatically.</p>
          </>
        )}
        {b.status === "completed" && <div className="card ok small"><span className="b">Completed — payment released.</span></div>}
        {b.status === "no_show" && <div className="card small"><span className="b">Marked as a no-show.</span></div>}

        {live && !b.checkedInAt && (
          <div className="card small">
            <div className="row"><Icon name="clock" size="s" /><span className="grow">No-show option unlocks after the grace period{canNoShow ? "" : ` (${fmtTime(noShowAt)})`}.</span></div>
            {canNoShow && <ActionForm action={proNoShow} submitLabel="Mark customer no-show" buttonClass="btn danger sm"><input type="hidden" name="id" value={b.id} /></ActionForm>}
          </div>
        )}
        {live && b.startsAt.getTime() > Date.now() && (
          <details><summary className="link small" style={{ cursor: "pointer" }}>Cancel appointment</summary>
            <p className="xs muted p" style={{ margin: "8px 0" }}>The student gets the full amount back as Nearest credit, and it counts toward your cancellation rate.</p>
            <ActionForm action={proCancelBooking} submitLabel="Cancel appointment" buttonClass="btn danger sm"><input type="hidden" name="id" value={b.id} /></ActionForm>
          </details>
        )}
      </div>
    </div>
  );
}
