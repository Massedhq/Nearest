import "server-only";
import { cookies, headers } from "next/headers";

/**
 * Ad measurement (2026-11-13). Nearest's own records (ad_visits, student_votes.platform/ad_visit_id, reward_spins) are
 * the source of truth; Meta and Google only get EVENT NAMES — never a name, email, school, city or service pick — and
 * only after the visitor allowed ad measurement (cookie nearest_ads = "yes", set by AdTags on /vote).
 * Env (Vercel): NEXT_PUBLIC_META_PIXEL_ID + META_CAPI_TOKEN (Conversions API), NEXT_PUBLIC_GA4_ID,
 * NEXT_PUBLIC_GOOGLE_ADS_ID + NEXT_PUBLIC_GOOGLE_ADS_VOTE_LABEL. Missing env = that tag is simply off.
 * Events: Vote, Spin, CompleteRegistration, ActivateCard.
 */
export const CONSENT_COOKIE = "nearest_ads";

export async function adsAllowed() {
  return (await cookies()).get(CONSENT_COOKIE)?.value === "yes";
}

/** Meta Conversions API — same event_id as the browser pixel so Meta counts it once. Never throws, never blocks. */
export async function sendAdEvent(name: string, eventId: string) {
  try {
    const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID, token = process.env.META_CAPI_TOKEN;
    if (!pixel || !token || !(await adsAllowed())) return;
    const jar = await cookies(), h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || undefined;
    const body = { data: [{
      event_name: name, event_time: Math.floor(Date.now() / 1000), event_id: eventId, action_source: "website",
      event_source_url: h.get("referer") ?? undefined,
      user_data: { client_ip_address: ip, client_user_agent: h.get("user-agent") ?? undefined, fbp: jar.get("_fbp")?.value, fbc: jar.get("_fbc")?.value },
    }] };
    await fetch(`https://graph.facebook.com/v19.0/${pixel}/events?access_token=${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(4000) });
  } catch (e) { console.error("sendAdEvent", e); }
}

/** Where a landing came from: UTM tags and click ids first, then the referrer. */
export function readAttribution(params: Record<string, string>, referrer: string) {
  const g = (k: string) => (params[k] ?? "").slice(0, 200) || null;
  const src = (g("utm_source") ?? "").toLowerCase();
  const ref = (() => { try { return new URL(referrer).hostname.toLowerCase(); } catch { return ""; } })();
  const click = g("fbclid") ? ["fbclid", g("fbclid")] : g("gclid") ? ["gclid", g("gclid")] : g("gbraid") ? ["gbraid", g("gbraid")] : g("wbraid") ? ["wbraid", g("wbraid")] : g("ttclid") ? ["ttclid", g("ttclid")] : [null, null];
  let platform = "direct";
  if (/^(ig|instagram)/.test(src) || ref.includes("instagram.")) platform = "instagram";
  else if (/^(fb|facebook|meta)/.test(src) || ref.includes("facebook.") || ref === "l.facebook.com" || click[0] === "fbclid") platform = "facebook";
  else if (/^(google|adwords|gads)/.test(src) || ["gclid", "gbraid", "wbraid"].includes(String(click[0])) || ref.includes("google.")) platform = "google";
  else if (src || click[0] || (ref && !ref.endsWith("usenearest.com"))) platform = "other";
  return {
    platform,
    campaign: g("utm_campaign") ?? g("campaign"), campaignId: g("campaign_id") ?? g("utm_id"), adGroup: g("adset") ?? g("adgroup") ?? g("utm_adgroup"), adId: g("ad_id") ?? g("utm_ad"),
    utmSource: g("utm_source"), utmMedium: g("utm_medium"), utmCampaign: g("utm_campaign"), utmContent: g("utm_content"), utmTerm: g("utm_term"),
    clickIdKind: click[0], clickId: click[1], referrer: referrer.slice(0, 300) || null,
  };
}
