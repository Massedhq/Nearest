"use client";
import { useActionState, useState } from "react";
import { submitIdDocs } from "@/app/verify-actions";
import type { FormState } from "./ActionForm";
import { Icon } from "./Icon";

/** Shrinks a phone photo to ~1280px JPEG so it uploads fast and stays small. */
async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

function Shot({ name, label, hint, capture, value, onPick, icon }: { name: string; label: string; hint: string; capture: "user" | "environment"; value: string; onPick: (v: string) => void; icon: string }) {
  const [err, setErr] = useState("");
  return (
    <label className="cam" style={{ height: 210, flexDirection: "column", gap: 10, cursor: "pointer", padding: 12 }}>
      <input type="hidden" name={name} value={value} />
      <input
        type="file" accept="image/*" capture={capture} hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setErr("");
          try { onPick(await shrink(f)); } catch { setErr("Couldn't read that photo. Try again."); }
        }}
      />
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt={label} style={{ maxHeight: 150, maxWidth: "100%", borderRadius: 12 }} />
      ) : (
        <span className="muted"><Icon name={icon} size="xl" /></span>
      )}
      <span className="small b">{value ? `Retake ${label.toLowerCase()}` : label}</span>
      <span className="xs muted" style={{ textAlign: "center" }}>{err || hint}</span>
    </label>
  );
}

export function IdCapture() {
  const [state, run, pending] = useActionState<FormState, FormData>(submitIdDocs, {});
  const [idPhoto, setIdPhoto] = useState("");
  const [selfie, setSelfie] = useState("");
  return (
    <form action={run} className="col g16">
      <Shot name="school_id" label="Photo of school ID" hint="Name, school and photo clearly visible" capture="environment" value={idPhoto} onPick={setIdPhoto} icon="id" />
      <Shot name="selfie" label="Selfie" hint="Face the camera in good light" capture="user" value={selfie} onPick={setSelfie} icon="face" />
      {state.error && <p className="err" role="alert">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending || !idPhoto || !selfie}>{pending ? "Sending…" : "Submit for verification"}</button>
    </form>
  );
}
