import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, partnerApplications, partnerPages, professionalProfiles, users, type PartnerLinkItem, type PartnerVideoItem } from "@/db";
import { SITE_URL } from "@/lib/public/site";

/**
 * Nearest Partner pages: a link-in-bio page for beauty educators and creators (photo, top services, Model Calls,
 * Bundle my booking, videos, shop links) that sends their followers into normal Nearest booking.
 * Not the same as Sales Track partners (partner codes) or sales reps.
 */

export const PARTNER_LIMITS = { links: 12, videos: 12, top: 4, headline: 80, title: 60 } as const;
export const PARTNER_APPLY_PATH = "/partners";
export const PARTNER_DEMO_PATH = "/partners/demo";
export const PARTNER_SETUP_DEMO_PATH = "/partners/demo/setup";

export const partnerApplyLink = () => `${SITE_URL}${PARTNER_APPLY_PATH}`;
export const partnerDemoLink = () => `${SITE_URL}${PARTNER_DEMO_PATH}`;
export const partnerSetupDemoLink = () => `${SITE_URL}${PARTNER_SETUP_DEMO_PATH}`;
export const partnerPagePath = (slug: string) => `/link/${slug}`;
export const partnerPageLink = (slug: string) => `${SITE_URL}${partnerPagePath(slug)}`;

export const normEmail = (e: string) => e.trim().toLowerCase();

/** https only, no javascript:/data:, max 500 chars. "amazon.com/shop/x" gets https:// added. */
export function cleanUrl(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    u.protocol = "https:";
    const out = u.toString();
    return out.length <= 500 ? out : null;
  } catch { return null; }
}

/** What kind of video link this is, and a thumbnail when the site gives one without an API (YouTube). */
export function videoInfo(url: string): { site: string; thumb: string | null; embed: string | null } {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let yt: string | null = null;
    if (host === "youtu.be") yt = u.pathname.slice(1).split("/")[0];
    else if (host.endsWith("youtube.com")) yt = u.searchParams.get("v") ?? (u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/)?.[1] ?? null);
    if (yt && /^[\w-]{6,20}$/.test(yt)) return { site: "YouTube", thumb: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`, embed: `https://www.youtube-nocookie.com/embed/${yt}` };
    const vimeo = host === "vimeo.com" ? u.pathname.match(/^\/(\d{5,})/)?.[1] : null;
    if (vimeo) return { site: "Vimeo", thumb: null, embed: `https://player.vimeo.com/video/${vimeo}` };
    if (host.endsWith("tiktok.com")) return { site: "TikTok", thumb: null, embed: null };
    if (host.endsWith("instagram.com")) return { site: "Instagram", thumb: null, embed: null };
    return { site: host, thumb: null, embed: null };
  } catch { return { site: "Video", thumb: null, embed: null }; }
}

const rid = () => Math.random().toString(36).slice(2, 10);

/** Rows from the editor form → saved rows (blank rows dropped, bad links refused with a message). */
export function cleanLinkRows(titles: string[], urls: string[], notes: string[] = []): { rows: PartnerLinkItem[]; error?: string } {
  const rows: PartnerLinkItem[] = [];
  for (let i = 0; i < Math.max(titles.length, urls.length); i++) {
    const title = (titles[i] ?? "").trim().slice(0, PARTNER_LIMITS.title);
    const rawUrl = (urls[i] ?? "").trim();
    if (!title && !rawUrl) continue;
    if (!title) return { rows, error: `Give link ${i + 1} a title.` };
    const url = cleanUrl(rawUrl);
    if (!url) return { rows, error: `"${title}" needs a working web address (https://…).` };
    const note = (notes[i] ?? "").trim().slice(0, 80);
    rows.push({ id: rid(), title, url, ...(note ? { note } : {}) });
  }
  if (rows.length > PARTNER_LIMITS.links) return { rows, error: `Up to ${PARTNER_LIMITS.links} links.` };
  return { rows };
}

export function cleanVideoRows(titles: string[], urls: string[]): { rows: PartnerVideoItem[]; error?: string } {
  const rows: PartnerVideoItem[] = [];
  for (let i = 0; i < Math.max(titles.length, urls.length); i++) {
    const title = (titles[i] ?? "").trim().slice(0, PARTNER_LIMITS.title);
    const rawUrl = (urls[i] ?? "").trim();
    if (!title && !rawUrl) continue;
    const url = cleanUrl(rawUrl);
    if (!url) return { rows, error: `Video ${i + 1} needs a link (YouTube, TikTok, Instagram or Vimeo).` };
    rows.push({ id: rid(), title: title || "Watch", url });
  }
  if (rows.length > PARTNER_LIMITS.videos) return { rows, error: `Up to ${PARTNER_LIMITS.videos} videos.` };
  return { rows };
}

/**
 * The professional's partner page, creating it the first time an approved application matches their account email.
 * Returns null when they aren't an approved partner.
 */
export async function partnerPageFor(userId: string) {
  const page = await db.query.partnerPages.findFirst({ where: eq(partnerPages.userId, userId) });
  if (page) return page;
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true } });
  if (!u?.email) return null;
  const app = (await db.select().from(partnerApplications)
    .where(and(eq(partnerApplications.email, normEmail(u.email)), eq(partnerApplications.status, "approved")))
    .orderBy(desc(partnerApplications.decidedAt)).limit(1))[0];
  if (!app) return null;
  await db.insert(partnerPages).values({ userId, applicationId: app.id, approvedAt: app.decidedAt ?? new Date() }).onConflictDoNothing();
  return (await db.query.partnerPages.findFirst({ where: eq(partnerPages.userId, userId) })) ?? null;
}

/** Public page lookup by the professional's slug: published, not paused, and the profile approved. */
export async function publicPartnerPage(slug: string) {
  const key = slug.toLowerCase();
  if (!/^[a-z0-9-]{2,40}$/.test(key)) return null;
  const r = (await db.select({ page: partnerPages, p: professionalProfiles, u: users }).from(partnerPages)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, partnerPages.userId))
    .innerJoin(users, eq(users.id, partnerPages.userId))
    .where(and(eq(professionalProfiles.slug, key), eq(partnerPages.published, true), isNull(partnerPages.pausedAt), eq(professionalProfiles.reviewStatus, "approved")))
    .limit(1))[0];
  return r ?? null;
}

/** The partner's own page for a private preview — same shape as publicPartnerPage, without the live checks. */
export async function partnerPagePreview(userId: string) {
  const r = (await db.select({ page: partnerPages, p: professionalProfiles, u: users }).from(partnerPages)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, partnerPages.userId))
    .innerJoin(users, eq(users.id, partnerPages.userId))
    .where(eq(partnerPages.userId, userId)).limit(1))[0];
  return r ?? null;
}
