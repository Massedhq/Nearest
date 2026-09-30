"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Icon } from "./Icon";
import { MAX_VIDEO_SECONDS, MAX_VIDEO_MB } from "@/lib/portfolio-limits";

type Save = (url: string) => Promise<{ error?: string }>;

/** Reads a video's length in the browser before uploading anything. */
function lengthOf(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    const src = URL.createObjectURL(file);
    const done = (n: number | null) => { URL.revokeObjectURL(src); resolve(n); };
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? v.duration : null);
    v.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    v.src = src;
  });
}

/**
 * Portfolio video upload: one video at a time, MP4 or iPhone MOV, 15 seconds max.
 * The length is checked here first (so nothing over 15 seconds is uploaded), then again on the server from the file.
 */
export function VideoUploader({ userId, save, label }: { userId: string; save: Save; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function onPick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setError("");
    try {
      const type = f.type || (f.name.toLowerCase().endsWith(".mov") ? "video/quicktime" : f.name.toLowerCase().endsWith(".mp4") ? "video/mp4" : "");
      if (!["video/mp4", "video/quicktime"].includes(type)) { setError("Use an MP4, or a video straight from your phone's camera."); return; }
      if (f.size > MAX_VIDEO_MB * 1024 * 1024) { setError(`That video is too large (over ${MAX_VIDEO_MB} MB). Trim it or record at a lower quality.`); return; }
      setBusy("Checking length…");
      const secs = await lengthOf(f);
      if (secs !== null && secs > MAX_VIDEO_SECONDS + 0.5) {
        setError(`This video is ${Math.round(secs)} seconds. Videos can be up to ${MAX_VIDEO_SECONDS} seconds — trim it and try again.`);
        return;
      }
      const ext = type === "video/quicktime" ? "mov" : "mp4";
      const blob = await upload(`pros/${userId}/portfolio-video/${Date.now()}.${ext}`, f, {
        access: "public", handleUploadUrl: "/api/blob", contentType: type,
        onUploadProgress: (p) => setBusy(`Uploading… ${Math.round(p.percentage)}%`),
      });
      setBusy("Saving…");
      const res = await save(blob.url);
      if (res.error) setError(res.error);
      router.refresh();
    } catch (e) {
      setError((e as Error).message || "Upload failed. Try again on Wi-Fi.");
    } finally {
      setBusy("");
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="col" style={{ gap: 6 }}>
      <input ref={input} type="file" accept="video/mp4,video/quicktime,.mp4,.mov" hidden onChange={(e) => onPick(e.target.files)} />
      <button className="btn ghost" type="button" disabled={!!busy} onClick={() => input.current?.click()}>
        <Icon name="upload" /> {busy || label}
      </button>
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}
