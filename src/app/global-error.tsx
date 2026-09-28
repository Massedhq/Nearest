"use client";
import { useEffect, useState } from "react";

/** Last-resort screen if the whole app fails to load. Sends the details (and a screenshot) to support in one tap. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const [shot, setShot] = useState<string | undefined>();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [ref, setRef] = useState("");
  useEffect(() => {
    import("html-to-image").then(({ toJpeg }) => toJpeg(document.body, { quality: 0.7, backgroundColor: "#000", width: window.innerWidth, height: window.innerHeight }))
      .then(setShot).catch(() => {});
  }, []);
  async function send() {
    setState("sending");
    try {
      const r = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: error.message || "The app failed to load", stack: error.stack, digest: error.digest, url: window.location.href, viewport: `${window.innerWidth}×${window.innerHeight}`, screenshot: shot }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error();
      setRef(j.ref ?? ""); setState("sent");
    } catch { setState("failed"); }
  }
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#000", color: "#ECE8E1", fontFamily: "Arial, Helvetica, sans-serif", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 14 }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 500, fontSize: 30, margin: 0 }}>Something went wrong.</h1>
          {state === "sent" ? (
            <p style={{ margin: 0 }}>Thanks — Nearest support got the details{ref ? ` (reference ${ref})` : ""}. You don&apos;t need to explain anything else.</p>
          ) : (
            <>
              <p style={{ margin: 0, color: "#B9B3A9" }}>Nearest didn&apos;t load the way it should. We&apos;ve captured what happened — send it to our team in one tap.</p>
              {state === "failed" && <p style={{ margin: 0, color: "#F2A38F" }}>That didn&apos;t send. Please email support@usenearest.com.</p>}
              <button type="button" onClick={send} disabled={state === "sending"} style={{ background: "#ECE8E1", color: "#0A0A0A", border: 0, borderRadius: 26, padding: 16, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>{state === "sending" ? "Sending…" : "Send report"}</button>
            </>
          )}
          <button type="button" onClick={() => window.location.reload()} style={{ background: "transparent", color: "#ECE8E1", border: "1px solid #3A3A3D", borderRadius: 26, padding: 14 }}>Reload</button>
        </div>
      </body>
    </html>
  );
}
