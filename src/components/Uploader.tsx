"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Icon } from "./Icon";
import { PhotoCropper } from "./PhotoCropper";

type Save = (urls: string[]) => Promise<{ error?: string }>;

/**
 * Uploads photos straight to Blob storage, then records them with `save`. With `crop`, a single photo opens the
 * framer first (drag, pinch/zoom) and the framed square is uploaded; `current` adds "Adjust my current photo".
 */
export function Uploader({ userId, folder, save, multiple = true, label, root = "pros", accept = "image/jpeg,image/png,image/webp", crop = false, current }: { userId: string; folder: string; save: Save; multiple?: boolean; label: string; root?: "pros" | "students"; accept?: string; crop?: boolean; current?: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [cropSrc, setCropSrc] = useState("");

  async function uploadFramed(blob: Blob) {
    if (cropSrc.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    setCropSrc("");
    setError("");
    try {
      setBusy("Uploading…");
      const r = await upload(`${root}/${userId}/${folder}/${Date.now()}.jpg`, blob, { access: "public", handleUploadUrl: "/api/blob", contentType: "image/jpeg" });
      const res = await save([r.url]);
      if (res.error) setError(res.error);
      router.refresh();
    } catch (e) {
      setError((e as Error).message || "Upload failed. Try again.");
    } finally {
      setBusy("");
      if (input.current) input.current.value = "";
    }
  }

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    if (crop && files.length === 1) { setCropSrc(URL.createObjectURL(files[0])); return; }
    const urls: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setBusy(`Uploading ${i + 1} of ${files.length}…`);
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const blob = await upload(`${root}/${userId}/${folder}/${Date.now()}.${ext}`, f, { access: "public", handleUploadUrl: "/api/blob" });
        urls.push(blob.url);
      }
      const res = await save(urls);
      if (res.error) setError(res.error);
      router.refresh();
    } catch (e) {
      setError((e as Error).message || "Upload failed. Try a JPG or PNG under 15 MB.");
    } finally {
      setBusy("");
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="col" style={{ gap: 6 }}>
      <input ref={input} type="file" accept={accept} multiple={multiple} hidden onChange={(e) => onPick(e.target.files)} />
      <button className="btn ghost" type="button" disabled={!!busy} onClick={() => input.current?.click()}>
        <Icon name="upload" /> {busy || label}
      </button>
      {crop && current && !busy && <button className="link small" type="button" style={{ alignSelf: "flex-start" }} onClick={() => setCropSrc(current)}>Adjust my current photo</button>}
      {error && <p className="err" role="alert">{error}</p>}
      {cropSrc && <PhotoCropper src={cropSrc} onCancel={() => { if (cropSrc.startsWith("blob:")) URL.revokeObjectURL(cropSrc); setCropSrc(""); if (input.current) input.current.value = ""; }} onDone={uploadFramed} />}
    </div>
  );
}
