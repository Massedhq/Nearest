"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { readScreenshotText } from "@/lib/ocr-client";
import { parseLeadText } from "@/lib/lead-parse";

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

/**
 * Upload screenshots of one professional → their text is read here in the browser (self-hosted OCR, no AI service)
 * → sorted into the draft's fields → the screenshots and details are saved and the draft opens to check.
 * With draftId, the screenshots are added to that draft (only its empty fields get filled).
 * With build, the draft opens ready to approve straight into building their profile (Outreach → Build a profile).
 */
export function ScreenshotLeadUpload({ draftId, room = MAX, build = false }: { draftId?: string; room?: number; build?: boolean }) {
  const router = useRouter();
  const max = Math.max(0, Math.min(MAX, room));
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  if (max === 0) return <span className="xs muted">This draft already has {MAX} screenshots.</span>;
  return (
    <form className="col" style={{ gap: 10 }} onSubmit={async (e) => {
      e.preventDefault();
      setErr("");
      if (!files.length) return setErr("Choose at least one screenshot.");
      try {
        setBusy("Preparing…");
        const shots = await Promise.all(files.map(shrink));
        const { texts, error } = await readScreenshotText(files, setBusy); // full-size originals read best; the smaller copies are what's stored
        const parsed = parseLeadText(texts);
        setBusy("Saving…");
        const fd = new FormData();
        shots.forEach((b, i) => fd.append("shots", b, files[i].name.replace(/\.\w+$/, "") + ".jpg"));
        fd.append("fields", JSON.stringify(parsed.fields));
        fd.append("conflicts", JSON.stringify(parsed.conflicts));
        if (error) fd.append("readError", error);
        if (draftId) fd.append("draftId", draftId);
        const r = await fetch("/api/admin/lead-screenshots", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) { setErr(j.error || "Upload failed. Try again."); setBusy(""); return; }
        if (draftId) { setFiles([]); setBusy(""); (e.target as HTMLFormElement).reset(); router.refresh(); }
        else router.push(`/admin/outreach/screenshots/${j.id}${build ? "?build=1" : ""}`);
      } catch (x) { console.error(x); setErr("Upload failed — check your connection and try again."); setBusy(""); }
    }}>
      <div className="field">
        <label htmlFor={draftId ? "ss-more" : "ss-files"}>{draftId ? `Add more screenshots of this professional (up to ${max})` : `Screenshots of one professional (up to ${max})`}</label>
        <input id={draftId ? "ss-more" : "ss-files"} type="file" accept="image/png,image/jpeg,image/webp" multiple style={{ paddingTop: 12 }}
          onChange={(e) => { const list = Array.from(e.target.files ?? []); if (list.length > max) setErr(`Choose up to ${max} screenshots.`); else setErr(""); setFiles(list.slice(0, max)); }} />
        <span className="xs muted">{draftId
          ? "Only empty fields are filled in from new screenshots — what's already in the form (including your corrections) is kept, and any different detail is noted above for you to check."
          : "Their profile, link-in-bio, booking page or business flyer — anything that shows their name, business, location and contact details. Use one upload per professional; screenshots uploaded together go into one form. The text is read on this device — nothing is sent to an AI service."}</span>
      </div>
      {files.length > 0 && !busy && <span className="small">{files.length} screenshot{files.length === 1 ? "" : "s"} selected</span>}
      {busy && <span className="small" role="status" aria-live="polite">{busy}</span>}
      {err && <p className="err" role="alert">{err}</p>}
      <button className={draftId ? "btn ghost" : "btn"} type="submit" disabled={Boolean(busy)}>{busy ? "Reading the screenshots…" : draftId ? "Add and read screenshots" : "Read screenshots"}</button>
    </form>
  );
}
