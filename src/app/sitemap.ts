import type { MetadataRoute } from "next";
import { GUIDES } from "@/content/guides";
import { PUBLIC_PAGES, abs } from "@/lib/public/site";
import { activeCities } from "@/lib/public/locations";
import { and, isNotNull, sql } from "drizzle-orm";
import { db, professionalProfiles } from "@/db";
import { liveProWhere } from "@/lib/search";
import { categorySeo } from "@/lib/public/directory";

export const revalidate = 3600;

/** Only real, public, canonical pages: the welcome page, the pro landing, legal pages, the resource center, and live cities. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cities = await activeCities();
  // Live professionals' public booking pages (usenearest.com/pro-name) — the same pros students can see.
  // lastmod = the newest of: services saved (the menu is replaced on every save), portfolio photo added, review left —
  // so Google rechecks a professional's page when something on it changes.
  const pros = await db.select({
    slug: professionalProfiles.slug,
    updated: sql<string | null>`greatest(
      (select max(s.created_at) from pro_services s where s.user_id = ${professionalProfiles.userId}),
      (select max(pi.created_at) from portfolio_items pi where pi.user_id = ${professionalProfiles.userId}),
      (select max(r.created_at) from reviews r where r.pro_id = ${professionalProfiles.userId}))`,
  }).from(professionalProfiles)
    .where(and(isNotNull(professionalProfiles.slug), ...liveProWhere(null, "all"))).limit(5000).catch(() => []);
  // Nearest Partner link pages that are live (published, not paused, profile approved) — same rule as publicPartnerPage.
  const partnerSlugs = (await db.execute<{ slug: string }>(sql`select p.slug from partner_pages pp join professional_profiles p on p.user_id = pp.user_id
    where pp.published and pp.paused_at is null and p.review_status = 'approved' and p.slug is not null`).catch(() => ({ rows: [] as { slug: string }[] }))).rows.map((r) => r.slug);
  const latest = GUIDES.reduce((d, g) => (g.updated > d ? g.updated : d), "2026-10-20");
  return [
    { url: abs("/"), changeFrequency: "monthly", priority: 1 },
    { url: abs("/pro"), changeFrequency: "monthly", priority: 0.8 },
    ...PUBLIC_PAGES.map((p) => ({ url: abs(p), lastModified: latest, changeFrequency: "weekly" as const, priority: p === "/for-professionals" || p === "/student-beauty-services" ? 0.9 : 0.7 })),
    ...GUIDES.map((g) => ({ url: abs(`/resources/${g.slug}`), lastModified: g.updated, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...cities.map((c) => ({ url: abs(`/locations/${c.stateSlug}/${c.slug}`), changeFrequency: "weekly" as const, priority: 0.5 })),
    // "Nail Techs in Frisco, TX" — every city + category with a live professional.
    ...cities.flatMap((c) => c.categories.map((cat) => ({ url: abs(`/locations/${c.stateSlug}/${c.slug}/${categorySeo(cat).slug}`), changeFrequency: "weekly" as const, priority: 0.6 }))),
    ...pros.map((p) => ({ url: abs(`/pro-${p.slug}`), ...(p.updated ? { lastModified: new Date(p.updated) } : {}), changeFrequency: "weekly" as const, priority: 0.7 })),
    ...partnerSlugs.map((slug) => ({ url: abs(`/link/${slug}`), changeFrequency: "weekly" as const, priority: 0.6 })),
    { url: abs("/terms"), changeFrequency: "yearly", priority: 0.2 },
    { url: abs("/privacy"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
