import Link from "next/link";
import { GUIDES, TOPICS } from "@/content/guides";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { ProCta } from "@/components/public/Cta";
import { pageMeta } from "@/lib/public/meta";

export const metadata = pageMeta(
  "Beauty Business Resources & Guides",
  "Free, practical guides for beauty and wellness professionals: getting clients, pricing, marketing, listings and student event seasons — from Nearest.",
  "/resources",
);

const HUBS = [
  { href: "/grow-your-beauty-business", title: "Grow your beauty business", text: "The big-picture plan: visibility, retention, pricing and referrals." },
  { href: "/get-more-clients", title: "Get more clients", text: "Tactics by profession — nails, hair, braids, barbers, lashes, brows, makeup." },
  { href: "/free-business-listing", title: "Free business listings", text: "Where to list your services and how the options compare." },
  { href: "/beauty-marketing-resources", title: "Marketing resources", text: "Copyable captions, referral scripts, flyers and a content calendar." },
  { href: "/faq", title: "Questions & answers", text: "120 answers for professionals, students and parents." },
];

export default function Resources() {
  return (
    <div>
      <Breadcrumbs items={[{ name: "Resources", href: "/resources" }]} />
      <p className="pub-eyebrow">Nearest resource center</p>
      <h1>Resources for beauty and wellness professionals</h1>
      <p className="pub-lede">Practical, free guides for independent professionals — written to be useful whether or not you ever use Nearest.</p>
      <h2>Start here</h2>
      <div className="pub-grid">{HUBS.map((h) => <Link key={h.href} className="pub-card" href={h.href}><strong>{h.title}</strong><span>{h.text}</span></Link>)}</div>
      {TOPICS.map((t) => {
        const list = GUIDES.filter((g) => g.topic === t);
        if (!list.length) return null;
        return (
          <section key={t} aria-labelledby={`t-${t}`}>
            <h2 id={`t-${t}`}>{t}</h2>
            <div className="pub-grid">{list.map((g) => <Link key={g.slug} className="pub-card" href={`/resources/${g.slug}`}><strong>{g.h1}</strong><span>{g.description}</span></Link>)}</div>
          </section>
        );
      })}
      <ProCta />
    </div>
  );
}
