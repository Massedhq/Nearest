"use client";
import { useEffect } from "react";

/** Any page that fails to load: a calm screen, plus the automatic report popup (with screenshot). */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => window.__nearestReport?.({ message: error.message || "This page couldn't load", stack: error.stack, digest: error.digest }), 150);
    return () => clearTimeout(t);
  }, [error]);
  return (
    <div className="scr" style={{ justifyContent: "center" }}>
      <div className="body" style={{ flex: "none", gap: 14 }}>
        <h1 className="disp h1">Something went wrong.</h1>
        <p className="small muted p">This page didn&apos;t load the way it should. We&apos;ve captured the details so you can send them to our team in one tap.</p>
        <button className="btn" type="button" onClick={() => reset()}>Try again</button>
        <a className="btn ghost" href="/go">Go to my account</a>
      </div>
    </div>
  );
}
