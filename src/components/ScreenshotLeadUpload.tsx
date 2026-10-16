"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const MAX = 5;

/** Shrinks a phone screenshot so a few fit in one upload (longest side 2000px, JPEG). Text stays readable. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const out = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.86));
    return out && out.size < file.size ? out : file;
  } catch { return file; }
}

/** Upload screenshots of one professional → AI reads them → opens the draft to check. */
export function ScreenshotLeadUpload() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <form className="col" style={{ gap: 10 }} onSubmit={async (e) => {
      e.preventDefault();
      setErr("");
      if (!files.length) return setErr("Choose at least one screenshot.");
      setBusy(true);
      try {
        const fd = new FormData();
        for (const f of files) fd.append("shots", await shrink(f), f.name.replace(/\.\w+$/, "") + ".jpg");
        const r = await fetch("/api/admin/lead-screenshots", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) { setErr(j.error || "Upload failed. Try again."); setBusy(false); return; }
        router.push(`/admin/outreach/screenshots/${j.id}`);
      } catch { setErr("Upload failed — check your connection and try again."); setBusy(false); }
    }}>
      <div className="field">
        <label htmlFor="ss-files">Screenshots of one professional (up to {MAX})</label>
        <input id="ss-files" type="file" accept="image/png,image/jpeg,image/webp" multiple style={{ paddingTop: 12 }}
          onChange={(e) => { const list = Array.from(e.target.files ?? []); if (list.length > MAX) setErr(`Choose up to ${MAX} screenshots.`); else setErr(""); setFiles(list.slice(0, MAX)); }} />
        <span className="xs muted">Their profile, link-in-bio, booking page or business flyer — anything that shows their name, business, location and contact details. Use one upload per professional.</span>
      </div>
      {files.length > 0 && <span className="small">{files.length} screenshot{files.length === 1 ? "" : "s"} selected</span>}
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn" type="submit" disabled={busy}>{busy ? "Reading the screenshots…" : "Read screenshots"}</button>
    </form>
  );
}
