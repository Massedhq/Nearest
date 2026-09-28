"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Captured = { message: string; stack?: string; digest?: string; screenshot?: string; url: string; viewport: string };

/** Errors that aren't Nearest's fault (extensions, dropped connections, browser quirks) — never shown to people. */
const NOISE = /ResizeObserver loop|chrome-extension:|moz-extension:|safari-extension:|Script error\.?$|Load failed|NetworkError|Failed to fetch|The user aborted|AbortError|NEXT_REDIRECT|NEXT_NOT_FOUND|cancelled|Non-Error promise rejection/i;

/** Screenshot of exactly what the person is looking at right now. */
async function snap(): Promise<string | undefined> {
  try {
    const { toJpeg } = await import("html-to-image");
    const w = window.innerWidth, h = window.innerHeight;
    return await toJpeg(document.body, {
      quality: 0.7, pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5), backgroundColor: "#000",
      width: w, height: h, canvasWidth: w, canvasHeight: h,
      style: { transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)`, transformOrigin: "top left" },
      filter: (n) => !(n instanceof HTMLElement && n.dataset.noSnap === "1"), // don't photograph the popup itself
      cacheBust: true,
    });
  } catch { return undefined; }
}

declare global { interface Window { __nearestReport?: (e: { message: string; stack?: string; digest?: string }) => void } }

/** Mounted once for the whole app: catches problems, captures the screen, and offers a one-tap report to support. */
export function ProblemReporter() {
  const [c, setC] = useState<Captured | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [ref, setRef] = useState("");
  const last = useRef(0);

  const capture = useCallback(async (e: { message: string; stack?: string; digest?: string }) => {
    if (!e.message || NOISE.test(e.message) || NOISE.test(e.stack ?? "")) return;
    if (Date.now() - last.current < 30_000) return; // one popup per 30 seconds
    last.current = Date.now();
    const screenshot = await snap(); // before anything else changes on screen
    setNote(""); setState("idle"); setRef("");
    setC({ ...e, screenshot, url: window.location.href, viewport: `${window.innerWidth}×${window.innerHeight}` });
  }, []);

  useEffect(() => {
    window.__nearestReport = (e) => void capture(e);
    const onError = (ev: ErrorEvent) => void capture({ message: ev.message || String(ev.error), stack: ev.error?.stack });
    const onRejection = (ev: PromiseRejectionEvent) => {
      const r = ev.reason;
      void capture({ message: r?.message ?? String(r), stack: r?.stack, digest: r?.digest });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); delete window.__nearestReport; };
  }, [capture]);

  async function send() {
    if (!c) return;
    setState("sending");
    try {
      const r = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...c, note }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error();
      setRef(j.ref ?? ""); setState("sent");
    } catch { setState("failed"); }
  }

  if (!c) return null;
  return (
    <div data-no-snap="1" role="dialog" aria-modal="true" aria-labelledby="pr-title"
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.75)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "16px 16px calc(16px + env(safe-area-inset-bottom,0px))" }}>
      <div className="card" style={{ width: "100%", maxWidth: 440, gap: 12, background: "#0E0E10", maxHeight: "90vh", overflowY: "auto" }}>
        {state === "sent" ? (
          <>
            <h2 id="pr-title" className="disp h2">Thanks — it&apos;s been sent.</h2>
            <p className="small p" style={{ margin: 0 }}>Nearest support got the details and a screenshot{ref && ref !== "limit" ? `. Your reference is ${ref}` : ""}. You don&apos;t need to explain anything else.</p>
            <button className="btn" type="button" onClick={() => setC(null)}>Close</button>
          </>
        ) : (
          <>
            <h2 id="pr-title" className="disp h2">Something went wrong.</h2>
            <p className="small p" style={{ margin: 0 }}>We&apos;ve captured what happened — the page, the error and a screenshot — so you don&apos;t have to explain it. Tap send and our team will look into it.</p>
            {c.screenshot && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.screenshot} alt="Screenshot of the screen when the problem happened" style={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 12, border: "1px solid #2A2A2D", background: "#000" }} />
            )}
            <div className="field">
              <label htmlFor="pr-note">Anything to add? (optional)</label>
              <input id="pr-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. I was trying to book" />
            </div>
            {state === "failed" && <p className="err small" role="alert">That didn&apos;t send. Check your connection and try again, or email support@usenearest.com.</p>}
            <button className="btn" type="button" onClick={send} disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send report"}</button>
            <button className="btn ghost" type="button" onClick={() => setC(null)}>Not now</button>
          </>
        )}
      </div>
    </div>
  );
}
