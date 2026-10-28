"use client";
import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Icon } from "./Icon";

/**
 * Partner shop uploads, straight from the phone to Blob storage. The result goes into hidden form fields that the
 * product form saves. Photos are public; digital downloads are stored private when the store allows it.
 */
export function ShopUpload({ userId, kind, name, initialUrl, initialLabel, initialAccess, initialSize }: { userId: string; kind: "photo" | "file"; name: string; initialUrl?: string | null; initialLabel?: string | null; initialAccess?: string | null; initialSize?: number | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl ?? "");
  const [label, setLabel] = useState(initialLabel ?? "");
  const [access, setAccess] = useState(initialAccess ?? "private");
  const [size, setSize] = useState(initialSize ? String(initialSize) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pick(f: File | undefined) {
    if (!f) return;
    setError("");
    setBusy(true);
    try {
      const ext = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6);
      if (kind === "photo") {
        const b = await upload(`pros/${userId}/shop/${Date.now()}.${ext}`, f, { access: "public", handleUploadUrl: "/api/blob" });
        setUrl(b.url);
      } else {
        const path = `pros/${userId}/shop-file/${Date.now()}.${ext}`;
        let b;
        try { b = await upload(path, f, { access: "private", handleUploadUrl: "/api/blob", multipart: f.size > 20 * 1024 * 1024 }); setAccess("private"); }
        catch { b = await upload(path, f, { access: "public", handleUploadUrl: "/api/blob", multipart: f.size > 20 * 1024 * 1024 }); setAccess("public"); }
        setUrl(b.url);
        setLabel(f.name.slice(0, 120));
        setSize(String(f.size));
      }
    } catch (e) {
      setError((e as Error).message || (kind === "photo" ? "Upload failed. Try a JPG or PNG under 15 MB." : "Upload failed. Try a PDF, ZIP, MP4 or MP3 under 200 MB."));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="col" style={{ gap: 6 }}>
      <input type="hidden" name={name} value={url} />
      {kind === "file" && <><input type="hidden" name={`${name}_access`} value={access} /><input type="hidden" name={`${name}_name`} value={label} /><input type="hidden" name={`${name}_size`} value={size} /></>}
      <input ref={input} type="file" hidden accept={kind === "photo" ? "image/jpeg,image/png,image/webp" : ".pdf,.zip,.epub,.mp4,.mp3,.m4a,.jpg,.jpeg,.png"} onChange={(e) => pick(e.target.files?.[0])} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {kind === "photo" && url && <img src={url} alt="Product photo" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12 }} />}
      {kind === "file" && url && <span className="small"><Icon name="file" size="s" /> {label || "File uploaded"}</span>}
      <button className="btn ghost" type="button" disabled={busy} onClick={() => input.current?.click()}>
        <Icon name="upload" /> {busy ? "Uploading…" : url ? (kind === "photo" ? "Change photo" : "Replace file") : kind === "photo" ? "Add a product photo" : "Upload the download (PDF, ZIP, MP4, MP3)"}
      </button>
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}
