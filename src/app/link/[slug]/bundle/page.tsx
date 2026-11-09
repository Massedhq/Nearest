import { notFound, redirect } from "next/navigation";
import { PartnerBookShell, PS, P_ACCENT } from "@/components/PartnerBookShell";
import { money } from "@/lib/time";
import { BUNDLE_MAX, partnerForBooking, partnerServices, sidePrice } from "@/lib/partner-booking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bundle my booking", robots: { index: false, follow: false } };

const mins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);

/**
 * Partner side "Bundle my booking": pick several of THIS partner's own services for one visit (never other professionals).
 * The first one picked is the main service; the rest are added at the professional's own price, so there's one booking fee.
 */
export default async function PartnerBundle({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ s?: string | string[] }> }) {
  const { slug } = await params;
  const x = await partnerForBooking(slug);
  if (!x) notFound();
  const services = await partnerServices(x.pro.userId);
  const raw = (await searchParams).s;
  const picked = [...new Set(Array.isArray(raw) ? raw : raw ? [raw] : [])].filter((id) => services.some((s) => s.id === id)).slice(0, BUNDLE_MAX);
  if (picked.length >= 2) redirect(`${x.base}/book/${picked[0]}?with=${picked.slice(1).join(",")}`);
  return (
    <PartnerBookShell name={x.name} photo={x.pro.photoUrl} back={x.base}>
      <h2 style={PS.h1}>Bundle my booking</h2>
      <span style={{ fontSize: 14, color: "#D9D4CA", lineHeight: 1.5 }}>Getting ready for an event? Pick 2 to {BUNDLE_MAX} of {x.name}&apos;s services and book them in one visit, back to back — one booking fee for the visit.</span>
      {raw && picked.length < 2 && <span role="alert" style={{ fontSize: 13, color: "#F2A99A", fontWeight: 700 }}>Pick at least 2 services to bundle.</span>}
      <span style={PS.eyebrow}>What do you need?</span>
      <form method="get" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {services.map((s) => (
          <label key={s.id} style={{ ...PS.tile, cursor: "pointer" }}>
            <input type="checkbox" name="s" value={s.id} defaultChecked={picked.includes(s.id)} style={{ width: 20, height: 20, accentColor: P_ACCENT, flex: "none" }} />
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 14, fontWeight: 800 }}>{s.name}{s.adultsOnly ? " (18+)" : ""}</span><span style={{ fontSize: 12, opacity: 0.75 }}>{mins(s.durationMin)}</span></span>
            <b>{money(sidePrice(s))}</b>
          </label>
        ))}
        <button type="submit" style={PS.btn}>Choose a time</button>
      </form>
      <span style={PS.muted}>Only {x.name}&apos;s own services — never anyone else&apos;s. Added services are at {x.name}&apos;s own price.</span>
    </PartnerBookShell>
  );
}
