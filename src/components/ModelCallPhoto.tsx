"use client";
import { useState } from "react";
import { upload } from "@vercel/blob/client";

/** Optional photo of the look for a Model Call — uploads, then fills a hidden "photoUrl" field. */
export function ModelCallPhoto({ userId }: { userId: string }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="field">
      <label htmlFor="mc-photo">Photo of the look (optional)</label>
      <input type="hidden" name="photoUrl" value={url} />
      {url ? (
        <div className="row" style={{ gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Model call look" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 12 }} />
          <button type="button" className="btn ghost sm" onClick={() => setUrl("")}>Remove</button>
        </div>
      ) : (
        <input id="mc-photo" type="file" accept="image/*" disabled={busy} onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true); setErr("");
          try {
            const b = await upload(`pros/${userId}/modelcalls/${Date.now()}-${f.name.replace(/[^a-z0-9.]/gi, "")}`, f, { access: "public", handleUploadUrl: "/api/blob" });
            setUrl(b.url);
          } catch { setErr("That photo didn't upload. Try again."); } finally { setBusy(false); }
        }} />
      )}
      <span className={`xs ${err ? "err" : "muted"}`}>{err || (busy ? "Uploading…" : "Show models exactly what you're practicing.")}</span>
    </div>
  );
}
