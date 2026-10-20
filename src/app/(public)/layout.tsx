import { PublicShell } from "@/components/public/PublicShell";
import { JsonLd } from "@/components/public/JsonLd";
import { SITE_URL, SITE_NAME, SITE_TAGLINE, LOGO_PATH, INSTAGRAM_URL, SUPPORT_EMAIL, abs } from "@/lib/public/site";
import "./public.css";

/** Public resource center: anonymous, server-rendered, indexable. The app's own screens use their own layouts. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicShell>
      <JsonLd data={[
        { "@context": "https://schema.org", "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME, alternateName: `Nearest — ${SITE_TAGLINE}`, url: SITE_URL, logo: abs(LOGO_PATH), sameAs: [INSTAGRAM_URL],
          contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: SUPPORT_EMAIL }] },
        { "@context": "https://schema.org", "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: SITE_NAME, alternateName: "usenearest.com", url: SITE_URL, publisher: { "@id": `${SITE_URL}/#organization` } },
      ]} />
      {children}
    </PublicShell>
  );
}
