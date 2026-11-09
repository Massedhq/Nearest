import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, cities } from "@/db";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { PriceBox, Terms } from "@/components/BookingTerms";
import { WherePicker } from "@/components/WherePicker";
import { Icon } from "@/components/Icon";
import { openSlots } from "@/lib/availability";
import { creditBalances } from "@/lib/credits";
import { planWithCard } from "@/lib/nearest-cards";
import { getSettings } from "@/lib/settings";
import { instantBooking } from "@/lib/instant-booking";
import { isAdult } from "@/lib/age";
import { chicagoToUtc, fmtDate, fmtTime, money } from "@/lib/time";
import { addonIds, pickAddons } from "@/lib/addons";
import { requirePartnerBooker } from "@/lib/customers";
import { bundleExtras, carry, partnerForBooking, partnerService } from "@/lib/partner-booking";
import { bookPartnerService } from "@/app/book-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review your appointment", robots: { index: false, follow: false } };

/** Partner side: review and pay. Not signed in → create a quick account (or sign in) first, then back here. */
export default async function PartnerConfirm({ params, searchParams }: { params: Promise<{ slug: string; serviceId: string }>; searchParams: Promise<{ day?: string; time?: string; a?: string | string[]; with?: string | string[] }> }) {
  const { slug, serviceId } = await params;
  const sp = await searchParams;
  const x = await partnerForBooking(slug);
  if (!x) notFound();
  const svc = await partnerService(x.pro.userId, serviceId);
  if (!svc) notFound();
  const day = sp.day ?? "", time = sp.time ?? "";
  const picked = pickAddons(svc, addonIds(sp.a));
  const extras = await bundleExtras(x.pro.userId, svc.id, sp.with);
  const q = carry(picked.list.map((a) => a.id), extras.map((e) => e.id));
  const here = `${x.base}/book/${svc.id}/confirm?day=${day}&time=${time}${q}`;
  const user = await requirePartnerBooker(x.r.p.slug!, here);
  const length = svc.durationMin + picked.minutes + extras.reduce((t, e) => t + e.extraMin, 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !(await openSlots(svc.userId, length, day)).includes(time)) redirect(`${x.base}/book/${svc.id}?day=${day}${q}`);
  if (svc.adultsOnly && !isAdult(user.dateOfBirth)) {
    return (
      <div className="scr"><div className="body" style={{ gap: 14 }}>
        <h1 className="disp h2">This service is 18+ only.</h1>
        <p className="small muted p">{svc.name} can only be booked by someone 18 or older. You can still book {x.name}&apos;s other services.</p>
        <a className="btn" href={`${x.base}/book`}>See their other services</a>
      </div></div>
    );
  }
  const list = [...extras, ...picked.list];
  const price = svc.priceCents + list.reduce((t, a) => t + a.priceCents, 0);
  const s = await getSettings();
  const deposit = Math.min(Number(s["appt.deposit_cents"]), price);
  const fee = svc.proPriceCents == null ? 0 : svc.serviceFeeCents;
  // Partner side: only the client's own credit from an earlier partner cancellation (no cards, invite rewards or promo credit).
  const bal = { ...(await creditBalances(user.id, x.pro.userId)), promo: 0 };
  const use = planWithCard(price, bal, 0, 0);
  const starts = chicagoToUtc(day, time);
  const city = x.pro.cityId ? await db.query.cities.findFirst({ where: eq(cities.id, x.pro.cityId) }) : null;
  const travels = x.pro.serviceMode === "travel" || x.pro.serviceMode === "both" || !x.pro.addressLine;
  return (
    <div className="scr">
      <TopBar title="Review your appointment" back={`${x.base}/book/${svc.id}?day=${day}${q}`} />
      <div className="body">
        <div className="card">
          <div className="b">{svc.name}</div><div className="small muted">{x.name}{x.pro.businessName && x.pro.businessName !== x.name ? ` • ${x.pro.businessName}` : ""}</div>
          {list.length > 0 && (
            <div className="col small" style={{ gap: 2, marginTop: 6 }}>
              <div className="row between"><span className="muted">{svc.name}</span><span>{money(svc.priceCents)}</span></div>
              {extras.map((e) => <div key={e.id} className="row between"><span className="muted">+ {e.name} ({e.extraMin} min, bundled)</span><span>{money(e.priceCents)}</span></div>)}
              {picked.list.map((a) => <div key={a.id} className="row between"><span className="muted">+ {a.name}{a.extraMin ? ` (+${a.extraMin} min)` : ""}</span><span>{money(a.priceCents)}</span></div>)}
            </div>
          )}
          <hr className="hr" />
          <div className="row small"><Icon name="cal" size="s" /> {fmtDate(starts, { weekday: "long", month: "long", day: "numeric" })} • {fmtTime(starts)}</div>
          <div className="row small"><Icon name="clock" size="s" /> {length} minutes</div>
          {!travels && <div className="row small top-a"><Icon name="pin" size="s" /><span>At {x.name}&apos;s place in {city?.name}. Address shared at 12:00 AM on your appointment day.</span></div>}
        </div>
        {travels && <div className="card small"><span>{x.pro.serviceMode === "both" && x.pro.addressLine ? `If they come to you, a ${money(x.pro.travelFeeCents ?? 3500)} travel fee is added to this price.` : `Includes a ${money(x.pro.travelFeeCents ?? 3500)} travel fee at checkout — ${x.name} comes to you.`}</span></div>}
        {instantBooking() ? (
          <div className="card small"><span><span className="b">Pay now and you&apos;re booked.</span> Your appointment is confirmed as soon as your payment goes through. Your payment is held until after your appointment.</span></div>
        ) : (
          <div className="card small"><span><span className="b">Nothing is charged now.</span> Your request goes to {x.name} to confirm. Once they accept, you&apos;ll pay to lock in your appointment.</span></div>
        )}
        <PriceBox price={price} fee={fee} deposit={deposit} pro={use.pro} general={use.general} charge={use.charge} />
        <Terms deposit={deposit} cutoffHours={Number(s["cancel.cutoff_hours"])} graceMin={Number(s["appt.grace_minutes"])} />
        <ActionForm action={bookPartnerService} submitLabel={instantBooking() ? "Pay and book" : "Send booking request"}>
          <input type="hidden" name="slug" value={x.r.p.slug!} />
          <input type="hidden" name="serviceId" value={svc.id} />
          <input type="hidden" name="day" value={day} />
          <input type="hidden" name="time" value={time} />
          {picked.list.map((a) => <input key={a.id} type="hidden" name="addon" value={a.id} />)}
          {extras.length > 0 && <input type="hidden" name="with" value={extras.map((e) => e.id).join(",")} />}
          {travels && <WherePicker mode={x.pro.serviceMode === "both" && x.pro.addressLine ? "both" : "travel"} proCity={city?.name ?? ""} travelFee={x.pro.travelFeeCents ?? 3500} />}
          <label className="check"><input type="checkbox" name="agree" required />I agree to the booking &amp; cancellation terms</label>
        </ActionForm>
      </div>
    </div>
  );
}
