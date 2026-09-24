"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Icon } from "./Icon";

type Save = (urls: string[]) => Promise<{ error?: string }>;

/** Uploads photos straight to Blob storage, then records them with `save`. */
export function Uploader({ userId, folder, save, multiple = true, label }: { userId: string; folder: string; save: Save; multiple?: boolean; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const urls: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setBusy(`Uploading ${i + 1} of ${files.length}…`);
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const blob = await upload(`pros/${userId}/${folder}/${Date.now()}.${ext}`, f, { access: "public", handleUploadUrl: "/api/blob" });
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
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} hidden onChange={(e) => onPick(e.target.files)} />
      <button className="btn ghost" type="button" disabled={!!busy} onClick={() => input.current?.click()}>
        <Icon name="upload" /> {busy || label}
      </button>
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}
