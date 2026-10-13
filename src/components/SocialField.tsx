"use client";
import { useState } from "react";
import { Icon } from "./Icon";
import { instagramHandle, tiktokHandle, facebookHandle, instagramUrl, tiktokUrl, facebookUrl, facebookLabel, pinterestHandle, pinterestUrl } from "@/lib/social";

const INFO = {
  instagram: { label: "Instagram profile link", icon: "insta", ph: "https://www.instagram.com/yourname", how: "In Instagram: your profile → Share profile → Copy link, then paste it here." },
  facebook: { label: "Facebook page or profile link", icon: "facebook", ph: "https://www.facebook.com/yourpage", how: "In Facebook: go to your page or profile → ⋯ → Copy link, then paste it here." },
  pinterest: { label: "Pinterest profile link", icon: "pinterest", ph: "https://www.pinterest.com/yourname", how: "In Pinterest: your profile → Share → Copy link, then paste it here. If it starts with pin.it, open it first and copy the full pinterest.com link." },
  tiktok: { label: "TikTok profile link", icon: "tiktok", ph: "https://www.tiktok.com/@yourname", how: "In TikTok: Profile → Share profile → Copy link, then paste it here." },
} as const;

/** A link field: paste the profile link, see the live link, tap it to check it's the right account. */
export function SocialField({ kind, defaultValue }: { kind: "instagram" | "tiktok" | "facebook" | "pinterest"; defaultValue: string }) {
  const [v, setV] = useState(defaultValue);
  const i = INFO[kind];
  const handle = kind === "instagram" ? instagramHandle(v) : kind === "facebook" ? facebookHandle(v) : kind === "pinterest" ? pinterestHandle(v) : tiktokHandle(v);
  const href = !handle ? null : kind === "instagram" ? instagramUrl(handle) : kind === "facebook" ? facebookUrl(handle) : kind === "pinterest" ? pinterestUrl(handle) : tiktokUrl(handle);
  const shown = handle ? (kind === "facebook" ? (handle.startsWith("id:") ? "" : ` (${facebookLabel(handle)})`) : ` (@${handle})`) : "";
  return (
    <div className="field">
      <label htmlFor={kind} className="row" style={{ gap: 6 }}><Icon name={i.icon} size="s" /> {i.label}</label>
      <input id={kind} name={kind} type="text" inputMode="url" value={v} onChange={(e) => setV(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={i.ph} />
      {!v.trim() && <span className="xs muted">{i.how}</span>}
      {v.trim() && (href
        ? <a className="link xs" href={href} target="_blank" rel="noopener noreferrer">Open this link ↗ — check it&apos;s your account{shown}</a>
        : <span className="err xs">{`Paste your ${kind === "instagram" ? "Instagram" : kind === "facebook" ? "Facebook page or" : kind === "pinterest" ? "full Pinterest" : "TikTok"} profile link (not a post).`}</span>)}
    </div>
  );
}
