import { notFound } from "next/navigation";
import { publicPartnerPage, partnerPagePath } from "@/lib/partners";
import { personName } from "@/lib/pro-name";
import { abs } from "@/lib/public/site";
import { PartnerPageView } from "@/components/PartnerPageView";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await publicPartnerPage(slug);
  if (!r) return { title: "Nearest" };
  const name = personName(r.p.displayName, r.u.firstName, r.u.lastName);
  const title = `${name}${r.p.businessName ? ` · ${r.p.businessName}` : ""}`;
  const description = r.page.headline || `Book ${name}, watch their videos and shop their links on Nearest.`;
  const url = abs(partnerPagePath(r.p.slug!));
  return {
    title, description,
    alternates: { canonical: url },
    manifest: `${partnerPagePath(r.p.slug!)}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: name, statusBarStyle: "black-translucent" as const },
    ...(r.p.photoUrl ? { icons: { icon: "/icons/icon-192.png", apple: r.p.photoUrl } } : {}),
    openGraph: { title, description, url, ...(r.p.photoUrl ? { images: [r.p.photoUrl] } : {}) },
  };
}

/** Public Nearest Partner page (usenearest.com/link/<slug>): the partner's link-in-bio, with booking on Nearest. */
export default async function PartnerLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await publicPartnerPage(slug);
  if (!r) notFound();
  return <PartnerPageView r={r} />;
}
