"use client";

/**
 * The 360° video "picture-in-picture" tile in the bottom-right corner of a look's photo (owner's design, 2026-11-09):
 * a rounded white-bordered square showing a still from the video, a "360°" mark with a turning arrow, and a red play
 * button. Tapping it opens the video pop-up.
 */
export function LookVideoTile({ src, onOpen, label = "Play the 360° video of this look" }: { src: string; onOpen: () => void; label?: string }) {
  return (
    <button type="button" onClick={onOpen} aria-label={label}
      style={{ position: "absolute", right: 10, bottom: 10, width: "32%", maxWidth: 150, minWidth: 96, aspectRatio: "0.95", padding: 0, border: "4px solid #FFF", borderRadius: 18, overflow: "hidden", background: "#222", cursor: "pointer", boxShadow: "0 6px 18px rgba(0,0,0,.35)", zIndex: 2 }}>
      <video src={`${src}#t=0.5`} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
      <span aria-hidden="true" style={{ position: "absolute", left: 6, bottom: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <svg width="46" height="22" viewBox="0 0 46 22" style={{ display: "block", filter: "drop-shadow(0 1px 2px rgba(255,255,255,.7))" }}>
          <text x="23" y="11" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="12" fill="#111">360°</text>
          <path d="M5 13.5 C 12 20, 34 20, 41 13.5" fill="none" stroke="#111" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M38 11.5 L41.5 13.5 L38.5 16.5" fill="none" stroke="#111" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ width: 30, height: 30, borderRadius: 15, background: "#E5191B", border: "2px solid #FFF", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,.4)" }}>
          <span style={{ width: 0, height: 0, marginLeft: 3, borderLeft: "10px solid #FFF", borderTop: "6px solid transparent", borderBottom: "6px solid transparent" }} />
        </span>
      </span>
    </button>
  );
}
