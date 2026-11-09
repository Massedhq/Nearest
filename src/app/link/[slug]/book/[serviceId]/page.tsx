import Link from "next/link";
import { notFound } from "next/navigation";
import { PartnerBookShell, PS, P_GOLD } from "@/components/PartnerBookShell";
import { AddonPicker } from "@/components/AddonPicker";
import { openSlots, nextDays } from "@/lib/availability";
import { getFlag } from "@/lib/settings";
import { label12, money } from "@/lib/time";
import { addonIds, pickAddons } from "@/lib/addons";
import { NO_CAP, bundleExtras, carry, partnerForBooking, partnerService, sidePrice } from "@/lib/partner-booking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose a time", robots: { index: false, follow: false } };

/** Partner side, step 2: pick a day and time (plus add-ons or bundled services). Anyone can look; sign-in comes at review. */
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
    <PartnerBookShell name={x.name} photo={x.pro.photoUrl} back={extras.length ? `${x.base}/bundle` : `${x.base}/book`} step={2}>
      <h2 style={PS.h1}>Pick a day &amp; time</h2>
      <div style={PS.card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><b style={{ fontSize: 14 }}>{svc.name}{svc.adultsOnly ? " (18+)" : ""}</b><b>{money(total)}</b></div>
        <span style={PS.muted}>{length} min{extras.length ? ` · bundled: ${extras.map((e) => e.name).join(" + ")}` : ""}{picked.list.length ? ` · add-ons: ${picked.list.map((a) => a.name).join(" + ")}` : ""}</span>
        {extras.length > 0 && <Link href={`${x.base}/bundle?${[svc.id, ...extras.map((e) => e.id)].map((id) => `s=${id}`).join("&")}`} style={{ fontSize: 12, color: P_GOLD, fontWeight: 700 }}>Change bundled services</Link>}
      </div>
      {(svc.addons ?? []).length > 0 && (
        <AddonPicker action={`${x.base}/book/${svc.id}`} addons={svc.addons} chosen={picked.list.map((a) => a.id)} baseCents={sidePrice(svc)} capCents={NO_CAP}
          hidden={{ ...(day ? { day } : {}), ...(extras.length ? { with: extras.map((e) => e.id).join(",") } : {}) }} />
      )}
      {!open && <div style={{ ...PS.card, borderColor: "#7A5A2E" }}><span style={{ fontSize: 13 }}>Booking is paused right now. Please check back soon.</span></div>}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
        {days.map((v) => (
          <Link key={v} scroll={false} href={`${x.base}/book/${svc.id}?day=${v}${q}`} style={{ ...PS.choice(v === day), minWidth: 58, flex: "none" }}>
            <span style={{ fontSize: 11 }}>{d(v).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</span>
            <span style={{ fontSize: 18 }}>{d(v).getUTCDate()}</span>
          </Link>
        ))}
      </div>
      {day && <span style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 20 }}>{d(day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}</span>}
      {slots.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
          {slots.map((t) => <Link key={t} href={`${x.base}/book/${svc.id}/confirm?day=${day}&time=${t}${q}`} style={PS.choice(false)}>{label12(t)}</Link>)}
        </div>
      ) : (
        open && <span style={PS.muted}>No open times this day. Try another date.</span>
      )}
      <span style={PS.muted}>Only times {x.name} is actually open show here — their hours, breaks and other bookings are already taken out.</span>
    </PartnerBookShell>
  );
}
