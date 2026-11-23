import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, cities, modelCalls } from "@/db";
import { PartnerBookShell, PS } from "@/components/PartnerBookShell";
import { ActionForm } from "@/components/ActionForm";
import { PriceBox, Terms } from "@/components/BookingTerms";
import { WherePicker } from "@/components/WherePicker";
import { Icon } from "@/components/Icon";
import { openSlots } from "@/lib/availability";
import { creditBalances } from "@/lib/credits";
import { planWithCard } from "@/lib/nearest-cards";
import { getSettings } from "@/lib/settings";
import { instantBooking } from "@/lib/instant-booking";
import { chicagoToUtc, fmtDate, fmtTime, money } from "@/lib/time";
import { requirePartnerBooker } from "@/lib/customers";
import { partnerForBooking } from "@/lib/partner-booking";
import { callCharge, onSide } from "@/lib/model-calls";
import { bookPartnerModelCall } from "@/app/book-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Claim your spot", robots: { index: false, follow: false } };

/** Partner side: claim a public Model Call. Not signed in → the partner's quick 18+ sign-up (never a student account). */
export default async function PartnerModelCallConfirm({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ day?: string; time?: string }> }) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const x = await partnerForBooking(slug);
  if (!x || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const c = await db.query.modelCalls.findFirst({ where: and(eq(modelCalls.id, id), eq(modelCalls.userId, x.pro.userId)) });
  if (!c || !onSide(c, "partner")) notFound();
  const back = `${x.base}/model-calls/${c.id}`;
  if (c.status !== "open" || c.spotsTaken >= c.spots || c.startsAt.getTime() < Date.now()) redirect(back);
  const day = sp.day ?? "", time = sp.time ?? "";
  const here = `${back}/confirm${c.flexible ? `?day=${day}&time=${time}` : ""}`;
  const user = await requirePartnerBooker(x.r.p.slug!, here);
  if (c.flexible && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !(await openSlots(c.userId, c.durationMin, day)).includes(time))) redirect(`${back}?day=${day}`);
  const starts = c.flexible ? chicagoToUtc(day, time) : c.startsAt;
  const pay = callCharge(c, "partner");
  const s = await getSettings();
  const deposit = Math.min(Number(s["appt.deposit_cents"]), pay.onlineCents);
  const use = planWithCard(pay.onlineCents, { ...(await creditBalances(user.id, x.pro.userId)), promo: 0 }, 0, 0);
  const city = x.pro.cityId ? await db.query.cities.findFirst({ where: eq(cities.id, x.pro.cityId) }) : null;
  return (
    <PartnerBookShell name={x.name} photo={x.pro.photoUrl} back={back} step={3}>
      <h2 style={PS.h1}>Claim your spot</h2>
      <div className="col" style={{ gap: 12 }}>
        <div className="card">
          <div className="b">{c.serviceName} (Model Call)</div><div className="small muted">{x.name}</div>
          <hr className="hr" />
          <div className="row small"><Icon name="cal" size="s" /> {fmtDate(starts, { weekday: "long", month: "long", day: "numeric" })} • {fmtTime(starts)}</div>
          <div className="row small"><Icon name="clock" size="s" /> About {c.durationMin} minutes</div>
          {x.pro.addressLine && <div className="row small top-a"><Icon name="pin" size="s" /><span>At {x.name}&apos;s place{city ? ` in ${city.name}` : ""}. Address shared at 12:00 AM on your appointment day.</span></div>}
        </div>
        {pay.onlineCents > 0 && <PriceBox price={pay.onlineCents} fee={c.serviceFeeCents} deposit={deposit} pro={use.pro} general={use.general} charge={use.charge} balance={pay.balanceDueCents} balanceTo={x.name} />}
        <Terms deposit={deposit} cutoffHours={Number(s["cancel.cutoff_hours"])} graceMin={Number(s["appt.grace_minutes"])} />
        <ActionForm action={bookPartnerModelCall} submitLabel={instantBooking() ? "Pay and claim this spot" : "Send request for this spot"}>
          <input type="hidden" name="slug" value={x.r.p.slug!} />
          <input type="hidden" name="modelCallId" value={c.id} />
          {c.flexible && <><input type="hidden" name="day" value={day} /><input type="hidden" name="time" value={time} /></>}
          {!x.pro.addressLine && <WherePicker mode="travel" proCity={city?.name ?? ""} travelFee={x.pro.travelFeeCents ?? 3500} />}
          <label className="check"><input type="checkbox" name="agree" required />I meet the requirements and agree to the booking terms</label>
        </ActionForm>
      </div>
    </PartnerBookShell>
  );
}
