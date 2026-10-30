"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Icon } from "./Icon";
import { addReviewPhotos, addReviewVideo } from "@/app/pro/review-media-actions";
import { REVIEW_MEDIA_MAX, REVIEW_VIDEO_MAX, REVIEW_VIDEO_MB, REVIEW_VIDEO_SECONDS, reviewMediaFolder } from "@/lib/review-media";

function lengthOf(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    const src = URL.createObjectURL(file);
    const done = (n: number | null) => { URL.revokeObjectURL(src); resolve(n); };
    v.preload = "metadata"; v.muted = true;
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? v.duration : null);
    v.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    v.src = src;
  });
}

/** Pro: add photos and videos from this appointment to the client's review. */
export function ReviewMediaUploader({ userId, bookingId, count, videos }: { userId: string; bookingId: string; count: number; videos: number }) {
  const photoIn = useRef<HTMLInputElement>(null);
  const videoIn = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const full = count >= REVIEW_MEDIA_MAX;

  async function photos(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const urls: string[] = [];
    try {
      const list = Array.from(files).slice(0, REVIEW_MEDIA_MAX - count);
      for (let i = 0; i < list.length; i++) {
        setBusy(`Uploading ${i + 1} of ${list.length}…`);
        const f = list[i];
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const r = await upload(`${reviewMediaFolder(userId, bookingId, "image")}${Date.now()}.${ext}`, f, { access: "public", handleUploadUrl: "/api/blob" });
        urls.push(r.url);
      }
      setBusy("Saving…");
      const res = await addReviewPhotos(bookingId, urls);
      if (res.error) setError(res.error);
      router.refresh();
    } catch (e) { setError((e as Error).message || "Upload failed. Try a JPG or PNG under 15 MB."); }
    finally { setBusy(""); if (photoIn.current) photoIn.current.value = ""; }
  }

  async function video(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setError("");
    try {
      const type = f.type || (f.name.toLowerCase().endsWith(".mov") ? "video/quicktime" : f.name.toLowerCase().endsWith(".mp4") ? "video/mp4" : "");
      if (!["video/mp4", "video/quicktime"].includes(type)) { setError("Use an MP4, or a video straight from your phone's camera."); return; }
      if (f.size > REVIEW_VIDEO_MB * 1024 * 1024) { setError(`That video is too large (over ${REVIEW_VIDEO_MB} MB). Trim it or record at a lower quality.`); return; }
      setBusy("Checking length…");
      const secs = await lengthOf(f);
      if (secs !== null && secs > REVIEW_VIDEO_SECONDS + 0.5) { setError(`This video is ${Math.round(secs)} seconds. Review videos can be up to ${REVIEW_VIDEO_SECONDS} seconds — trim it and try again.`); return; }
      const r = await upload(`${reviewMediaFolder(userId, bookingId, "video")}${Date.now()}.${type === "video/quicktime" ? "mov" : "mp4"}`, f, {
        access: "public", handleUploadUrl: "/api/blob", contentType: type, onUploadProgress: (p) => setBusy(`Uploading… ${Math.round(p.percentage)}%`),
      });
      setBusy("Saving…");
      const res = await addReviewVideo(bookingId, r.url);
      if (res.error) setError(res.error);
      router.refresh();
    } catch (e) { setError((e as Error).message || "Upload failed. Try again on Wi-Fi."); }
    finally { setBusy(""); if (videoIn.current) videoIn.current.value = ""; }
  }

  return (
    <div className="col" style={{ gap: 8 }}>
      <input ref={photoIn} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => photos(e.target.files)} />
      <input ref={videoIn} type="file" accept="video/mp4,video/quicktime,.mp4,.mov" hidden onChange={(e) => video(e.target.files)} />
      {busy ? <span className="small" role="status">{busy}</span> : (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn ghost sm" style={{ width: "auto" }} type="button" disabled={full} onClick={() => photoIn.current?.click()}><Icon name="camera" size="s" /> Add photos</button>
          <button className="btn ghost sm" style={{ width: "auto" }} type="button" disabled={full || videos >= REVIEW_VIDEO_MAX} onClick={() => videoIn.current?.click()}><Icon name="upload" size="s" /> Add a video</button>
        </div>
      )}
      <span className="xs muted">Up to {REVIEW_MEDIA_MAX} in all ({REVIEW_VIDEO_MAX} videos, {REVIEW_VIDEO_SECONDS} seconds each).</span>
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}
