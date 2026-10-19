"use client";
import { useEffect, useState } from "react";

type State = "loading" | "unsupported" | "ios_install" | "denied" | "off" | "on";

const b64 = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

/**
 * "Phone alerts": new booking requests (and every other Nearest notice) buzz this phone like a text. Free web push —
 * on iPhone it needs Nearest added to the Home Screen first (iOS 16.4+). Each phone is turned on separately.
 */
export function PhoneAlerts({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState(isIos() && !standalone() ? "ios_install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub && Notification.permission === "granted" ? "on" : "off");
        // Re-save so a phone that was moved to another account (or a renewed subscription) stays linked.
        if (sub && Notification.permission === "granted") fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) }).catch(() => {});
      } catch { setState("off"); }
    })();
  }, []);

  async function turnOn() {
    setBusy(true); setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); setBusy(false); return; }
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await (await fetch("/api/push/key")).json();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) }));
      const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
      if (!r.ok) throw new Error("save");
      setState("on");
      await fetch("/api/push/test", { method: "POST" });
      setMsg("Alerts are on — we just sent a test alert to this phone.");
    } catch (e) {
      console.error(e);
      setMsg("Couldn't turn on alerts on this phone. Try again, or check that notifications are allowed for Nearest in your phone's settings.");
    }
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true); setMsg("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
      setMsg("Alerts are off for this phone. You'll still get emails.");
    } catch { setMsg("Couldn't turn alerts off. Try again."); }
    setBusy(false);
  }

  async function test() {
    setBusy(true); setMsg("");
    const r = await fetch("/api/push/test", { method: "POST" }).then((x) => x.json()).catch(() => ({ ok: false }));
    setMsg(r.ok ? "Test alert sent — it should pop up in a few seconds." : "The test didn't go through. Turn alerts off and on again.");
    setBusy(false);
  }

  if (state === "loading") return null;
  if (compact && state === "on" && !msg) return null; // the home-screen card only shows until alerts are on

  return (
    <div className={`card${state === "on" ? " ok" : " warn"}`} style={{ gap: 8 }}>
      <span className="eyebrow">Phone alerts</span>
      {state === "on" && <span className="small"><span className="b">On for this phone.</span> New booking requests pop up here like a text, plus emails as always.</span>}
      {state === "off" && <span className="small"><span className="b">Get a phone alert the moment a client books.</span> Requests expire if they aren&apos;t accepted in time — alerts make sure you never miss one.</span>}
      {state === "denied" && <span className="small"><span className="b">Notifications are blocked for Nearest on this phone.</span> Turn them on in your phone&apos;s settings (Settings → Notifications → Nearest, or your browser&apos;s site settings), then come back here.</span>}
      {state === "ios_install" && <span className="small"><span className="b">On iPhone, add Nearest to your Home Screen first.</span> In Safari tap Share (the square with the arrow) → Add to Home Screen → Add. Open Nearest from the new icon, then turn on alerts here.</span>}
      {state === "unsupported" && <span className="small">This browser can&apos;t show phone alerts. Open Nearest in Chrome or Safari on your phone (on iPhone, from the Home Screen icon) to turn them on. You&apos;ll still get emails.</span>}
      {state === "off" && <button className="btn sm" type="button" onClick={turnOn} disabled={busy} style={{ alignSelf: "flex-start" }}>{busy ? "Turning on…" : "Turn on phone alerts"}</button>}
      {state === "on" && !compact && (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn ghost sm" type="button" onClick={test} disabled={busy}>Send a test alert</button>
          <button className="link small" type="button" onClick={turnOff} disabled={busy}>Turn off for this phone</button>
        </div>
      )}
      {msg && <span className="small" role="status">{msg}</span>}
    </div>
  );
}
