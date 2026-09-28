"use client";
import { useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { connectionsForShare, shareProWith } from "@/app/connection-actions";

type Person = { id: string; name: string; school: string | null };

/** Share a professional: Send to a Connection (only accepted connections), Copy link, or the phone's share menu. */
export function ShareProButton({ proId, proName, link, compact = false }: { proId: string; proName: string; link: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function openSheet() {
    setOpen(true); setMsg(""); setPicked([]); setQ("");
    if (!people) { try { setPeople(await connectionsForShare()); } catch { setPeople([]); } }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setMsg("Link copied."); } catch { setMsg(link); }
  }
  async function nativeShare() {
    if (navigator.share) { try { await navigator.share({ title: proName, text: `Check out ${proName} on Nearest`, url: link }); } catch { /* cancelled */ } }
    else void copy();
  }
  async function send() {
    setBusy(true); setMsg("");
    const r = await shareProWith(proId, picked).catch(() => ({ error: "That didn't send. Try again." }));
    setBusy(false);
    if ("error" in r && r.error) setMsg(r.error); else { setMsg(("ok" in r && r.ok) || "Sent."); setPicked([]); }
  }
  const shown = (people ?? []).filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <button type="button" className={compact ? "iconbtn" : "btn ghost sm"} onClick={openSheet} aria-label={`Share ${proName}`} style={compact ? { width: 36, height: 36 } : undefined}>
        <svg className="i s" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
        {!compact && " Share"}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "16px 16px calc(16px + env(safe-area-inset-bottom,0px))" }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, gap: 12, background: "#0E0E10", maxHeight: "85vh", overflowY: "auto" }}>
            <div className="row between"><h2 id="share-title" className="disp h2">Share with a Connection</h2><button type="button" className="link small" onClick={() => setOpen(false)}>Close</button></div>
            <span className="small muted">{proName}</span>
            {people === null ? <span className="small muted">Loading your connections…</span> : people.length === 0 ? (
              <div className="col" style={{ gap: 6 }}>
                <span className="small">You don&apos;t have any connections yet.</span>
                <Link className="link small" href="/connections">Find classmates in Connections</Link>
              </div>
            ) : (
              <>
                <div className="field"><label htmlFor="share-q" className="row" style={{ gap: 6 }}><Icon name="search" size="s" /> Search your connections</label><input id="share-q" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" /></div>
                <div className="col" style={{ gap: 4 }}>
                  {shown.map((p) => {
                    const on = picked.includes(p.id);
                    return (
                      <button key={p.id} type="button" className="item" aria-pressed={on} onClick={() => setPicked((x) => (on ? x.filter((i) => i !== p.id) : [...x, p.id]))}
                        style={{ textAlign: "left", width: "100%", background: on ? "#1C1C1F" : "transparent", border: 0, color: "inherit", font: "inherit", cursor: "pointer" }}>
                        <span className="grow"><span className="b">{p.name}</span>{p.school && <span className="xs muted"> • {p.school}</span>}</span>
                        <span className={`tag ${on ? "ok" : ""}`}>{on ? "Selected" : "Select"}</span>
                      </button>
                    );
                  })}
                  {shown.length === 0 && <span className="small muted">No connection matches “{q}”.</span>}
                </div>
                <button className="btn" type="button" onClick={send} disabled={busy || picked.length === 0}>{busy ? "Sending…" : picked.length ? `Send to ${picked.length}` : "Send"}</button>
              </>
            )}
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn ghost sm" onClick={copy} style={{ flex: 1 }}>Copy link</button>
              <button type="button" className="btn ghost sm" onClick={nativeShare} style={{ flex: 1 }}>Share…</button>
            </div>
            {msg && <p className="small" role="status" style={{ margin: 0, wordBreak: "break-all" }}>{msg}</p>}
          </div>
        </div>
      )}
    </>
  );
}
