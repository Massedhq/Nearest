import type { MetadataRoute } from "next";
import { GUIDES } from "@/content/guides";
import { PUBLIC_PAGES, abs } from "@/lib/public/site";
import { activeCities } from "@/lib/public/locations";

export const revalidate = 3600;

/** Only real, public, canonical pages: the welcome page, the pro landing, legal pages, the resource center, and live cities. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cities = await activeCities();
  const latest = GUIDES.reduce((d, g) => (g.updated > d ? g.updated : d), "2026-10-20");
  return [
    { url: abs("/"), changeFrequency: "monthly", priority: 1 },
    { url: abs("/pro"), changeFrequency: "monthly", priority: 0.8 },
    ...PUBLIC_PAGES.map((p) => ({ url: abs(p), lastModified: latest, changeFrequency: "weekly" as const, priority: p === "/for-professionals" || p === "/student-beauty-services" ? 0.9 : 0.7 })),
    ...GUIDES.map((g) => ({ url: abs(`/resources/${g.slug}`), lastModified: g.updated, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...cities.map((c) => ({ url: abs(`/locations/${c.stateSlug}/${c.slug}`), changeFrequency: "weekly" as const, priority: 0.5 })),
    { url: abs("/terms"), changeFrequency: "yearly", priority: 0.2 },
    { url: abs("/privacy"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
