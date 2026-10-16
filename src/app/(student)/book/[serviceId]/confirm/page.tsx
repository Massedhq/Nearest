import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, proServices, professionalProfiles } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { isAdult } from "@/lib/age";
import { liveProWhere } from "@/lib/search";
import { openSlots } from "@/lib/availability";
import { creditBalances, applyCredits } from "@/lib/credits";
import { getSettings } from "@/lib/settings";
import { chicagoToUtc, fmtDate, fmtTime, money } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { PriceBox, Terms } from "@/components/BookingTerms";
import { inviteRewardFor } from "@/lib/student-invites";
import { Icon } from "@/components/Icon";
import { bookService } from "@/app/book-actions";
import { WherePicker } from "@/components/WherePicker";
import { cities } from "@/db";
import { addonIds, pickAddons } from "@/lib/addons";

export const metadata = { title: "Review your appointment" };

export default async function Confirm({ params, searchParams }: { params: Promise<{ serviceId: string }>; searchParams: Promise<{ day?: string; time?: string; bundle?: string; a?: string | string[] }> }) {
  const { user } = await requireVerifiedStudent();
  const { serviceId } = await params;
  const { day = "", time = "", bundle: bundleItemId, a } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(serviceId)) notFound();
  const svc = await db.query.proServices.findFirst({ where: and(eq(proServices.id, serviceId), eq(proServices.active, true)) });
  if (!svc) notFound();
  if (svc?.adultsOnly && !isAdult(user.dateOfBirth)) {
    return (
      <div className="scr"><div className="body" style={{ gap: 14 }}>
        <h1 className="disp h2">This service is 18+ only.</h1>
        <p className="small muted p">{svc.name} can only be booked by students who are 18 or older. You can still book this professional&apos;s other services.</p>
        <a className="btn" href={`/p/${svc.userId}#services`}>See their other services</a>
      </div></div>
    );
  }
  const [pro] = await db.select().from(professionalProfiles).where(and(eq(professionalProfiles.userId, svc.userId), ...liveProWhere(null, "all"))).limit(1);
  if (!pro) notFound();
  // Bundle booking: only inside the bundle's week, and no credits or invite rewards.
  const bundleItem = bundleItemId ? await (await import("@/lib/bundles")).bundleItemFor(bundleItemId, user.id, svc.id) : null;
  // Add-ons: their price is added to the service and their time to the appointment ($150 limit on the total).
  const picked = pickAddons(svc, addonIds(a));
  const aq = picked.list.length ? `&a=${picked.list.map((x) => x.id).join(",")}` : "";
  const q = (bundleItem ? `&bundle=${bundleItemId}` : "") + aq;
  if (bundleItem && !bundleItem.days.includes(day)) redirect(`/book/${svc.id}?bundle=${bundleItemId}${aq}`);
  if (picked.overCap) redirect(`/book/${svc.id}?day=${day}${bundleItem ? `&bundle=${bundleItemId}` : ""}`);
  const length = svc.durationMin + picked.minutes;
  if (!(await openSlots(svc.userId, length, day)).includes(time)) redirect(`/book/${svc.id}?day=${day}${q}`);
  const price = svc.priceCents + picked.cents;
  const s = await getSettings();
  const deposit = Math.min(Number(s["appt.deposit_cents"]), price);
  const inv = bundleItem ? null : await inviteRewardFor(user.id, svc.userId, price); // $5 off a first booking with this pro
  const use = bundleItem
    ? { pro: 0, general: 0, charge: price } // credits can't be used on bundle bookings
    : applyCredits(price - (inv?.cents ?? 0), await creditBalances(user.id, svc.userId));
  const starts = chicagoToUtc(day, time);
  const city = pro.cityId ? await db.query.cities.findFirst({ where: eq(cities.id, pro.cityId) }) : null;
  const travels = pro.serviceMode === "travel" || pro.serviceMode === "both" || !pro.addressLine;
  return (
    <div className="scr">
      <TopBar title="Review your appointment" back={`/book/${svc.id}?day=${day}${q}`} />
      <div className="body">
        <div className="card">
          <div className="b">{svc.name}</div><div className="small muted">{pro.businessName}</div>
          {picked.list.length > 0 && (
            <div className="col small" style={{ gap: 2, marginTop: 6 }}>
              <div className="row between"><span className="muted">{svc.name}</span><span>{money(svc.priceCents)}</span></div>
              {picked.list.map((x) => <div key={x.id} className="row between"><span className="muted">+ {x.name}{x.extraMin ? ` (+${x.extraMin} min)` : ""}</span><span>{money(x.priceCents)}</span></div>)}
            </div>
          )}
          <hr className="hr" />
          <div className="row small"><Icon name="cal" size="s" /> {fmtDate(starts, { weekday: "long", month: "long", day: "numeric" })} • {fmtTime(starts)}</div>
          <div className="row small"><Icon name="clock" size="s" /> {length} minutes</div>
          {!travels && <div className="row small top-a"><Icon name="pin" size="s" /><span>At the professional&apos;s place in {city?.name}. Address shared at 12:00 AM on your appointment day.</span></div>}
        </div>
        {travels && <div className="card small"><span>{pro.serviceMode === "both" && pro.addressLine ? `If they come to you, a ${money(pro.travelFeeCents ?? 3500)} travel fee is added to this price.` : `Includes a ${money(pro.travelFeeCents ?? 3500)} travel fee at checkout — your professional comes to you.`}</span></div>}
        {bundleItem && <div className="card small"><span><span className="b">Bundle booking.</span> Credits and invite rewards can&apos;t be used on bundle bookings — they stay in your account for single bookings.</span></div>}
        <div className="card small"><span><span className="b">Nothing is charged now.</span> Your request goes to the professional to confirm. Once they accept, you&apos;ll pay to lock in your appointment.</span></div>
        <PriceBox price={price} deposit={deposit} pro={use.pro} general={use.general} charge={use.charge} invite={inv?.cents ?? 0} />
        <Terms deposit={deposit} cutoffHours={Number(s["cancel.cutoff_hours"])} graceMin={Number(s["appt.grace_minutes"])} />
        <ActionForm action={bookService} submitLabel="Send booking request">
          <input type="hidden" name="serviceId" value={svc.id} />
          <input type="hidden" name="day" value={day} />
          <input type="hidden" name="time" value={time} />
          {picked.list.map((x) => <input key={x.id} type="hidden" name="addon" value={x.id} />)}
          {bundleItem && <input type="hidden" name="bundleItem" value={bundleItem.item.id} />}
          {travels && <WherePicker mode={pro.serviceMode === "both" && pro.addressLine ? "both" : "travel"} proCity={city?.name ?? ""} travelFee={pro.travelFeeCents ?? 3500} />}
          <label className="check"><input type="checkbox" name="agree" required />I agree to the booking &amp; cancellation terms</label>
        </ActionForm>
      </div>
    </div>
  );
}
