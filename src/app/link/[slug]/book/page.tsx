import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { money } from "@/lib/time";
import { partnerForBooking, partnerServices, sidePrice } from "@/lib/partner-booking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book", robots: { index: false, follow: false } };

/** Partner side: everything this partner offers, open to anyone (no $150 cap). Each service books straight away. */
export default async function PartnerBookList({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const x = await partnerForBooking(slug);
  if (!x) notFound();
  const services = await partnerServices(x.pro.userId);
  return (
    <div className="scr">
      <TopBar title={`Book ${x.name}`} back={x.base} />
      <div className="body">
        <div className="card row" style={{ gap: 12 }}>
          {x.pro.photoUrl ? <Image src={x.pro.photoUrl} alt={x.name} width={56} height={56} style={{ borderRadius: 28, objectFit: "cover" }} /> : null}
          <div className="col g4"><span className="b">{x.name}</span>{x.pro.businessName && x.pro.businessName !== x.name && <span className="small muted">{x.pro.businessName}</span>}</div>
        </div>
        <Link className="card" href={`${x.base}/bundle`} style={{ textDecoration: "none", color: "inherit", gap: 4 }}>
          <span className="b">Bundle my booking</span>
          <span className="small muted">Book several of {x.name}&apos;s services in one visit.</span>
        </Link>
        <h3 className="eyebrow p">Services</h3>
        {services.length === 0 && <p className="small muted p">No services are listed yet.</p>}
        {services.map((s) => (
          <Link key={s.id} className="card" href={`${x.base}/book/${s.id}`} style={{ textDecoration: "none", color: "inherit", gap: 4 }}>
            <div className="row between"><span className="b">{s.name}{s.adultsOnly ? " (18+)" : ""}</span><span className="b">{money(sidePrice(s))}</span></div>
            <div className="row between small"><span className="muted">{s.durationMin} min{(s.addons ?? []).length ? " • add-ons available" : ""}</span><span className="link small">Book</span></div>
          </Link>
        ))}
        <p className="xs muted p">Booked and paid securely on Nearest. You&apos;ll create a quick account (or sign in) before you pay.</p>
      </div>
    </div>
  );
}
