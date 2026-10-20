import Link from "next/link";
import { faqCategories } from "@/content/faq";
import { publicFacts } from "@/lib/public/facts";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { FaqList } from "@/components/public/FaqList";
import { ProCta } from "@/components/public/Cta";
import { pageMeta } from "@/lib/public/meta";

export const revalidate = 3600; // product numbers follow Admin → Rules & Settings within the hour

export const metadata = pageMeta(
  "Nearest FAQ — Professionals, Students & Parents",
  "Answers about listing a beauty business, getting clients, marketing and pricing — plus how Nearest works for professionals, students and parents.",
  "/faq",
);

export default async function FaqPage() {
  const cats = faqCategories(await publicFacts());
  const total = cats.reduce((t, c) => t + c.items.length, 0);
  return (
    <div className="pub-article">
      <Breadcrumbs items={[{ name: "FAQ", href: "/faq" }]} />
      <h1>Questions and answers</h1>
      <p className="pub-lede">{total} answers for beauty and wellness professionals, students and parents. The Nearest-specific answers reflect how the platform works today.</p>
      <nav className="pub-toc" aria-label="FAQ topics"><ul>{cats.map((c) => <li key={c.slug}><a href={`#${c.slug}`}>{c.title}</a> <span className="pub-muted">· {c.items.length}</span></li>)}</ul></nav>
      {cats.map((c) => (
        <section key={c.slug} id={c.slug} aria-labelledby={`${c.slug}-h`}>
          <h2 id={`${c.slug}-h`}>{c.title}</h2>
          <p className="pub-muted">{c.audience} — {c.intro}</p>
          <FaqList items={c.items} />
        </section>
      ))}
      <p className="pub-more" style={{ marginTop: 24 }}>Can&apos;t find your answer? <Link href="/contact">Contact Nearest</Link>.</p>
      <ProCta />
    </div>
  );
}
