import "server-only";
import { inArray } from "drizzle-orm";
import { db, platformSettings } from "@/db";

/**
 * Ad tracking IDs (2026-11-22, owner): pasted in Nearest (Ads → Tracking) by the main owner or their assistant instead of
 * Vercel. These are public IDs that end up in the page anyway. The Meta Conversions API token is a secret and stays in
 * Vercel (META_CAPI_TOKEN). An ID left empty falls back to the Vercel variable.
 */
export const TRACKING_FIELDS = [
  { key: "tracking.meta_pixel_id", env: "NEXT_PUBLIC_META_PIXEL_ID", label: "Meta Pixel ID", hint: "Meta Events Manager → your pixel → 15–16 digits", re: /^\d{10,20}$/ },
  { key: "tracking.ga4_id", env: "NEXT_PUBLIC_GA4_ID", label: "Google Analytics 4 measurement ID", hint: "Starts with G-", re: /^G-[A-Z0-9]{4,15}$/ },
  { key: "tracking.google_ads_id", env: "NEXT_PUBLIC_GOOGLE_ADS_ID", label: "Google Ads tag ID", hint: "Starts with AW-", re: /^AW-\d{6,15}$/ },
  { key: "tracking.google_ads_vote_label", env: "NEXT_PUBLIC_GOOGLE_ADS_VOTE_LABEL", label: "Google Ads conversion label (Vote)", hint: "The part after the slash in AW-…/label", re: /^[A-Za-z0-9_-]{6,40}$/ },
  { key: "tracking.tiktok_pixel_id", env: "NEXT_PUBLIC_TIKTOK_PIXEL_ID", label: "TikTok Pixel ID", hint: "TikTok Ads Manager → Events → your pixel", re: /^[A-Z0-9]{10,30}$/ },
] as const;

export type TrackingIds = { meta: string | null; ga4: string | null; gads: string | null; gadsVote: string | null; tiktok: string | null };

export async function trackingSaved() {
  const rows = await db.select().from(platformSettings).where(inArray(platformSettings.key, TRACKING_FIELDS.map((f) => f.key)));
  // Saved as { id: "…" } so a long digits-only ID (Meta) is never read back as a rounded number.
  const text = (v: unknown) => (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string" ? (v as { id: string }).id : typeof v === "string" ? v : "");
  return Object.fromEntries(rows.map((r) => [r.key, text(r.value)])) as Record<string, string>;
}

export async function trackingIds(): Promise<TrackingIds> {
  const saved = await trackingSaved();
  const v = (i: number) => saved[TRACKING_FIELDS[i].key] || process.env[TRACKING_FIELDS[i].env] || null;
  return { meta: v(0), ga4: v(1), gads: v(2), gadsVote: v(3), tiktok: v(4) };
}
