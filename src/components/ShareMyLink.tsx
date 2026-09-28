"use client";
import { useState } from "react";

/** Pro dashboard: their public booking link with Copy and the phone's Share menu. */
export function ShareMyLink({ link, name }: { link: string; name: string }) {
  const [msg, setMsg] = useState("");
  const shown = link.replace(/^https?:\/\//, "");
  return (
    <div className="card" style={{ gap: 10 }}>
      <span className="eyebrow">Your booking link</span>
      <span className="b" style={{ wordBreak: "break-all" }}>{shown}</span>
      <span className="xs muted">Put it in your Instagram bio and share it anywhere — students tap it to see your work and book you.</span>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn sm" style={{ flex: 1 }} onClick={async () => { try { await navigator.clipboard.writeText(link); setMsg("Link copied."); } catch { setMsg(shown); } }}>Copy link</button>
        <button type="button" className="btn ghost sm" style={{ flex: 1 }} onClick={async () => {
          if (navigator.share) { try { await navigator.share({ title: `${name} on Nearest`, text: `Book me on Nearest`, url: link }); } catch { /* cancelled */ } }
          else { try { await navigator.clipboard.writeText(link); setMsg("Link copied."); } catch { setMsg(shown); } }
        }}>Share…</button>
      </div>
      {msg && <span className="xs" role="status">{msg}</span>}
    </div>
  );
}
