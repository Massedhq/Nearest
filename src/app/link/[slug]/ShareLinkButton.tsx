"use client";
import { useState } from "react";

/** Share icon on a partner page: the phone's share sheet when there is one, otherwise copies the link. */
export function ShareLinkButton({ url, name }: { url: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: name, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* closed the share sheet */ }
  };
  return (
    <button type="button" onClick={share} aria-label={copied ? "Link copied" : "Share this page"} style={{ height: 44, minWidth: 44, borderRadius: 22, border: "1px solid #2A2A2E", background: "transparent", color: "#F4F1EA", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: copied ? "0 14px" : 0, font: "700 12px var(--font-body), system-ui, sans-serif", cursor: "pointer" }}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M5 13v7h14v-7" /></svg>
      {copied && "Copied"}
    </button>
  );
}
