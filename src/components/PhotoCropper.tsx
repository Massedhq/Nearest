"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Full-screen photo framer: drag the photo to move it, pinch or use the slider to zoom, then Use photo.
 * Returns a square JPEG (1024 px) of exactly what's inside the frame. `round` shows a circle guide (profile photos).
 */
export function PhotoCropper({ src, round = true, onCancel, onDone }: { src: string; round?: boolean; onCancel: () => void; onDone: (blob: Blob) => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState(300);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const s = Math.max(220, Math.min(340, window.innerWidth - 48, window.innerHeight - 280));
    setSize(s);
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => {
      setImg(im);
      const base = s / Math.min(im.naturalWidth, im.naturalHeight);
      const w = im.naturalWidth * base, h = im.naturalHeight * base;
      // Start centered side to side and near the top, where faces usually are.
      setPos({ x: (s - w) / 2, y: h > s ? Math.max(s - h, -(h - s) * 0.15) : 0 });
    };
    im.onerror = () => setFailed(true);
    im.src = src;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [src]);

  const base = img ? size / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const scale = base * zoom;
  const w = img ? img.naturalWidth * scale : size, h = img ? img.naturalHeight * scale : size;
  const clamp = (p: { x: number; y: number }, ww = w, hh = h) => ({ x: Math.min(0, Math.max(size - ww, p.x)), y: Math.min(0, Math.max(size - hh, p.y)) });

  function setZoomAround(z: number) {
    if (!img) return;
    const nz = Math.min(4, Math.max(1, z));
    const ns = base * nz;
    const nw = img.naturalWidth * ns, nh = img.naturalHeight * ns;
    // Keep the middle of the frame on the same spot of the photo.
    const cx = (size / 2 - pos.x) / scale, cy = (size / 2 - pos.y) / scale;
    setZoom(nz);
    setPos(clamp({ x: size / 2 - cx * ns, y: size / 2 - cy * ns }, nw, nh));
  }

  function down(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  }
  function move(e: React.PointerEvent) {
    const last = pointers.current.get(e.pointerId);
    if (!last) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      setZoomAround(pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist));
    } else {
      setPos((p) => clamp({ x: p.x + now.x - last.x, y: p.y + now.y - last.y }));
    }
  }
  function up(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  async function use() {
    if (!img) return;
    setBusy(true);
    try {
      const out = 1024;
      const c = document.createElement("canvas");
      c.width = out; c.height = out;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, out, out);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, -pos.x / scale, -pos.y / scale, size / scale, size / scale, 0, 0, out, out);
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.9));
      if (!blob) throw new Error("no blob");
      onDone(blob);
    } catch { setFailed(true); setBusy(false); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Adjust your photo" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 24 }}>
      <span className="disp h2" style={{ color: "#ECE8E1", textAlign: "center" }}>Adjust your photo</span>
      <span className="small" style={{ color: "#A8A399", textAlign: "center", maxWidth: 340 }}>Drag to move it. Pinch or use the slider to zoom. Keep your whole face inside the circle.</span>
      {failed ? (
        <p className="err" role="alert" style={{ maxWidth: 320, textAlign: "center" }}>This photo couldn&apos;t be opened here. Try a JPG or PNG from your camera roll.</p>
      ) : (
        <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          style={{ position: "relative", width: size, height: size, overflow: "hidden", borderRadius: 12, background: "#111", touchAction: "none", cursor: "grab", userSelect: "none" }}>
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" draggable={false} crossOrigin="anonymous" style={{ position: "absolute", left: pos.x, top: pos.y, width: w, height: h, maxWidth: "none", pointerEvents: "none" }} />
          )}
          <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: round ? "50%" : 12, boxShadow: "0 0 0 9999px rgba(0,0,0,.55)", border: "2px solid rgba(255,255,255,.85)" }} />
          {!img && <span className="small" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#A8A399" }}>Loading…</span>}
        </div>
      )}
      <label className="row small" style={{ gap: 10, width: size, color: "#A8A399" }}>
        <span>Zoom</span>
        <input type="range" min={1} max={4} step={0.01} value={zoom} disabled={!img} onChange={(e) => setZoomAround(Number(e.target.value))} style={{ flex: 1 }} aria-label="Zoom" />
      </label>
      <div className="row" style={{ gap: 10, width: size }}>
        <button type="button" onClick={onCancel} disabled={busy} style={{ flex: 1, minHeight: 48, borderRadius: 24, border: "1px solid #3A3A3F", background: "transparent", color: "#ECE8E1", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", fontSize: 13 }}>Cancel</button>
        <button type="button" onClick={use} disabled={!img || busy || failed} style={{ flex: 1, minHeight: 48, borderRadius: 24, border: 0, background: "#ECE8E1", color: "#0A0A0A", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", fontSize: 13 }}>{busy ? "Saving…" : "Use photo"}</button>
      </div>
    </div>
  );
}
