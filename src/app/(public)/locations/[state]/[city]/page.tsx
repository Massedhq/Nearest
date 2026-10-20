import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { ProCta, StudentCta } from "@/components/public/Cta";
import { activeCities, cityOpenings, STATE_NAMES } from "@/lib/public/locations";
import { publicFacts, usd } from "@/lib/public/facts";
import { pageMeta } from "@/lib/public/meta";

export const revalidate = 3600;
// Rendered on first visit, then cached for an hour; only cities with a live professional resolve (others 404).

async function find(state: string, city: string) {
  return (await activeCities()).find((c) => c.stateSlug === state && c.slug === city) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ state: string; city: string }> }) {
  const { state, city } = await params;
  const c = await find(state, city);
  if (!c) return { robots: { index: false } };
  const st = STATE_NAMES[c.state] ?? c.state;
  return pageMeta(`Student Beauty Services in ${c.name}, ${st} — Nearest`, `Book ${c.categories.slice(0, 3).join(", ").toLowerCase() || "beauty and wellness"} appointments with independent professionals in ${c.name}, ${st} on Nearest. What's live and how booking works.`, `/locations/${c.stateSlug}/${c.slug}`);
}

const LABEL = { first_in: "First In spots open", open: "Spots open", full: "Full — waitlist" } as const;

export default async function CityPage({ params }: { params: Promise<{ state: string; city: string }> }) {
  const { state, city } = await params;
  const c = await find(state, city);
  if (!c) notFound();
  const [all, openings, f] = await Promise.all([activeCities(), cityOpenings(c.id), publicFacts()]);
  const st = STATE_NAMES[c.state] ?? c.state;
  const nearby = all.filter((x) => x.id !== c.id && (x.county === c.county || (c.market && x.market === c.market))).slice(0, 8);
  return (
    <div className="pub-article">
      <Breadcrumbs items={[{ name: "Locations", href: "/locations" }, { name: `${c.name}, ${st}`, href: `/locations/${c.stateSlug}/${c.slug}` }]} />
      <p className="pub-eyebrow">{c.county ? `${c.county} County, ${st}` : st}</p>
      <h1>Student beauty and wellness services in {c.name}</h1>
      <p className="pub-lede">Nearest is live in {c.name}: verified students can book independent professionals here. Availability changes as professionals join, pause or go offline.</p>

      <h2>Services listed in {c.name}</h2>
      {c.categories.length ? <p>{c.categories.map((x) => <span key={x} className="pub-tag ok">{x}</span>)}</p> : <p>Professionals are listed here; sign in to see services.</p>}
      <p>Prices are set by each professional, with every service up to {usd(f.capDollars)} for students including add-ons. Sign in to see individual professionals, their work, prices and open times.</p>

      <h2>Booking in {c.name}</h2>
      <ul>
        <li>Standard bookings need at least {f.advanceHours} hours&apos; notice; same-day appointments are only for openings a professional posts, until {f.sameDayCutoff} Central.</li>
        <li>You request, the professional accepts, then you pay to confirm.</li>
        <li>The address is shared on the appointment day only. Times are Central.</li>
      </ul>
      <p className="pub-more"><Link href="/student-beauty-services#how-booking-works">How booking works, step by step</Link></p>

      <h2>For professionals in {c.name}</h2>
      <p>Each category has a limited number of spots in {c.name}. Current status:</p>
      {openings.length ? (
        <div className="pub-table-wrap"><table>
          <thead><tr><th scope="col">Category</th><th scope="col">Status</th></tr></thead>
          <tbody>{openings.map((o) => <tr key={o.name}><th scope="row">{o.name}</th><td>{LABEL[o.status]}</td></tr>)}</tbody>
        </table></div>
      ) : <p>See <Link href="/for-professionals#capacity">how city capacity works</Link>.</p>}

      {nearby.length > 0 && (<>
        <h2>Nearby cities on Nearest</h2>
        <ul>{nearby.map((n) => <li key={n.id}><Link href={`/locations/${n.stateSlug}/${n.slug}`}>{n.name}</Link></li>)}</ul>
      </>)}
      <StudentCta title={`Book in ${c.name}`} />
      <ProCta title={`Work in ${c.name}? List your services`} />
    </div>
  );
}
