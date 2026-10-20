import Link from "next/link";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { ProCta } from "@/components/public/Cta";
import { pageMeta } from "@/lib/public/meta";

export const metadata = pageMeta(
  "How to Get More Clients — Tactics for Nail Techs, Stylists, Braiders, Barbers & More",
  "Specific client-building tactics for nail techs, hairstylists, braiders, barbers, lash techs, brow artists, makeup artists and wellness professionals.",
  "/get-more-clients",
);

const TRADES: { id: string; h: string; tips: string[]; guide?: [string, string] }[] = [
  { id: "nail-techs", h: "Nail techs", tips: ["Name sets the way clients search (shape, length, finish) in every caption.", "Offer a standing fill appointment every 2–3 weeks.", "Post one process clip per week — prep is what clients can't see elsewhere.", "Promote two named openings a week instead of discounting."], guide: ["nail-tech-30-day-content-calendar", "30-day nail content calendar"] },
  { id: "hairstylists", h: "Hairstylists", tips: ["Pick a signature service and lead with it everywhere.", "Show before-and-afters with hair type and length.", "Book model appointments for styles you want to be known for.", "Rebook trims and color touch-ups before clients leave."], guide: ["first-10-clients-new-hairstylist", "First 10 clients as a new stylist"] },
  { id: "braiders", h: "Braiders", tips: ["Price by size and length and say whether hair is included.", "Give honest time estimates — clients plan their day around them.", "Share how to protect edges and scalp; it builds trust.", "Book the takedown and next install at checkout."], guide: ["repeat-clients-braiding-locs", "Repeat clients for braiding and locs"] },
  { id: "barbers", h: "Barbers", tips: ["Consistent hours and on-time starts create regulars.", "Offer standing appointments every 2–3 weeks.", "Post fresh cuts with the style named (low taper, burst fade).", "Keep booking under a minute from your bio."] },
  { id: "lash-techs", h: "Lash techs", tips: ["Post week-two retention photos, not just fresh sets.", "Keep a waitlist for cancellations.", "Explain classic, hybrid and volume with photos.", "Use deposits and a clear refill window."], guide: ["more-lash-clients-without-discounting", "More lash clients without discounting"] },
  { id: "brow-artists", h: "Brow artists", tips: ["Show healed results alongside fresh ones.", "Explain maintenance timing for lamination, tint and shaping.", "Pair brows with lashes or makeup clients through referrals.", "Make consultation notes so returning clients get the same shape."] },
  { id: "makeup-artists", h: "Makeup artists", tips: ["Market ahead of event seasons — prom, homecoming, graduation, weddings.", "Show looks on different skin tones and in different light.", "List packages with timing, trials and travel details.", "Partner with photographers and hair stylists."], guide: ["student-clients-prom-homecoming-graduation", "Event-season marketing"] },
  { id: "wellness", h: "Massage, skincare and wellness professionals", tips: ["Explain what a first visit includes and how to prepare.", "Be clear about what's in and out of your scope.", "Offer a series or membership-style rebooking for ongoing care.", "Collect intake details (allergies, sensitivities) before the appointment."] },
];

export default function GetMoreClients() {
  return (
    <div className="pub-article">
      <Breadcrumbs items={[{ name: "Get more clients", href: "/get-more-clients" }]} />
      <p className="pub-eyebrow">Getting clients</p>
      <h1>How to get more clients, by profession</h1>
      <p className="pub-lede">The fundamentals are the same for every beauty business — be findable, make booking easy, deliver, rebook, ask for referrals. What changes is how clients in each specialty decide. Start with yours.</p>
      <nav className="pub-toc" aria-label="Professions"><ul>{TRADES.map((t) => <li key={t.id}><a href={`#${t.id}`}>{t.h}</a></li>)}</ul></nav>
      <h2>Before anything else</h2>
      <p>Make sure a stranger can find your prices, your area, your availability and one booking link in under a minute. If not, fix that first with the <Link href="/resources/improve-beauty-profile-booking-conversion">profile checklist</Link>.</p>
      {TRADES.map((t) => (
        <section key={t.id} id={t.id} aria-labelledby={`${t.id}-h`}>
          <h2 id={`${t.id}-h`}>{t.h}</h2>
          <ul>{t.tips.map((x) => <li key={x}>{x}</li>)}</ul>
          {t.guide && <p className="pub-more">Go deeper: <Link href={`/resources/${t.guide[0]}`}>{t.guide[1]}</Link></p>}
        </section>
      ))}
      <h2>Free channels that work for everyone</h2>
      <p>Referrals, a complete Google Business Profile and consistent results posts. The step-by-step plan is in <Link href="/resources/get-more-beauty-clients-without-ads">how to get more clients without paying for ads</Link>.</p>
      <ProCta />
    </div>
  );
}
