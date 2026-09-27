"use client";
import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Camera } from "./IdCapture";
import { Icon } from "./Icon";

/**
 * A photo that MUST be taken (live camera) before the form can be sent — used at check-in and checkout.
 * Uploads to secure storage and puts the link in a field named `name`.
 */
export function RequiredPhoto({ userId, folder, name, label, hint }: { userId: string; folder: string; name: string; label: string; hint: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const field = useRef<HTMLInputElement>(null);

  async function save(dataUrl: string) {
    setOpen(false); setPreview(dataUrl); setBusy(true); setErr("");
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const b = await upload(`students/${userId}/${folder}/${Date.now()}.jpg`, blob, { access: "public", handleUploadUrl: "/api/blob" });
      setUrl(b.url);
      field.current?.setCustomValidity("");
    } catch {
      setErr("The photo didn't upload. Check your connection and take it again."); setPreview("");
    } finally { setBusy(false); }
  }

  return (
    <div className="col" style={{ gap: 6, width: "100%" }}>
      {/* Invisible but required: the form can't be sent until the photo has uploaded */}
      <input ref={field} name={name} value={url} readOnly required tabIndex={-1} aria-hidden="true"
        onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity(`${label} is required.`)}
        style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }} />
      <button type="button" className="cam" onClick={() => setOpen(true)} disabled={busy} style={{ height: 200, flexDirection: "column", gap: 10, cursor: "pointer", padding: 12, width: "100%", font: "inherit", color: "inherit" }}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} style={{ maxHeight: 140, maxWidth: "100%", borderRadius: 12 }} />
        ) : (
          <span className="muted"><Icon name="camera" size="xl" /></span>
        )}
        <span className="small b">{busy ? "Uploading…" : url ? `Retake ${label.toLowerCase()}` : `Take ${label.toLowerCase()} — required`}</span>
        <span className={`xs ${err ? "err" : "muted"}`} style={{ textAlign: "center" }}>{err || (url ? "Saved to this booking." : hint)}</span>
      </button>
      {open && <Camera facing="user" allowFlip label={label} onCancel={() => setOpen(false)} onDone={save} />}
    </div>
  );
}
