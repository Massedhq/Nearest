"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LookVideoTile } from "./LookVideoTile";

type Photo = { id: string; url: string; serviceName: string | null; price: string | null; bookHref: string | null; kind?: string; durationSec?: number | null;
  // One look (2026-11-09): more photos of the same look and a 360° video, opened from the 360° video tile in the photo's corner.
  more?: string[]; lookVideo?: string | null; lookVideoSec?: number | null };

/** Portfolio on a pro's profile: tap a photo or video to see it full-screen and "Book this look". */
export function PortfolioViewer({ photos, bookingOpen }: { photos: Photo[]; bookingOpen: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const [shot, setShot] = useState(0); // which photo of the look is showing
  const [playing, setPlaying] = useState(false); // the look's 360° video pop-up
  useEffect(() => { setShot(0); setPlaying(false); }, [open]);
  const touchX = useRef<number | null>(null);
  const go = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length)), [photos.length]);

  useEffect(() => {
    if (open === null) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { if (playing) { setPlaying(false); return; } setOpen(null); } if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = ""; };
  }, [open, go, playing]);

  const p = open === null ? null : photos[open];
  const shots = p && p.kind !== "video" ? [p.url, ...(p.more ?? [])] : [];
  return (
    <>
      <div className="grid3">
        {photos.map((ph, i) => (
          <button key={ph.id} type="button" className="ph" onClick={() => setOpen(i)}
            aria-label={`${ph.kind === "video" ? "Play video" : "View photo"}${ph.serviceName ? ` of ${ph.serviceName}` : ""}`}
            style={{ height: 112, padding: 0, border: 0, cursor: "pointer" }}>
            {ph.kind === "video" ? (
              <>
                <video src={`${ph.url}#t=0.1`} muted playsInline preload="metadata" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
                <span className="vid-badge"><span className="vid-play" />{ph.durationSec ? `${Math.round(ph.durationSec)}s` : ""}</span>
              </>
            ) : (
              <>
                <Image src={ph.url} alt={ph.serviceName ?? "Portfolio work"} fill sizes="140px" style={{ objectFit: "cover" }} />
                {(ph.lookVideo || (ph.more ?? []).length > 0) && <span className="vid-badge" aria-hidden="true">{ph.lookVideo ? <><span className="vid-play" />360°</> : `+${(ph.more ?? []).length}`}</span>}
              </>
            )}
          </button>
        ))}
      </div>

      {p && (
        <div role="dialog" aria-modal="true" aria-label={p.kind === "video" ? "Portfolio video" : "Portfolio photo"} onClick={() => setOpen(null)}
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { if (touchX.current === null) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touchX.current = null; }}
          style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,.94)", display: "flex", flexDirection: "column", padding: "calc(14px + env(safe-area-inset-top,0px)) 14px calc(18px + env(safe-area-inset-bottom,0px))", gap: 14 }}>
          <div className="row between" onClick={(e) => e.stopPropagation()}>
            <span className="small muted">{(open ?? 0) + 1} of {photos.length}</span>
            <button type="button" className="link small" onClick={() => setOpen(null)}>Close</button>
          </div>
          <div style={{ flex: 1, position: "relative" }} onClick={(e) => e.stopPropagation()}>
            {p.kind === "video" ? (
              <video key={p.id} src={p.url} controls autoPlay playsInline loop
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
            ) : (
              <>
                <Image key={shots[shot]} src={shots[shot] ?? p.url} alt={p.serviceName ?? "Portfolio work"} fill sizes="100vw" style={{ objectFit: "contain" }} priority />
                {p.lookVideo && <LookVideoTile src={p.lookVideo} onOpen={() => setPlaying(true)} />}
              </>
            )}
            {photos.length > 1 && (
              <>
                <button type="button" aria-label="Previous" className="iconbtn" onClick={() => go(-1)} style={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)" }}>‹</button>
                <button type="button" aria-label="Next" className="iconbtn" onClick={() => go(1)} style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)" }}>›</button>
              </>
            )}
          </div>
          {shots.length > 1 && (
            <div className="row" style={{ gap: 6, justifyContent: "center", flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()} aria-label="Photos of this look">
              {shots.map((u, i) => (
                <button key={u} type="button" onClick={() => setShot(i)} aria-label={`Photo ${i + 1} of this look`} aria-pressed={i === shot}
                  style={{ width: 48, height: 48, padding: 0, borderRadius: 8, overflow: "hidden", border: i === shot ? "2px solid #E8C4C0" : "1px solid #3A3A3F", cursor: "pointer", position: "relative", background: "#111" }}>
                  <Image src={u} alt="" fill sizes="48px" style={{ objectFit: "cover" }} />
                </button>
              ))}
            </div>
          )}
          <div className="col" style={{ gap: 8 }} onClick={(e) => e.stopPropagation()}>
            {p.serviceName && <span className="small" style={{ textAlign: "center" }}><span className="b">{p.serviceName}</span>{p.price ? ` • ${p.price}` : ""}</span>}
            {bookingOpen
              ? <Link className="btn" href={p.bookHref ?? "#services"} onClick={() => setOpen(null)}>Book this look</Link>
              : <button className="btn dis" type="button" disabled>Booking isn&apos;t open yet</button>}
          </div>
          {playing && p.lookVideo && (
            <div role="dialog" aria-modal="true" aria-label="Video of this look" onClick={(e) => { e.stopPropagation(); setPlaying(false); }}
              style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
              <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#0B0B0C", border: "1px solid #2A2A2E", borderRadius: 18, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="row between"><span className="small b">{p.serviceName ? `${p.serviceName} — ` : ""}360° video{p.lookVideoSec ? ` · ${Math.round(p.lookVideoSec)}s` : ""}</span><button type="button" className="link small" onClick={() => setPlaying(false)}>Close</button></div>
                <video src={p.lookVideo} controls autoPlay playsInline style={{ width: "100%", maxHeight: "70vh", borderRadius: 12, background: "#000" }} />
                {bookingOpen && <Link className="btn" href={p.bookHref ?? "#services"} onClick={() => { setPlaying(false); setOpen(null); }}>Book this look</Link>}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
