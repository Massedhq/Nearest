"use client";
import { useEffect, useState } from "react";
import { recordAdVisit } from "@/app/vote-actions";

/**
 * /vote ad measurement (2026-11-13). Records the first-party ad visit (UTM tags, click ids, referrer) on landing, and —
 * only after the visitor taps Allow — loads the Meta Pixel and Google tag (GA4 + Google Ads). They receive event names
 * only (Vote, Spin); never names, schools, cities or service picks. Env IDs missing = that tag stays off.
 */
const META = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GA4 = process.env.NEXT_PUBLIC_GA4_ID;
const GADS = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const GADS_VOTE = process.env.NEXT_PUBLIC_GOOGLE_ADS_VOTE_LABEL;

type W = Window & { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; dataLayer?: unknown[]; _fbq?: unknown };
const allowed = () => { try { return document.cookie.split("; ").includes("nearest_ads=yes"); } catch { return false; } };

/** Send one event to whichever tags are loaded (same event id as the server, so Meta counts it once). */
export function track(name: string, eventId: string) {
  if (typeof window === "undefined" || !allowed()) return;
  const w = window as W;
  try {
    w.fbq?.("trackCustom", name, {}, { eventID: eventId });
    w.gtag?.("event", name.toLowerCase(), {});
    if (name === "Vote" && GADS && GADS_VOTE) w.gtag?.("event", "conversion", { send_to: `${GADS}/${GADS_VOTE}` });
  } catch { /* never breaks the page */ }
}

function load() {
  const w = window as W;
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

export function AdTags() {
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    const p = Object.fromEntries(new URLSearchParams(window.location.search).entries());
    recordAdVisit(p, window.location.pathname + window.location.search, document.referrer).catch(() => {});
    if (!META && !GA4 && !GADS) return;
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
