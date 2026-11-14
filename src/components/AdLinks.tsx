"use client";
import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { adSlug } from "@/lib/ad-links";

/**
 * Ready-made ad links for online voting (/vote). Pick the platform and the campaign from the lists — the link is
 * built for you (utm_source + utm_campaign), and every platform's link is listed with Copy.
 */
export const AD_PLATFORMS = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "google", label: "Google" },
] as const;

export function AdLinks({ site, campaigns }: { site: string; campaigns: string[] }) {
  const names = campaigns.length ? campaigns : ["Vote"];
  const [platform, setPlatform] = useState<string>("facebook");
  const [campaign, setCampaign] = useState<string>(names[0]);
  const link = (p: string) => `${site}/vote?utm_source=${p}&utm_campaign=${adSlug(campaign)}`;
  const field = { width: "auto", minWidth: 160 } as const;
  return (
    <div className="col" style={{ gap: 8 }}>
      <span className="b small">Ad links for online voting</span>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select className="field" value={platform} onChange={(e) => setPlatform(e.target.value)} style={field} aria-label="Platform">
          {AD_PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select className="field" value={campaign} onChange={(e) => setCampaign(e.target.value)} style={field} aria-label="Campaign">
          {names.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="row between" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <code className="small" style={{ wordBreak: "break-all" }}>{link(platform)}</code>
        <CopyButton text={link(platform)} />
      </div>
      <details>
        <summary className="xs muted" style={{ cursor: "pointer" }}>All platforms for this campaign</summary>
        <div className="col" style={{ gap: 6, marginTop: 6 }}>
          {AD_PLATFORMS.map((p) => (
            <div key={p.id} className="row between" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="xs"><span className="b">{p.label}</span> <span className="muted" style={{ wordBreak: "break-all" }}>{link(p.id)}</span></span>
              <CopyButton text={link(p.id)} />
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
