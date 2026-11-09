import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PartnerBookShell, PS, P_ACCENT } from "@/components/PartnerBookShell";
import { money } from "@/lib/time";
import { partnerForBooking, partnerServices, sidePrice } from "@/lib/partner-booking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book", robots: { index: false, follow: false } };

const mins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);

/** Partner side, step 1: pick a service (open to anyone, no $150 cap). Matches the Nearest Partner demo's booking look. */
export default async function PartnerBookList({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const x = await partnerForBooking(slug);
  if (!x) notFound();
  const services = await partnerServices(x.pro.userId);
  return (
    <PartnerBookShell name={x.name} photo={x.pro.photoUrl} back={x.base} step={1}>
      <h2 style={PS.h1}>Pick a service</h2>
      {services.length === 0 && <span style={PS.muted}>No services are listed yet.</span>}
      {services.map((s) => (
        <Link key={s.id} href={`${x.base}/book/${s.id}`} style={PS.tile}>
          {s.photoUrl ? <Image src={s.photoUrl} alt="" width={44} height={44} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flex: "none" }} /> : <span style={{ width: 44, height: 44, borderRadius: 8, background: "#1C1C1F", flex: "none" }} />}
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{s.name}{s.adultsOnly ? " (18+)" : ""}</span>
            <span style={{ fontSize: 12, opacity: 0.75 }}>{mins(s.durationMin)}{(s.addons ?? []).length ? " · add-ons" : ""}</span>
          </span>
          <b>{money(sidePrice(s))}</b>
        </Link>
      ))}
      <Link href={`${x.base}/bundle`} style={{ ...PS.tile, border: `1px solid ${P_ACCENT}` }}>
        <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>Bundle my booking</span>
          <span style={{ fontSize: 12, color: P_ACCENT, fontWeight: 800 }}>Several services, one visit</span>
        </span>
      </Link>
      <span style={PS.muted}>Anyone 18+ can book {x.name} here. You&apos;ll make a quick Nearest account (or sign in) before you pay — no school ID needed.</span>
    </PartnerBookShell>
  );
}
