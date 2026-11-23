"use client";
import { useActionState, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { signAgreement, saveEducatorVideo } from "@/app/educator-actions";

type State = { error?: string; ok?: string };
type Field = { key: string; label: string; required: boolean; hint?: string };

/** The creator's part of the agreement, typed right on the page like a binder, then agree + type their name. */
export function AgreementSign({ token, fields, values }: { token: string; fields: Field[]; values: Record<string, string> }) {
  const [state, run, pending] = useActionState<State, FormData>(signAgreement, {});
  if (state.ok) return <p className="okmsg" role="status" style={{ fontSize: 16 }}>{state.ok}</p>;
  return (
    <form action={run} className="col" style={{ gap: 14 }}>
      <input type="hidden" name="token" value={token} />
      <h2>Your details</h2>
      {fields.map((f) => (
        <label key={f.key} className="col" style={{ gap: 4 }}>
          <span style={{ fontSize: 13, fontFamily: "var(--font-body), system-ui, sans-serif", fontWeight: 600 }}>{f.label}{f.required ? "" : " (optional)"}</span>
          <input className="fill" name={f.key} defaultValue={values[f.key] ?? ""} required={f.required} maxLength={300} placeholder={f.hint ?? ""} />
        </label>
      ))}
      <label className="row" style={{ gap: 10, alignItems: "flex-start", fontSize: 14 }}>
        <input type="checkbox" name="agree" required style={{ marginTop: 4 }} />
        <span>I have read this agreement, including the confidentiality section and the license that lets Nearest sell and resell the Video, and I agree to it.</span>
      </label>
      <label className="col" style={{ gap: 4 }}>
        <span style={{ fontSize: 13, fontFamily: "var(--font-body), system-ui, sans-serif", fontWeight: 600 }}>Type your full legal name to sign</span>
        <input className="fill" name="signature" required maxLength={120} style={{ fontFamily: "'Brush Script MT', cursive", fontSize: 24 }} />
      </label>
      {state.error && <p className="err" role="alert" style={{ color: "#B3261E" }}>{state.error}</p>}
      <button className="btn" type="submit" disabled={pending} style={{ background: "#141414", color: "#fff" }}>{pending ? "Signing…" : "Sign and send back to Nearest"}</button>
    </form>
  );
}

/** After signing: upload the video (straight to storage, up to 2 GB) + the product list. */
export function EducatorUpload({ token, contractId }: { token: string; contractId: string }) {
  const [state, run, saving] = useActionState<State, FormData>(saveEducatorVideo, {});
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(""); const [access, setAccess] = useState("private"); const [name, setName] = useState("");
  const [pct, setPct] = useState<number | null>(null); const [error, setError] = useState("");
  async function pick(f?: File) {
    if (!f) return;
    setError("");
    if (!/^video\/(mp4|quicktime|webm)$/.test(f.type)) return setError("Use an MP4, MOV or WebM video.");
    if (f.size > 2 * 1024 * 1024 * 1024) return setError("Use a video under 2 GB.");
    setPct(0);
    try {
      const ext = (f.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
      const opts = { handleUploadUrl: "/api/educator-upload", clientPayload: token, multipart: f.size > 20 * 1024 * 1024, onUploadProgress: (e: { percentage: number }) => setPct(Math.round(e.percentage)) };
      const path = `educators/${contractId}/${Date.now()}.${ext}`;
      let b;
      try { b = await upload(path, f, { access: "private", ...opts }); setAccess("private"); }
      catch { b = await upload(path, f, { access: "public", ...opts }); setAccess("public"); }
      setUrl(b.url); setName(f.name.slice(0, 150));
    } catch (e) { setError((e as Error).message || "Upload failed. Try again."); }
    finally { setPct(null); if (input.current) input.current.value = ""; }
  }
  if (state.ok) return <p className="okmsg" role="status" style={{ fontSize: 16 }}>{state.ok}</p>;
  return (
    <form action={run} className="col" style={{ gap: 12 }}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="video" value={url} /><input type="hidden" name="video_access" value={access} /><input type="hidden" name="video_name" value={name} />
      <input ref={input} type="file" hidden accept="video/mp4,video/quicktime,video/webm" onChange={(e) => pick(e.target.files?.[0])} />
      <button type="button" className="btn ghost" disabled={pct !== null} onClick={() => input.current?.click()} style={{ color: "#141414", borderColor: "#141414" }}>
        {pct !== null ? `Uploading… ${pct}%` : url ? `${name} uploaded — choose a different file` : "Choose your video (MP4 or MOV, up to 2 GB)"}
      </button>
      <label className="col" style={{ gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Products and tools used (one per line, with links if you have them)</span>
        <textarea name="products" maxLength={3000} rows={6} style={{ border: "1px solid #D9D3C8", borderRadius: 10, padding: 10, font: "inherit" }} />
      </label>
      {(error || state.error) && <p className="err" role="alert" style={{ color: "#B3261E" }}>{error || state.error}</p>}
      <button className="btn" type="submit" disabled={!url || saving || pct !== null} style={{ background: "#141414", color: "#fff" }}>{saving ? "Sending…" : "Send my video to Nearest"}</button>
    </form>
  );
}
