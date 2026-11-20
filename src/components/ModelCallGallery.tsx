"use client";
import { useRef, useState } from "react";

/**
 * Model Call inspiration gallery (2026-11-20): swipe through 1–3 photos of the look (+ the optional video as the last
 * slide), with dots and a "Photo 1 of 3" counter. Used on the student side and the partner page.
 */
export function ModelCallGallery({ photos, video, alt, ratio = "4 / 5", radius = 18 }: { photos: string[]; video?: string | null; alt: string; ratio?: string; radius?: number }) {
  const slides: { kind: "photo" | "video"; url: string }[] = [...photos.map((url) => ({ kind: "photo" as const, url })), ...(video ? [{ kind: "video" as const, url: video }] : [])];
  const [at, setAt] = useState(0);
  const track = useRef<HTMLDivElement | null>(null);
  if (!slides.length) return null;
  const go = (i: number) => { const t = track.current; if (t) t.scrollTo({ left: i * t.clientWidth, behavior: "smooth" }); };
  return (
    <div style={{ position: "relative", borderRadius: radius, overflow: "hidden", background: "#111" }}>
      <div ref={track} onScroll={(e) => { const t = e.currentTarget; setAt(Math.round(t.scrollLeft / Math.max(1, t.clientWidth))); }}
        style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none", aspectRatio: ratio }}>
        {slides.map((s, i) => (
          <div key={s.url} style={{ flex: "0 0 100%", scrollSnapAlign: "center", position: "relative" }}>
            {s.kind === "photo"
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={s.url} alt={`${alt} — inspiration ${i + 1}`} loading={i ? "lazy" : "eager"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              : <video src={s.url} controls playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000", display: "block" }} />}
          </div>
        ))}
      </div>
      <span style={{ position: "absolute", left: 10, top: 10, background: "rgba(10,10,10,.72)", color: "#F4F1EA", fontSize: 10, fontWeight: 800, letterSpacing: ".12em", padding: "5px 9px", borderRadius: 999, textTransform: "uppercase" }}>Inspiration</span>
      {slides.length > 1 && (
        <>
          <span style={{ position: "absolute", right: 10, top: 10, background: "rgba(10,10,10,.72)", color: "#F4F1EA", fontSize: 11, fontWeight: 700, padding: "4px 9px", borderRadius: 999 }}>{slides[at]?.kind === "video" ? "Video" : `${Math.min(at + 1, photos.length)} / ${photos.length}`}</span>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, display: "flex", justifyContent: "center", gap: 6 }}>
            {slides.map((s, i) => (
              <button key={s.url} type="button" aria-label={s.kind === "video" ? "Show the video" : `Show photo ${i + 1}`} onClick={() => go(i)}
                style={{ width: i === at ? 22 : 8, height: 8, borderRadius: 4, border: 0, padding: 0, cursor: "pointer", background: i === at ? "#F4F1EA" : "rgba(244,241,234,.45)", transition: "width .2s" }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
