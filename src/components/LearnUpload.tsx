"use client";
import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Icon } from "./Icon";

/**
 * Learn at Nearest uploads (owners): the class video or its cover, straight from the computer/phone to Blob storage,
 * stored private. The result goes into hidden fields the class form saves. Large videos upload in parts.
 */
export function LearnUpload({ userId, kind, has }: { userId: string; kind: "video" | "cover"; has?: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [access, setAccess] = useState("private");
  const [name, setName] = useState("");
  const [size, setSize] = useState("");
  const [preview, setPreview] = useState("");
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function pick(f: File | undefined) {
    if (!f) return;
    setError("");
    if (kind === "cover" && !/^image\/(jpeg|png|webp)$/.test(f.type)) return setError("Use a JPG, PNG or WebP picture.");
    if (kind === "cover" && f.size > 15 * 1024 * 1024) return setError("Use a picture under 15 MB.");
    if (kind === "video" && !/^video\/(mp4|quicktime|webm)$/.test(f.type)) return setError("Use an MP4, MOV or WebM video.");
    if (kind === "video" && f.size > 2 * 1024 * 1024 * 1024) return setError("Use a video under 2 GB.");
    setPct(0);
    try {
      const ext = (f.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
      const path = `learn/${userId}/${kind}/${Date.now()}.${ext}`;
      const opts = { handleUploadUrl: "/api/blob", multipart: f.size > 20 * 1024 * 1024, onUploadProgress: (e: { percentage: number }) => setPct(Math.round(e.percentage)) };
      let b;
      try { b = await upload(path, f, { access: "private", ...opts }); setAccess("private"); }
      catch { b = await upload(path, f, { access: "public", ...opts }); setAccess("public"); }
      setUrl(b.url);
      setName(f.name.slice(0, 150));
      setSize(String(f.size));
      if (kind === "cover") setPreview(URL.createObjectURL(f));
    } catch (e) {
      setError((e as Error).message || "Upload failed. Try again.");
    } finally {
      setPct(null);
      if (input.current) input.current.value = "";
    }
  }

  const busy = pct !== null;
  return (
    <div className="col" style={{ gap: 6 }}>
      <input type="hidden" name={kind} value={url} />
      <input type="hidden" name={`${kind}_access`} value={access} />
      {kind === "video" && <><input type="hidden" name="video_name" value={name} /><input type="hidden" name="video_size" value={size} /></>}
      <input ref={input} type="file" hidden accept={kind === "video" ? "video/mp4,video/quicktime,video/webm" : "image/jpeg,image/png,image/webp"} onChange={(e) => pick(e.target.files?.[0])} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview && <img src={preview} alt="New cover" style={{ width: 160, aspectRatio: "9 / 16", objectFit: "cover", borderRadius: 12 }} />}
      {kind === "video" && url && <span className="small"><Icon name="video" size="s" /> {name} uploaded — save to keep it</span>}
      <button className="btn ghost" type="button" disabled={busy} onClick={() => input.current?.click()}>
        <Icon name="upload" /> {busy ? `Uploading… ${pct}%` : url || has ? (kind === "video" ? "Replace the video" : "Replace the cover") : kind === "video" ? "Upload the class video (MP4, MOV, up to 2 GB)" : "Upload a cover picture"}
      </button>
      {busy && <div className="bar"><i style={{ width: `${pct}%` }} /></div>}
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}
