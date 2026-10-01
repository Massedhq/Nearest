"use client";
import { useState } from "react";
import { Icon } from "./Icon";

/** Student "Invite friends" card: share or copy their link. */
export function InviteFriends({ link, joined, verified, available }: { link: string; joined: number; verified: number; available: number }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const text = "Join me on Nearest — we both get $5 off a booking when you sign up with my link.";
    try {
      if (navigator.share) { await navigator.share({ title: "Nearest", text, url: link }); return; }
    } catch { return; }
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  return (
    <div className="card" id="invite" style={{ gap: 10, scrollMarginTop: 80 }}>
      <div className="row"><Icon name="users" /><span className="b grow">Invite friends, get $5</span>{available > 0 && <span className="tag ok">${available * 5} to use</span>}</div>
      <span className="small">Share your link. When a friend signs up and gets verified, you <span className="b">both</span> get $5 off a booking — for every friend who joins.</span>
      <div className="row" style={{ gap: 8 }}>
        <code className="small grow" style={{ wordBreak: "break-all" }}>{link}</code>
      </div>
      <div className="grid2" style={{ gap: 8 }}>
        <button type="button" className="btn sm" onClick={share}><Icon name="send" size="s" /> Share</button>
        <button type="button" className="btn ghost sm" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } }}>{copied ? "Copied" : "Copy link"}</button>
      </div>
      <span className="xs muted">{joined === 0 ? "No friends have joined yet." : `${joined} friend${joined === 1 ? "" : "s"} joined • ${verified} verified.`} Rewards: one $5 per booking, on your first booking with a professional.</span>
    </div>
  );
}
