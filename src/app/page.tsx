import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SupporterAvatar } from "@/components/SupporterAvatar";
import { previewPlaceholders, publishedSupporters } from "@/lib/supporters";
import { JsonLd } from "@/components/public/JsonLd";
import { pageMeta } from "@/lib/public/meta";
import { SITE_URL, SITE_NAME, SITE_TAGLINE, LOGO_PATH, INSTAGRAM_URL, SUPPORT_EMAIL, abs } from "@/lib/public/site";

export const metadata = pageMeta(
  "Nearest — Student Beauty, Wellness & Self-Care Booking Platform",
  "Nearest (usenearest.com) helps high school, college, trade school and online students book independent beauty, grooming, wellness and self-care professionals near them at student-friendly prices.",
  "/",
  { title: { absolute: "Nearest — Student Beauty, Wellness & Self-Care Booking Platform" } },
);

export default async function Welcome() {
  const { userId } = await auth();
  if (userId) redirect("/go");
  // Educator endorsements: only real, published supporters on the live site. None published → the section is hidden.
  // Development / preview builds show labeled initials placeholders so the layout can be checked.
  const real = await publishedSupporters().catch(() => []);
  const all = real.length ? real : previewPlaceholders();
  const circles = all.slice(0, 6); // up to six faces on the homepage; everyone is on /supporters
  const sample = !real.length && circles.length > 0;
  return (
    <div className="scr">
      <JsonLd data={[
        { "@context": "https://schema.org", "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME, alternateName: `Nearest — ${SITE_TAGLINE}`, url: SITE_URL, logo: abs(LOGO_PATH), sameAs: [INSTAGRAM_URL],
          contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: SUPPORT_EMAIL }] },
        { "@context": "https://schema.org", "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: SITE_NAME, alternateName: ["usenearest", "usenearest.com", "Use Nearest", "Nearest app"], url: SITE_URL, publisher: { "@id": `${SITE_URL}/#organization` } },
      ]} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 22px" }}>
        <h1 style={{ margin: 0, width: "100%", display: "flex", justifyContent: "center" }}>
          <Image src="/brand/nearest-wordmark.png" alt="Nearest" width={380} height={253} priority style={{ width: "100%", maxWidth: 380, height: "auto" }} />
          <span className="sr-only"> — Student Beauty, Wellness &amp; Self-Care Booking Platform</span>
        </h1>
        <p className="disp" style={{ fontSize: 24, textAlign: "center", margin: "-8px 0 0", fontStyle: "italic" }}>Find who&apos;s available near you.</p>
        <p className="muted small" style={{ textAlign: "center", margin: "14px 0 0", maxWidth: 290 }}>
          Book, pay and finish your appointment in one place.
        </p>
      </div>
      <div className="body" style={{ flex: "none", gap: 12 }}>
        <Link className="btn" href="/sign-up">Create account</Link>
        <Link className="btn ghost" href="/sign-in">Sign in</Link>
        {circles.length > 0 && (
          <section aria-label="Why educators support Nearest" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, margin: "18px 0 6px" }}>
            <h2 className="disp" style={{ fontSize: 22, textAlign: "center" }}>Why educators support Nearest</h2>
            <div className="row" style={{ gap: 6, justifyContent: "center", flexWrap: "nowrap" }}>
              {circles.map((c) => (
                <Link key={c.id} href={`/supporters#s-${c.id}`} aria-label={`${c.name} — read their statement`} style={{ textDecoration: "none" }}>
                  <SupporterAvatar id={c.id} portrait={c.portrait} initials={c.initials} size={46} />
                </Link>
              ))}
            </div>
            <Link className="small" href="/supporters" style={{ color: "#C9C4BA", textDecoration: "none" }}>{all.length > 6 ? `Meet all ${all.length} supporters` : "Meet our supporters"} <span aria-hidden="true">→</span></Link>
            {sample && <span className="xs muted">Sample profiles · Concept only</span>}
          </section>
        )}
        <p className="xs muted" style={{ textAlign: "center", margin: "6px 0 0" }}>By continuing you agree to the Nearest <Link className="link" href="/terms" style={{ fontSize: "inherit" }}>Terms</Link> and <Link className="link" href="/privacy" style={{ fontSize: "inherit" }}>Privacy Policy</Link>.</p>
        <p className="xs muted" style={{ textAlign: "center", margin: "10px auto 0", maxWidth: 340, lineHeight: 1.5 }}>
          <strong>Nearest</strong> (usenearest.com) is a booking platform where verified students book independent beauty, grooming, wellness and
          self-care professionals near them — hair, braids, barbers, lashes, nails, brows, makeup and more — at student-friendly prices.
          Professionals list their services free and get booked by students nearby.
        </p>
        <nav aria-label="Learn about Nearest" className="xs" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px 14px", margin: "2px 0 0" }}>
          <Link className="link" href="/about-nearest" style={{ fontSize: "inherit" }}>About Nearest</Link>
          <Link className="link" href="/student-beauty-services" style={{ fontSize: "inherit" }}>For students</Link>
          <Link className="link" href="/for-professionals" style={{ fontSize: "inherit" }}>For professionals</Link>
          <Link className="link" href="/locations" style={{ fontSize: "inherit" }}>Locations</Link>
          <Link className="link" href="/resources" style={{ fontSize: "inherit" }}>Resources</Link>
          <Link className="link" href="/faq" style={{ fontSize: "inherit" }}>FAQ</Link>
        </nav>
      </div>
    </div>
  );
}
