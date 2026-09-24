"use client";
import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { Icon } from "./Icon";

/** Step 2 of finishing: optional photo of the results, uploaded straight to Blob storage. */
export function ResultPhoto({ userId }: { userId: string }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="col" style={{ gap: 10 }}>
      <input type="hidden" name="photoUrl" value={url} />
      <label className="cam" style={{ height: 260, flexDirection: "column", gap: 10, cursor: "pointer" }}>
        <input type="file" accept="image/*" capture="environment" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          setBusy(true); setErr("");
          try {
            const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
            const b = await upload(`students/${userId}/results/${Date.now()}.${ext}`, f, { access: "public", handleUploadUrl: "/api/blob" });
            setUrl(b.url);
          } catch { setErr("Upload failed. Try a JPG or PNG."); } finally { setBusy(false); }
        }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt="Your results" style={{ maxHeight: 220, maxWidth: "100%", borderRadius: 12 }} /> : <span className="muted"><Icon name="camera" size="xl" /></span>}
        <span className="small b">{busy ? "Uploading…" : url ? "Retake photo" : "Tap to take a photo"}</span>
      </label>
      {err && <p className="err">{err}</p>}
    </div>
  );
}
