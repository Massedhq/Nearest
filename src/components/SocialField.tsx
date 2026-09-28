"use client";
import { useState } from "react";
import { Icon } from "./Icon";
import { instagramHandle, tiktokHandle, instagramUrl, tiktokUrl } from "@/lib/social";

const INFO = {
  instagram: { label: "Instagram profile link", icon: "insta", ph: "https://www.instagram.com/yourname", how: "In Instagram: your profile → Share profile → Copy link, then paste it here." },
  tiktok: { label: "TikTok profile link", icon: "tiktok", ph: "https://www.tiktok.com/@yourname", how: "In TikTok: Profile → Share profile → Copy link, then paste it here." },
} as const;

/** A link field: paste the profile link, see the live link, tap it to check it's the right account. */
export function SocialField({ kind, defaultValue }: { kind: "instagram" | "tiktok"; defaultValue: string }) {
  const [v, setV] = useState(defaultValue);
  const i = INFO[kind];
  const handle = kind === "instagram" ? instagramHandle(v) : tiktokHandle(v);
  const href = kind === "instagram" ? (handle ? instagramUrl(handle) : null) : handle ? tiktokUrl(handle) : null;
  return (
    <div className="field">
      <label htmlFor={kind} className="row" style={{ gap: 6 }}><Icon name={i.icon} size="s" /> {i.label}</label>
      <input id={kind} name={kind} type="text" inputMode="url" value={v} onChange={(e) => setV(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={i.ph} />
      {!v.trim() && <span className="xs muted">{i.how}</span>}
      {v.trim() && (href
        ? <a className="link xs" href={href} target="_blank" rel="noopener noreferrer">Open this link ↗ — check it&apos;s your account{handle ? ` (@${handle})` : ""}</a>
        : <span className="err xs">{`Paste your ${kind === "instagram" ? "Instagram" : "TikTok"} profile link (not a post).`}</span>)}
    </div>
  );
}
