"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Shrinks big photos in the browser (the server still checks type and size). Small JPG/PNG/WebP go up as-is. */
async function prepare(file: File): Promise<Blob> {
  const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  if (ok && file.size <= 3.5 * 1024 * 1024) return file;
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return file;
  const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
}

/** Start (profile link + starting screenshot) or a daily/final screenshot. The server stamps the time and window. */
export function CampaignUpload({ mode, label, hint }: { mode: "start" | "evidence"; label: string; hint: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  async function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const f = fd.get("file");
    if (!(f instanceof File) || !f.size) { setMsg({ error: "Choose a screenshot." }); return; }
    setBusy(true); setMsg({});
    try {
      const blob = await prepare(f);
      const send = new FormData();
      send.set("file", blob, "screenshot");
      if (mode === "start") send.set("profileUrl", String(fd.get("profileUrl") ?? ""));
      const r = await fetch("/api/campaign/evidence", { method: "POST", body: send });
      const j = (await r.json().catch(() => ({}))) as { error?: string; startedAt?: string; uploadedAt?: string };
      if (!r.ok) setMsg({ error: j.error ?? "That didn't upload. Try again." });
      else {
        const t = new Date(j.startedAt ?? j.uploadedAt ?? Date.now()).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
        setMsg({ ok: mode === "start" ? `Accepted at ${t} CT — your seven days have started.` : `Received at ${t} CT.` });
        form.reset();
        router.refresh();
      }
    } catch { setMsg({ error: "That didn't upload. Check your connection and try again." }); }
    setBusy(false);
  }
  return (
    <form className="col g8" onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
      {mode === "start" && (
        <div className="field">
          <label htmlFor="cp-url">Your profile link (Instagram, Facebook or TikTok)</label>
          <input id="cp-url" name="profileUrl" type="url" inputMode="url" placeholder="https://www.instagram.com/yourname" required autoComplete="off" />
        </div>
      )}
      <div className="field">
        <label htmlFor="cp-file">{label}</label>
        <input id="cp-file" name="file" type="file" accept="image/*" required />
        <span className="xs muted">{hint}</span>
      </div>
      {msg.error && <p className="err" role="alert">{msg.error}</p>}
      {msg.ok && <p className="okmsg" role="status">{msg.ok}</p>}
      <button className="btn" type="submit" disabled={busy}>{busy ? "Uploading…" : mode === "start" ? "Submit and start my seven days" : "Upload screenshot"}</button>
    </form>
  );
}
