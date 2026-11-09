import { notFound, redirect } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { money } from "@/lib/time";
import { BUNDLE_MAX, partnerForBooking, partnerServices, sidePrice } from "@/lib/partner-booking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bundle my booking", robots: { index: false, follow: false } };

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
    <div className="scr">
      <TopBar title="Bundle my booking" back={x.base} />
      <div className="body">
        <div className="card small"><span><span className="b">Several services, one visit with {x.name}.</span> Tick 2 to {BUNDLE_MAX} services and pick one time — they&apos;re done back to back. Added services are at {x.name}&apos;s own price, with one booking fee for the visit.</span></div>
        {raw && picked.length < 2 && <p className="err">Pick at least 2 services to bundle.</p>}
        <form method="get" className="col" style={{ gap: 8 }}>
          {services.map((s) => (
            <label key={s.id} className="check card" style={{ flexDirection: "row", gap: 10 }}>
              <input type="checkbox" name="s" value={s.id} defaultChecked={picked.includes(s.id)} />
              <span className="grow"><span className="b">{s.name}{s.adultsOnly ? " (18+)" : ""}</span><span className="xs muted"> • {s.durationMin} min</span></span>
              <span className="b">{money(sidePrice(s))}</span>
            </label>
          ))}
          <button className="btn" type="submit">Choose a time</button>
        </form>
      </div>
    </div>
  );
}
