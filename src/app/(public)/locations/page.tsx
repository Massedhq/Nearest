import Link from "next/link";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { ProCta } from "@/components/public/Cta";
import { activeCities, PLANNED_MARKETS, STATE_NAMES } from "@/lib/public/locations";
import { pageMeta } from "@/lib/public/meta";

export const revalidate = 3600;
export const metadata = pageMeta(
  "Where Nearest Is Live — Locations",
  "Cities where students can book beauty and wellness professionals on Nearest right now, plus planned expansion. Updated from the platform.",
  "/locations",
);

export default async function Locations() {
  const list = await activeCities();
  const byState = new Map<string, typeof list>();
  for (const c of list) byState.set(c.state, [...(byState.get(c.state) ?? []), c]);
  return (
    <div className="pub-article">
      <Breadcrumbs items={[{ name: "Locations", href: "/locations" }]} />
      <h1>Where Nearest is live</h1>
      <p className="pub-lede">Students can book only in cities where at least one professional is live. This list updates from the platform as professionals join.</p>
      {list.length === 0 ? (
        <p className="pub-box">The city list is updating — please check back shortly. Nearest started in the Dallas–Fort Worth area of Texas.</p>
      ) : [...byState.entries()].map(([st, cities]) => (
        <section key={st} aria-labelledby={`st-${st}`}>
          <h2 id={`st-${st}`}>{STATE_NAMES[st] ?? st}</h2>
          <div className="pub-grid">
            {cities.map((c) => (
              <Link key={c.id} className="pub-card" href={`/locations/${c.stateSlug}/${c.slug}`}>
                <strong>{c.name}</strong>
                <span>{c.county ? `${c.county} County · ` : ""}{c.categories.length ? c.categories.slice(0, 5).join(", ") + (c.categories.length > 5 ? "…" : "") : "Professionals listed"}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
      <h2>Planned</h2>
      <ul>{PLANNED_MARKETS.map((m) => <li key={m.state}><strong>{m.state}</strong> — planned for {m.when}. Not live yet: students can&apos;t book there until launch.</li>)}</ul>
      <h2>Not seeing your city?</h2>
      <p>Nearest isn&apos;t available nationwide. If you&apos;re a professional in a city that isn&apos;t listed, see <Link href="/for-professionals">how joining works</Link> — city availability is limited and depends on location. Students can check back as new professionals join.</p>
      <ProCta />
    </div>
  );
}
