import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, proServices, professionalProfiles } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { liveProWhere } from "@/lib/search";
import { openSlots } from "@/lib/availability";
import { creditBalances, applyCredits } from "@/lib/credits";
import { getSettings } from "@/lib/settings";
import { chicagoToUtc, fmtDate, fmtTime } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { PriceBox, Terms } from "@/components/BookingTerms";
import { Icon } from "@/components/Icon";
import { bookService } from "@/app/book-actions";

export const metadata = { title: "Review your appointment" };

export default async function Confirm({ params, searchParams }: { params: Promise<{ serviceId: string }>; searchParams: Promise<{ day?: string; time?: string }> }) {
  const { user } = await requireVerifiedStudent();
  const { serviceId } = await params;
  const { day = "", time = "" } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(serviceId)) notFound();
  const svc = await db.query.proServices.findFirst({ where: and(eq(proServices.id, serviceId), eq(proServices.active, true)) });
  if (!svc) notFound();
  const [pro] = await db.select().from(professionalProfiles).where(and(eq(professionalProfiles.userId, svc.userId), ...liveProWhere(null, "all"))).limit(1);
  if (!pro) notFound();
  if (!(await openSlots(svc.userId, svc.durationMin, day)).includes(time)) redirect(`/book/${svc.id}?day=${day}`);
  const s = await getSettings();
  const deposit = Math.min(Number(s["appt.deposit_cents"]), svc.priceCents);
  const use = applyCredits(svc.priceCents, await creditBalances(user.id, svc.userId));
  const starts = chicagoToUtc(day, time);
  return (
    <div className="scr">
      <TopBar title="Review your appointment" back={`/book/${svc.id}?day=${day}`} />
      <div className="body">
        <div className="card">
          <div className="b">{svc.name}</div><div className="small muted">{pro.businessName}</div>
          <hr className="hr" />
          <div className="row small"><Icon name="cal" size="s" /> {fmtDate(starts, { weekday: "long", month: "long", day: "numeric" })} • {fmtTime(starts)}</div>
          <div className="row small"><Icon name="clock" size="s" /> {svc.durationMin} minutes</div>
          <div className="row small top-a"><Icon name="pin" size="s" /><span>Address shared at 12:00 AM on your appointment day.</span></div>
        </div>
        <PriceBox price={svc.priceCents} deposit={deposit} pro={use.pro} general={use.general} charge={use.charge} />
        <Terms deposit={deposit} cutoffHours={Number(s["cancel.cutoff_hours"])} graceMin={Number(s["appt.grace_minutes"])} />
        <ActionForm action={bookService} submitLabel={use.charge > 0 ? "Continue to payment" : "Book with credit"}>
          <input type="hidden" name="serviceId" value={svc.id} />
          <input type="hidden" name="day" value={day} />
          <input type="hidden" name="time" value={time} />
          <label className="check"><input type="checkbox" name="agree" required />I agree to the booking &amp; cancellation terms</label>
        </ActionForm>
      </div>
    </div>
  );
}
