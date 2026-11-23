"use client";
import { useEffect, useState } from "react";
import { recordAdVisit } from "@/app/vote-actions";

/**
 * /vote ad measurement (2026-11-13). Records the first-party ad visit (UTM tags, click ids, referrer) on landing, and —
 * only after the visitor taps Allow — loads the Meta Pixel and Google tag (GA4 + Google Ads). They receive event names
 * only (Vote, Spin); never names, schools, cities or service picks. Env IDs missing = that tag stays off.
 */
// IDs come from the server (Ads → Tracking in Nearest, else the Vercel variables) — see src/lib/tracking.ts. TikTok added 2026-11-22.
type Ids = { meta: string | null; ga4: string | null; gads: string | null; gadsVote: string | null; tiktok: string | null };
let IDS: Ids = { meta: null, ga4: null, gads: null, gadsVote: null, tiktok: null };

type TtQ = unknown[] & { methods?: string[]; setAndDefer?: (t: TtQ, e: string) => void; load?: (id: string) => void; page?: () => void; track?: (...a: unknown[]) => void; _i?: Record<string, unknown>; _t?: Record<string, number>; _o?: Record<string, unknown> };
type W = Window & { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; dataLayer?: unknown[]; _fbq?: unknown; ttq?: TtQ; TiktokAnalyticsObject?: string };
const allowed = () => { try { return document.cookie.split("; ").includes("nearest_ads=yes"); } catch { return false; } };

/** Send one event to whichever tags are loaded (same event id as the server, so Meta counts it once). */
export function track(name: string, eventId: string) {
  if (typeof window === "undefined" || !allowed()) return;
  const w = window as W;
  try {
    w.fbq?.("trackCustom", name, {}, { eventID: eventId });
    w.gtag?.("event", name.toLowerCase(), {});
    if (name === "Vote" && IDS.gads && IDS.gadsVote) w.gtag?.("event", "conversion", { send_to: `${IDS.gads}/${IDS.gadsVote}` });
    w.ttq?.track?.(name, {}, { event_id: eventId });
  } catch { /* never breaks the page */ }
}

function load() {
  const w = window as W;
  const { meta: META, ga4: GA4, gads: GADS, tiktok: TIKTOK } = IDS;
  if (TIKTOK && !w.ttq) {
    // TikTok's standard base code, written out (queues calls until events.js loads).
    const ttq = [] as unknown as TtQ;
    w.TiktokAnalyticsObject = "ttq"; w.ttq = ttq;
    ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
    ttq.setAndDefer = (t, e) => { (t as unknown as Record<string, unknown>)[e] = (...a: unknown[]) => { t.push([e, ...a]); }; };
    for (const m of ttq.methods) ttq.setAndDefer(ttq, m);
    ttq._i = {}; ttq._t = {}; ttq._o = {};
    ttq.load = (id: string) => {
      ttq._i![id] = []; ttq._t![id] = Date.now(); ttq._o![id] = {};
      const s = document.createElement("script"); s.async = true; s.src = `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${id}&lib=ttq`; document.head.appendChild(s);
    };
    ttq.load(TIKTOK); ttq.page?.();
  }
  if (META && !w.fbq) {
    const f = function (...a: unknown[]) { (f as unknown as { q: unknown[] }).q.push(a); } as unknown as ((...a: unknown[]) => void) & { q: unknown[]; loaded: boolean; version: string; queue: unknown[]; push: unknown };
    f.q = []; f.queue = f.q; f.loaded = true; f.version = "2.0"; f.push = f;
    w.fbq = f; w._fbq = f;
    const s = document.createElement("script"); s.async = true; s.src = "https://connect.facebook.net/en_US/fbevents.js"; document.head.appendChild(s);
    w.fbq("init", META); w.fbq("track", "PageView");
  }
  const gid = GA4 ?? GADS;
  if (gid && !w.gtag) {
    w.dataLayer = w.dataLayer ?? [];
    w.gtag = function (...a: unknown[]) { w.dataLayer!.push(a); };
    const s = document.createElement("script"); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${gid}`; document.head.appendChild(s);
    w.gtag("js", new Date());
    if (GA4) w.gtag("config", GA4);
    if (GADS) w.gtag("config", GADS);
  }
}

export function AdTags({ ids }: { ids: Ids }) {
  IDS = ids;
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    const { meta: META, ga4: GA4, gads: GADS, tiktok: TIKTOK } = IDS;
    const p = Object.fromEntries(new URLSearchParams(window.location.search).entries());
    recordAdVisit(p, window.location.pathname + window.location.search, document.referrer).catch(() => {});
    if (!META && !GA4 && !GADS && !TIKTOK) return;
    const c = document.cookie.split("; ").find((x) => x.startsWith("nearest_ads="));
    if (!c) setAsk(true); else if (c === "nearest_ads=yes") load();
  }, []);
  const answer = (yes: boolean) => {
    document.cookie = `nearest_ads=${yes ? "yes" : "no"}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax; secure`;
    setAsk(false);
    if (yes) load();
  };
  if (!ask) return null;
  return (
    <div role="dialog" aria-label="Ad measurement" style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 80, maxWidth: 480, margin: "0 auto", background: "#0E0E10", border: "1px solid #2F2F33", borderRadius: 14, padding: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <span className="xs" style={{ flex: "1 1 200px" }}>Allow ad measurement cookies? <a className="link" href="/privacy">Privacy</a></span>
      <button type="button" className="btn sm" style={{ width: "auto" }} onClick={() => answer(true)}>Allow</button>
      <button type="button" className="btn ghost sm" style={{ width: "auto" }} onClick={() => answer(false)}>No thanks</button>
    </div>
  );
}
