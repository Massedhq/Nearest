"use client";
import { useActionState, useRef, useState } from "react";
import { submitEnrollmentProof } from "@/app/verify-actions";
import { ENROLLMENT_DOC_KINDS, NO_ID_EXPLAIN, PROOF_MAX_BYTES } from "@/lib/enrollment-proof";
import type { FormState } from "./ActionForm";
import { Shot } from "./IdCapture";
import { Icon } from "./Icon";

/** Documents need readable text, so photos are kept larger than ID photos (2000px, JPEG). */
async function shrinkDoc(file: Blob): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); // screenshots with transparency stay readable
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

const readAsDataUrl = (f: Blob) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = bad; r.readAsDataURL(f); });

/**
 * "My school does not issue student IDs": upload proof of current enrollment (photo, screenshot or PDF).
 * needSelfie = the selfie isn't saved yet (taken here, like the school ID flow).
 */
export function EnrollmentProofCapture({ needSelfie, onBack }: { needSelfie: boolean; onBack?: () => void }) {
  const [state, run, pending] = useActionState<FormState, FormData>(submitEnrollmentProof, {});
  const [proof, setProof] = useState("");
  const [fileName, setFileName] = useState("");
  const [isPdf, setIsPdf] = useState(false);
  const [err, setErr] = useState("");
  const [selfie, setSelfie] = useState("");
  const file = useRef<HTMLInputElement>(null);
  return (
    <form action={run} className="col g16">
      <div className="card small" style={{ gap: 6 }}>
        <span className="b">No school ID? Use proof of enrollment.</span>
        <span>{NO_ID_EXPLAIN}</span>
        {onBack && <button type="button" className="link xs" style={{ alignSelf: "flex-start" }} onClick={onBack}>My school does issue IDs — use my school ID</button>}
      </div>
      <div className="field">
        <label htmlFor="docKind">What are you uploading?</label>
        <select id="docKind" name="docKind" required defaultValue="">
          <option value="" disabled>Choose one</option>
          {Object.entries(ENROLLMENT_DOC_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <input type="hidden" name="proof" value={proof} />
      <input ref={file} type="file" accept="image/*,application/pdf" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        setErr("");
        try {
          if (f.type === "application/pdf") {
            if (f.size > PROOF_MAX_BYTES) { setErr("That PDF is over 5 MB. Upload a screenshot or photo of the page instead."); return; }
            setProof(await readAsDataUrl(f)); setIsPdf(true);
          } else {
            setProof(await shrinkDoc(f)); setIsPdf(false);
          }
          setFileName(f.name);
        } catch { setErr("Couldn't read that file. Try a photo, screenshot or PDF."); }
      }} />
      <button type="button" className="cam" onClick={() => file.current?.click()} style={{ height: 190, flexDirection: "column", gap: 10, cursor: "pointer", padding: 12, width: "100%", font: "inherit", color: "inherit" }}>
        {proof && !isPdf ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proof} alt="Your enrollment document" style={{ maxHeight: 130, maxWidth: "100%", borderRadius: 10 }} />
        ) : (
          <span className="muted"><Icon name="id" size="xl" /></span>
        )}
        <span className="small b">{proof ? `Change document${isPdf ? ` (${fileName})` : ""}` : "Upload your document"}</span>
        <span className="xs muted" style={{ textAlign: "center" }}>{err || "Photo, screenshot or PDF — your name, school and current enrollment must be readable"}</span>
      </button>
      {needSelfie && <Shot name="selfie" label="Selfie" hint="Opens your camera — face it in good light" facing="user" value={selfie} onPick={setSelfie} icon="face" allowUpload={false} />}
      {state.error && <p className="err" role="alert">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending || !proof || (needSelfie && !selfie)}>{pending ? "Sending…" : "Submit for verification"}</button>
    </form>
  );
}
