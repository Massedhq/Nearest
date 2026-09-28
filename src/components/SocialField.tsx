"use client";
import { useState } from "react";
import { instagramHandle, tiktokHandle, websiteUrl, instagramUrl, tiktokUrl } from "@/lib/social";

/** A social/website field that shows a live, tappable link so the pro can check it's the right account. */
export function SocialField({ kind, defaultValue }: { kind: "instagram" | "tiktok" | "website"; defaultValue: string }) {
  const [v, setV] = useState(defaultValue);
  const label = kind === "instagram" ? "Instagram" : kind === "tiktok" ? "TikTok" : "Website";
  const handle = kind === "instagram" ? instagramHandle(v) : kind === "tiktok" ? tiktokHandle(v) : null;
  const href = kind === "instagram" ? (handle ? instagramUrl(handle) : null) : kind === "tiktok" ? (handle ? tiktokUrl(handle) : null) : websiteUrl(v);
  const shown = handle ? `@${handle}` : href ? href.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";
  return (
    <div className="field">
      <label htmlFor={kind}>{label}</label>
      <input id={kind} name={kind} value={v} onChange={(e) => setV(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false}
        placeholder={kind === "website" ? "yourbusiness.com" : "@handle or paste your profile link"} />
      {v.trim() && (href
        ? <a className="link xs" href={href} target="_blank" rel="noopener noreferrer">Open {shown} on {label} ↗ — check it&apos;s your account</a>
        : <span className="err xs">{kind === "website" ? "That doesn't look like a website address." : `Enter your ${label} @handle or paste your profile link (not a post).`}</span>)}
    </div>
  );
}
