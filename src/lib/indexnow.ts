import "server-only";
import { eq } from "drizzle-orm";
import { db, platformSettings } from "@/db";
import { CANONICAL_ORIGIN, SITE_URL } from "./public/site";

/**
 * IndexNow — tells Bing (which also feeds Yahoo, DuckDuckGo and ChatGPT search), Yandex, Seznam and Naver right away
 * when a public page is new or changed, instead of waiting for their crawlers. Google doesn't use IndexNow — for Google
 * the sitemap + Search Console are the path.
 *
 * The key is public by design: search engines check it by reading https://www.usenearest.com/indexnow-key.txt
 * (src/app/indexnow-key.txt/route.ts). Only the live site sends (never local or preview builds).
 */
export const INDEXNOW_KEY = "46095bae7942264b0ce55d32b7e5815f";
export const KEY_LOCATION = `${CANONICAL_ORIGIN}/indexnow-key.txt`;
const LAST_SENT = "seo.indexnow_last_sent"; // platform_settings: { at: ISO, count, status }
const DAY = 24 * 3600 * 1000;

const live = () => SITE_URL === CANONICAL_ORIGIN && process.env.VERCEL_ENV === "production";

/** Send these www.usenearest.com addresses (max 10,000). Never throws — a failed ping must never block anything. */
export async function pingIndexNow(urls: string[]): Promise<{ sent: number; status: number | string }> {
  const list = [...new Set(urls.filter((u) => u.startsWith(`${CANONICAL_ORIGIN}/`) || u === CANONICAL_ORIGIN))].slice(0, 10000);
  if (!list.length) return { sent: 0, status: "nothing to send" };
  if (!live()) return { sent: 0, status: "skipped (not the live site)" };
  try {
    const r = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: new URL(CANONICAL_ORIGIN).host, key: INDEXNOW_KEY, keyLocation: KEY_LOCATION, urlList: list }),
      signal: AbortSignal.timeout(10000),
    });
    return { sent: r.ok ? list.length : 0, status: r.status };
  } catch (e) {
    console.error("indexnow", e);
    return { sent: 0, status: "network error" };
  }
}

/** Every page in the sitemap. */
export async function sitemapUrls() {
  const sitemap = (await import("@/app/sitemap")).default;
  return (await sitemap()).map((e) => e.url);
}

export async function lastSent(): Promise<{ at: string; count: number; status: number | string } | null> {
  const row = await db.query.platformSettings.findFirst({ where: eq(platformSettings.key, LAST_SENT) });
  return (row?.value as { at: string; count: number; status: number | string } | undefined) ?? null;
}

async function remember(count: number, status: number | string, by?: string | null) {
  const value = { at: new Date().toISOString(), count, status };
  await db.insert(platformSettings).values({ key: LAST_SENT, value, updatedBy: by ?? null })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedBy: by ?? null, updatedAt: new Date() } });
}

/** Send the whole sitemap. force = owner button; otherwise (cron) at most once a day. */
export async function pingSitemap(opts: { force?: boolean; by?: string | null } = {}) {
  if (!live()) return { sent: 0, status: "skipped (not the live site)" as number | string };
  if (!opts.force) {
    const last = await lastSent();
    if (last && Date.now() - new Date(last.at).getTime() < DAY) return { sent: 0, status: "already sent today" as number | string };
  }
  const r = await pingIndexNow(await sitemapUrls());
  await remember(r.sent, r.status, opts.by);
  return r;
}

/** A professional just went live: tell search engines about their public booking page now. */
export async function pingProPage(slug: string | null | undefined) {
  if (!slug) return;
  await pingIndexNow([`${CANONICAL_ORIGIN}/pro-${slug}`]);
}
