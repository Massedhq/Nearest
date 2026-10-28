import { NextResponse } from "next/server";
import { publicPartnerPage, partnerPagePath } from "@/lib/partners";
import { personName } from "@/lib/pro-name";

export const dynamic = "force-dynamic";

/** "Save to my phone" for a partner page: the home-screen app opens straight to that partner, with their photo as the icon. */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await publicPartnerPage(slug);
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const name = personName(r.p.displayName, r.u.firstName, r.u.lastName);
  const path = partnerPagePath(r.p.slug!);
  const icons = [
    ...(r.p.photoUrl ? [{ src: r.p.photoUrl, sizes: "512x512", type: "image/jpeg", purpose: "any" }] : []),
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
  ];
  const body = {
    id: path,
    name: r.p.businessName ? `${name} · ${r.p.businessName}` : name,
    short_name: name.split(" ")[0].slice(0, 12),
    description: r.page.headline || `Book ${name} on Nearest.`,
    start_url: path,
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons,
  };
  return new NextResponse(JSON.stringify(body), { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=300" } });
}
