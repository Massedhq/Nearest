import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES, guideBySlug } from "@/content/guides";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { Blocks } from "@/components/public/GuideBody";
import { JsonLd } from "@/components/public/JsonLd";
import { ProCta, StudentCta } from "@/components/public/Cta";
import { pageMeta } from "@/lib/public/meta";
import { abs, LOGO_PATH, SITE_URL } from "@/lib/public/site";

export const dynamicParams = false;
export function generateStaticParams() { return GUIDES.map((g) => ({ slug: g.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const g = guideBySlug((await params).slug);
  if (!g) return {};
  return pageMeta(g.title, g.description, `/resources/${g.slug}`, { openGraph: { title: g.title, description: g.description, url: abs(`/resources/${g.slug}`), type: "article", publishedTime: g.published, modifiedTime: g.updated, siteName: "Nearest" } });
}

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const related = g.related.map(guideBySlug).filter((x): x is NonNullable<typeof x> => Boolean(x));
  return (
    <article className="pub-article">
      <Breadcrumbs items={[{ name: "Resources", href: "/resources" }, { name: g.h1, href: `/resources/${g.slug}` }]} />
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.description,
        datePublished: g.published, dateModified: g.updated, mainEntityOfPage: abs(`/resources/${g.slug}`),
        author: { "@type": "Organization", name: "Nearest", url: SITE_URL },
        publisher: { "@type": "Organization", name: "Nearest", url: SITE_URL, logo: { "@type": "ImageObject", url: abs(LOGO_PATH) } },
        image: abs("/opengraph-image.png"),
      }} />
      <p className="pub-eyebrow">{g.topic}</p>
      <h1>{g.h1}</h1>
      <p className="pub-meta">By the Nearest team · Updated <time dateTime={g.updated}>{fmt(g.updated)}</time></p>
      <p className="pub-lede">{g.summary}</p>
      <nav className="pub-toc" aria-label="On this page"><ul>{g.sections.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.h}</a></li>)}</ul></nav>
      {g.sections.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}>
          <h2 id={`${s.id}-h`}>{s.h}</h2>
          <Blocks blocks={s.blocks} />
        </section>
      ))}
      {g.faq && g.faq.length > 0 && (
        <section aria-labelledby="faq-h">
          <h2 id="faq-h">Questions</h2>
          {g.faq.map((f) => <div key={f.q}><h3>{f.q}</h3><p>{f.a}</p></div>)}
          <p className="pub-more"><Link href="/faq">More answers in the Nearest FAQ</Link></p>
        </section>
      )}
      {g.audience === "student" ? <StudentCta /> : <ProCta />}
      {related.length > 0 && (
        <section aria-labelledby="rel-h">
          <h2 id="rel-h">Related guides</h2>
          <div className="pub-grid">{related.map((r) => <Link key={r.slug} className="pub-card" href={`/resources/${r.slug}`}><strong>{r.h1}</strong><span>{r.description}</span></Link>)}</div>
        </section>
      )}
    </article>
  );
}
