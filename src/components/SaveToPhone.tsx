"use client";
import { useEffect, useState } from "react";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Device = "ios" | "android" | "inapp" | "desktop";

/**
 * "Save to my phone" on a partner page: puts that page on the home screen like an app (it opens straight to the
 * partner, with their photo as the icon — the page's own manifest). One tap where the browser allows it; otherwise
 * the steps for that phone. Inside Instagram/TikTok it explains how to open the page in Safari/Chrome first.
 */
export function SaveToPhone({ name, accent = "#E8C4C0" }: { name: string; accent?: string }) {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true) setInstalled(true);
    const inApp = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|BytedanceWebview|Snapchat|LinkedInApp|Pinterest|Line\//i.test(ua);
    const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    setDevice(inApp ? "inapp" : ios ? "ios" : /Android/i.test(ua) ? "android" : "desktop");
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BIP); };
    const onInstalled = () => { setInstalled(true); setOpen(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (installed) return null;

  const tap = async () => {
    if (evt) {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      setEvt(null);
      if (outcome === "accepted") setInstalled(true);
      return;
    }
    setOpen(true);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); } catch { /* ignore */ } };

  return (
    <>
      <button type="button" onClick={tap} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: "transparent", color: "#F4F1EA", border: `1px solid ${accent}`, borderRadius: 999, padding: "13px 16px", font: "800 13px var(--font-body), system-ui, sans-serif", cursor: "pointer" }}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M12 8v6M9.5 11.5 12 14l2.5-2.5" /></svg>
        Save {name} to my phone
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Save to your phone" onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "#121214", color: "#F4F1EA", border: "1px solid #2A2A2E", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", gap: 12, fontSize: 14, lineHeight: 1.5 }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>Save {name} to your home screen</span>
            {device === "ios" && <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}><li>Tap the <b>Share</b> button (the square with an arrow) at the bottom of Safari.</li><li>Scroll down and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>. It opens right to this page, like an app.</li></ol>}
            {device === "android" && <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}><li>Tap the <b>⋮</b> menu at the top right of Chrome.</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li><li>Tap <b>Install</b>. It opens right to this page, like an app.</li></ol>}
            {device === "inapp" && (
              <>
                <span>You opened this inside another app, which can&apos;t save pages to your home screen. Tap <b>⋯</b> and choose <b>Open in browser</b> (Safari on iPhone, Chrome on Android), then tap Save to my phone again.</span>
                <button type="button" onClick={copy} style={{ background: "transparent", color: "#F4F1EA", border: "1px solid #3A3A3F", borderRadius: 999, padding: 12, font: "700 13px var(--font-body), system-ui, sans-serif" }}>{copied ? "Link copied" : "Copy link"}</button>
              </>
            )}
            {device === "desktop" && <span>Open this page on your phone, then tap <b>Save to my phone</b>. On iPhone use Safari&apos;s Share → Add to Home Screen; on Android use Chrome&apos;s ⋮ menu → Install app.</span>}
            <button type="button" onClick={() => setOpen(false)} style={{ background: accent, color: "#0B0B0C", border: "none", borderRadius: 999, padding: 13, font: "800 13px var(--font-body), system-ui, sans-serif" }}>Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
