"use client";
import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { checkServiceVideo } from "@/app/pro/actions";

const MIN = 1, MAX = 3, VIDEO_SECONDS = 60, VIDEO_MB = 200;

/**
 * Model Call inspiration media (2026-11-20, owner): 1–3 photos REQUIRED (the look being practiced), plus one optional
 * video up to 60 seconds. Fills hidden "photoUrls" (one per photo) and "videoUrl" fields.
 */
export function ModelCallPhoto({ userId, photos: start = [], video: startVideo = "" }: { userId: string; photos?: string[]; video?: string }) {
  const [photos, setPhotos] = useState<string[]>(start.slice(0, MAX));
  const [video, setVideo] = useState(startVideo);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function addPhotos(files: FileList | null) {
    const list = Array.from(files ?? []).slice(0, MAX - photos.length);
    if (!list.length) return;
    setErr("");
    try {
      for (const [i, f] of list.entries()) {
        if (!f.type.startsWith("image/")) { setErr("Photos only here — add a video below."); continue; }
        setBusy(`Uploading photo ${i + 1} of ${list.length}…`);
        const b = await upload(`pros/${userId}/modelcalls/${Date.now()}-${f.name.replace(/[^a-z0-9.]/gi, "")}`, f, { access: "public", handleUploadUrl: "/api/blob" });
        setPhotos((p) => [...p, b.url].slice(0, MAX));
      }
    } catch { setErr("A photo didn't upload. Try again."); } finally { setBusy(""); }
  }

  async function addVideo(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setErr("");
    const type = f.type || (f.name.toLowerCase().endsWith(".mov") ? "video/quicktime" : "video/mp4");
    if (!["video/mp4", "video/quicktime"].includes(type)) return setErr("Use an MP4, or a video straight from your phone's camera.");
    if (f.size > VIDEO_MB * 1024 * 1024) return setErr(`That video is over ${VIDEO_MB} MB. Trim it and try again.`);
    try {
      const b = await upload(`pros/${userId}/look-video/${Date.now()}.${type === "video/quicktime" ? "mov" : "mp4"}`, f, {
        access: "public", handleUploadUrl: "/api/blob", contentType: type, onUploadProgress: (p) => setBusy(`Uploading video… ${Math.round(p.percentage)}%`),
      });
      setBusy("Checking the length…");
      const r = await checkServiceVideo(b.url);
      if (r.error) setErr(r.error); else setVideo(b.url);
    } catch { setErr("The video didn't upload. Try again."); } finally { setBusy(""); }
  }

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="mc-photos">Inspiration photos <span className="muted">(required — {MIN} to {MAX})</span></label>
        {photos.map((u) => <input key={u} type="hidden" name="photoUrls" value={u} />)}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          {photos.map((u, i) => (
            <div key={u} style={{ position: "relative", aspectRatio: "4 / 5", borderRadius: 14, overflow: "hidden", background: "#1C1C1F" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Inspiration photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {i === 0 && <span style={{ position: "absolute", left: 6, top: 6, background: "rgba(10,10,10,.75)", color: "#ECE8E1", fontSize: 10, fontWeight: 800, letterSpacing: ".08em", padding: "3px 7px", borderRadius: 8 }}>COVER</span>}
              <button type="button" onClick={() => setPhotos((p) => p.filter((x) => x !== u))} aria-label={`Remove photo ${i + 1}`}
                style={{ position: "absolute", right: 6, top: 6, width: 28, height: 28, borderRadius: 14, border: 0, background: "rgba(10,10,10,.75)", color: "#ECE8E1", cursor: "pointer" }}>×</button>
            </div>
          ))}
          {photos.length < MAX && (
            <label htmlFor="mc-photos" style={{ aspectRatio: "4 / 5", borderRadius: 14, border: "1.5px dashed #6B6760", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", fontSize: 12, textAlign: "center", padding: 6 }}>
              <span style={{ fontSize: 26, lineHeight: 1 }}>+</span>{photos.length ? "Add another" : "Add photo"}
            </label>
          )}
        </div>
        <input id="mc-photos" type="file" accept="image/*" multiple hidden disabled={Boolean(busy)} onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
        <span className="xs muted">Show the exact look you&apos;re practicing. The first photo is the cover.</span>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="mc-video">Video <span className="muted">(optional — up to {VIDEO_SECONDS} seconds)</span></label>
        <input type="hidden" name="videoUrl" value={video} />
        {video ? (
          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <video src={video} muted playsInline preload="metadata" style={{ width: 96, height: 120, objectFit: "cover", borderRadius: 12, background: "#000" }} />
            <button type="button" className="btn ghost sm" onClick={() => setVideo("")}>Remove video</button>
          </div>
        ) : <input id="mc-video" type="file" accept="video/mp4,video/quicktime" disabled={Boolean(busy)} onChange={(e) => { addVideo(e.target.files); e.target.value = ""; }} />}
      </div>
      <span className={`xs ${err ? "err" : "muted"}`} role={err ? "alert" : undefined}>{err || busy || (photos.length < MIN ? "Add at least one inspiration photo to publish." : "")}</span>
    </div>
  );
}
