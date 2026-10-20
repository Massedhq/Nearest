import Link from "next/link";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { ProCta } from "@/components/public/Cta";
import { activeCities, STATE_NAMES } from "@/lib/public/locations";
import { CityChecker } from "@/components/public/CityChecker";
import { pageMeta } from "@/lib/public/meta";

export const revalidate = 3600;
export const metadata = pageMeta(
  "Where Nearest Is Live — Locations",
  "Cities where students can book beauty and wellness professionals on Nearest right now, plus planned expansion. Updated from the platform.",
  "/locations",
);

export default async function Locations() {
  const list = await activeCities();
  let cats: { id: number; name: string }[] = [];
  try {
    const { db, categories } = await import("@/db");
    const { asc, eq } = await import("drizzle-orm");
    cats = (await db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort))).filter((c) => c.name !== "Other");
  } catch { /* the checker still works without the list */ }
  const byState = new Map<string, typeof list>();
  for (const c of list) byState.set(c.state, [...(byState.get(c.state) ?? []), c]);
  return (
    <div className="pub-article">
      <Breadcrumbs items={[{ name: "Locations", href: "/locations" }]} />
      <h1>Where Nearest is live</h1>
      <p className="pub-lede">Nearest is growing nationwide, one city at a time. Students can book in cities where at least one professional is live; professionals can enroll wherever their city is open. Check any U.S. city below.</p>
      <CityChecker categories={cats} />
      <h2>Live for student bookings</h2>
      {list.length === 0 ? (
        <p className="pub-box">No cities are listed right now — check back shortly, or use the city checker above.</p>
      ) : [...byState.entries()].map(([st, cities]) => (
        <section key={st} aria-labelledby={`st-${st}`}>
          <h3 id={`st-${st}`}>{STATE_NAMES[st] ?? st}</h3>
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
      <h2>Not seeing your city?</h2>
      <p>Nearest opens city by city, nationwide. Use the city checker to see whether your city is open for professionals, and leave your details if it isn&apos;t — that tells Nearest where students and professionals want it next. See <Link href="/for-professionals">how joining works</Link>.</p>
      <ProCta />
    </div>
  );
}
