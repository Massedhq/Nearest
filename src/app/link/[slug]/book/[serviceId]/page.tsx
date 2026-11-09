import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { AddonPicker } from "@/components/AddonPicker";
import { openSlots, nextDays } from "@/lib/availability";
import { getFlag } from "@/lib/settings";
import { label12, money } from "@/lib/time";
import { addonIds, pickAddons } from "@/lib/addons";
import { NO_CAP, bundleExtras, carry, partnerForBooking, partnerService, sidePrice } from "@/lib/partner-booking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose a time", robots: { index: false, follow: false } };

/** Partner side: pick a day and time for one service (plus add-ons or bundled services). Anyone can look; sign-in comes at the next step. */
export default async function PartnerChooseTime({ params, searchParams }: { params: Promise<{ slug: string; serviceId: string }>; searchParams: Promise<{ day?: string; a?: string | string[]; with?: string | string[] }> }) {
  const { slug, serviceId } = await params;
  const sp = await searchParams;
  const x = await partnerForBooking(slug);
  if (!x) notFound();
  const svc = await partnerService(x.pro.userId, serviceId);
  if (!svc) notFound();
  const picked = pickAddons(svc, addonIds(sp.a));
  const extras = await bundleExtras(x.pro.userId, svc.id, sp.with);
  const q = carry(picked.list.map((a) => a.id), extras.map((e) => e.id));
  const length = svc.durationMin + picked.minutes + extras.reduce((t, e) => t + e.extraMin, 0);
  const total = sidePrice(svc) + picked.cents + extras.reduce((t, e) => t + e.priceCents, 0);
  const open = await getFlag("status.bookings");
  const days = nextDays(14);
  const day = days.includes(sp.day ?? "") ? sp.day! : days[0];
  const slots = open && day ? await openSlots(svc.userId, length, day) : [];
  const d = (s: string) => new Date(`${s}T12:00:00Z`);
  return (
    <div className="scr">
      <TopBar title="Choose your appointment" back={`${x.base}/book`} />
      <div className="body">
        <div className="card" style={{ gap: 6 }}>
          <div className="row between"><div><div className="b">{svc.name}{svc.adultsOnly ? " (18+)" : ""}</div><div className="small muted">{x.name} • {length} min</div></div><span className="b">{money(total)}</span></div>
          {extras.length > 0 && <span className="xs muted">Bundled: {extras.map((e) => `${e.name} ${money(e.priceCents)}`).join(" + ")} — one visit, back to back.</span>}
          {picked.list.length > 0 && <span className="xs muted">Add-ons: {picked.list.map((a) => `${a.name} ${money(a.priceCents)}`).join(" + ")}</span>}
          {extras.length > 0 && <Link className="link xs" href={`${x.base}/bundle?${[svc.id, ...extras.map((e) => e.id)].map((id) => `s=${id}`).join("&")}`}>Change bundled services</Link>}
        </div>
        {(svc.addons ?? []).length > 0 && (
          <AddonPicker action={`${x.base}/book/${svc.id}`} addons={svc.addons} chosen={picked.list.map((a) => a.id)} baseCents={sidePrice(svc)} capCents={NO_CAP}
            hidden={{ ...(day ? { day } : {}), ...(extras.length ? { with: extras.map((e) => e.id).join(",") } : {}) }} />
        )}
        {!open && <div className="card warn small"><span>Booking is paused right now. Please check back soon.</span></div>}
        <div className="scrollx" style={{ marginRight: 0, overflowX: "auto" }}>
          {days.map((v) => (
            <Link key={v} scroll={false} href={`${x.base}/book/${svc.id}?day=${v}${q}`} className={`slot${v === day ? " on" : ""}`} style={{ flexDirection: "column", height: 64, gap: 0, minWidth: 58, textDecoration: "none" }}>
              <span className="xs">{d(v).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</span>
              <span style={{ fontSize: 18 }}>{d(v).getUTCDate()}</span>
            </Link>
          ))}
        </div>
        {day && <p className="disp" style={{ fontSize: 20, margin: 0 }}>{d(day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}</p>}
        {slots.length ? (
          <div className="grid3">
            {slots.map((t) => <Link key={t} className="slot" href={`${x.base}/book/${svc.id}/confirm?day=${day}&time=${t}${q}`} style={{ textDecoration: "none" }}>{label12(t)}</Link>)}
          </div>
        ) : (
          open && <p className="small muted p">No open times this day. Try another date.</p>
        )}
        <div className="card small"><div className="row top-a"><Icon name="clock" /><span className="grow muted">Only times you can actually book are shown. Bookings need 24 hours&apos; notice unless {x.name} has opened same-day times.</span></div></div>
      </div>
    </div>
  );
}
