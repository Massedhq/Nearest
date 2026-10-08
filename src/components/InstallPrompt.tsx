"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Mode = "button" | "ios" | "android" | "inapp" | null;

const KEY = "nearest_install_dismissed";
const HIDE_ON = ["/guardian", "/unsubscribe", "/go/", "/invite-expired", "/r/"];

/**
 * "Install Nearest" banner. Phones rarely offer to install a web app on their own (iPhone never does),
 * so this shows the right way for each device: a one-tap Install button where the browser allows it,
 * Share → Add to Home Screen steps on iPhone, and "open in Safari/Chrome" inside Instagram/Facebook/TikTok.
 * Hidden once installed or for 14 days after "Not now".
 */
export function InstallPrompt() {
  const path = usePathname() ?? "/";
  const [mode, setMode] = useState<Mode>(null);
  const [evt, setEvt] = useState<BIP | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    try { const t = Number(localStorage.getItem(KEY) || 0); if (Date.now() - t < 14 * 86400000) return; } catch { /* storage blocked: still show */ }
    const ua = navigator.userAgent;
    const inApp = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|BytedanceWebview|Snapchat|LinkedInApp|Pinterest|Line\//i.test(ua);
    const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(ua);
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BIP); setMode("button"); };
    const onInstalled = () => setMode(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // Give the browser a moment to offer its own install event before falling back to steps.
    const t = setTimeout(() => {
      setMode((m) => m ?? (inApp ? "inapp" : ios ? "ios" : android ? "android" : null));
    }, 3500);
    return () => { clearTimeout(t); window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (!mode || HIDE_ON.some((p) => path.startsWith(p))) return null;

  const dismiss = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } setMode(null); };
  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    setEvt(null);
    if (outcome === "accepted") setMode(null); else dismiss();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); } catch { /* ignore */ }
  };

  return (
    <div role="dialog" aria-label="Install Nearest" style={{
      position: "fixed", left: 12, right: 12, bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)", zIndex: 60,
      maxWidth: 460, margin: "0 auto", background: "#111113", color: "#ECE8E1", border: "1px solid #2A2A2D",
      borderRadius: 16, padding: "12px 14px", boxShadow: "0 10px 30px rgba(0,0,0,.5)", display: "flex", flexDirection: "column", gap: 8,
      fontFamily: "var(--font-body), system-ui, sans-serif", fontSize: 13.5, lineHeight: 1.45,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={36} height={36} style={{ borderRadius: 9, flex: "none" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Install Nearest</div>
          <div style={{ color: "#9C978E", fontSize: 12 }}>Get Nearest on your home screen like an app.</div>
        </div>
        <button type="button" onClick={dismiss} aria-label="Not now" style={{ background: "none", border: 0, color: "#9C978E", fontSize: 12, cursor: "pointer" }}>Not now</button>
      </div>
      {mode === "button" && (
        <button type="button" onClick={install} className="btn sm" style={{ width: "100%" }}>Install</button>
      )}
      {mode === "ios" && (
        <span>Tap the <b>Share</b> button <span aria-hidden="true">(square with an arrow)</span> at the bottom of Safari, then <b>Add to Home Screen</b>, then <b>Add</b>.</span>
      )}
      {mode === "android" && (
        <span>Tap the <b>⋮</b> menu at the top right of Chrome, then <b>Install app</b> or <b>Add to Home screen</b>.</span>
      )}
      {mode === "inapp" && (
        <>
          <span>You&apos;re viewing Nearest inside another app, which can&apos;t install it. Tap <b>⋯</b> and choose <b>Open in browser</b> (Safari on iPhone, Chrome on Android) — or copy the link and paste it there.</span>
          <button type="button" onClick={copy} className="btn ghost sm" style={{ width: "100%" }}>{copied ? "Link copied" : "Copy link"}</button>
        </>
      )}
    </div>
  );
}
