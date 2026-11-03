import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { ProCta, StudentCta } from "@/components/public/Cta";
import { activeCities, STATE_NAMES } from "@/lib/public/locations";
import { categoryBySlug, categorySeo, cityPros } from "@/lib/public/directory";
import { pageMeta } from "@/lib/public/meta";
import { money } from "@/lib/time";

export const revalidate = 3600;

/** "Nail Techs in Frisco, TX" — every live professional in that city offering that category, each linking to their page. */
async function find(state: string, city: string, cat: string) {
  const c = (await activeCities()).find((x) => x.stateSlug === state && x.slug === city);
  if (!c) return null;
  const category = categoryBySlug(cat, c.categories);
  if (!category) return null;
  const pros = await cityPros(c.id, category);
  return pros.length ? { c, category, seo: categorySeo(category), pros } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ state: string; city: string; category: string }> }) {
  const { state, city, category } = await params;
  const r = await find(state, city, category);
  if (!r) return { robots: { index: false } };
  const where = `${r.c.name}, ${r.c.state}`;
  const names = r.pros.slice(0, 3).map((p) => p.business).join(", ");
  return pageMeta(
    `${r.seo.plural} in ${where} — Book on Nearest`,
    `${r.pros.length} ${r.pros.length === 1 ? r.seo.singular.toLowerCase() : r.seo.plural.toLowerCase()} in ${where} on Nearest${names ? `, including ${names}` : ""}. See their work, services and prices, and book with a free student account.`,
    `/locations/${r.c.stateSlug}/${r.c.slug}/${r.seo.slug}`,
  );
}

export default async function CategoryCityPage({ params }: { params: Promise<{ state: string; city: string; category: string }> }) {
  const { state, city, category } = await params;
  const r = await find(state, city, category);
  if (!r) notFound();
  const { c, seo, pros } = r;
  const st = STATE_NAMES[c.state] ?? c.state;
  const others = c.categories.filter((x) => x !== r.category);
  return (
    <div className="pub-article">
      <Breadcrumbs items={[{ name: "Locations", href: "/locations" }, { name: `${c.name}, ${st}`, href: `/locations/${c.stateSlug}/${c.slug}` }, { name: seo.plural, href: `/locations/${c.stateSlug}/${c.slug}/${seo.slug}` }]} />
      <p className="pub-eyebrow">{c.county ? `${c.county} County, ${st}` : st}</p>
      <h1>{seo.plural} in {c.name}, {c.state}</h1>
      <p className="pub-lede">{pros.length === 1 ? `1 ${seo.singular.toLowerCase()}` : `${pros.length} ${seo.plural.toLowerCase()}`} in {c.name} you can book on Nearest. Every professional is verified, prices are shown upfront, and your payment is protected until your appointment is done.</p>

      <div className="pub-grid">
        {pros.map((p) => (
          <Link key={p.userId} className="pub-card" href={`/pro-${p.slug}`}>
            <span style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
              {p.photo
                ? <Image src={p.photo} alt={p.business} width={52} height={52} style={{ borderRadius: 26, objectFit: "cover", flex: "none" }} />
                : <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 26, background: "#1C1A16", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", color: "#E3C58A" }}>{p.business.slice(0, 2).toUpperCase()}</span>}
              <span style={{ display: "flex", flexDirection: "column" }}>
                <strong style={{ marginBottom: 0 }}>{p.business}</strong>
                <span>{seo.singular} in {c.name}{p.rating ? ` · ★ ${p.rating.toFixed(1)} (${p.reviews})` : ""}</span>
              </span>
            </span>
            <span style={{ display: "block" }}>{p.services.join(" · ")}</span>
            {p.fromCents != null && <span style={{ display: "block", marginTop: 6, color: "#E3C58A" }}>From {money(p.fromCents)}</span>}
          </Link>
        ))}
      </div>

      <h2>How booking works</h2>
      <ul>
        <li>Create a free student account and verify you&apos;re a student.</li>
        <li>Pick a {seo.singular.toLowerCase()}, a service and a time — they accept, then you pay to confirm.</li>
        <li>Your payment is held until you confirm your appointment is done. The address is shared on the appointment day only.</li>
      </ul>

      {others.length > 0 && (<>
        <h2>More in {c.name}</h2>
        <p>{others.map((x) => <Link key={x} className="pub-tag gold" href={`/locations/${c.stateSlug}/${c.slug}/${categorySeo(x).slug}`}>{categorySeo(x).plural}</Link>)}</p>
      </>)}
      <StudentCta title={`Book a ${seo.singular.toLowerCase()} in ${c.name}`} />
      <ProCta title={`Are you a ${seo.singular.toLowerCase()} in ${c.name}? Get listed`} />
    </div>
  );
}
