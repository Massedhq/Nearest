"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { submitIdDocs } from "@/app/verify-actions";
import type { FormState } from "./ActionForm";
import { Icon } from "./Icon";

/** Shrinks a photo to ~1280px JPEG so it uploads fast and stays small. */
async function shrink(file: Blob): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

/** Live camera inside the page: preview → Capture → Use photo / Retake. */
function Camera({ facing, label, onDone, onCancel }: { facing: "user" | "environment"; label: string; onDone: (v: string) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [shot, setShot] = useState("");
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setErr("This browser can't open the camera here."); return; }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => {}); }
        setReady(true);
      } catch (e) {
        const name = (e as DOMException)?.name;
        setErr(name === "NotAllowedError"
          ? "Camera access is blocked. Allow the camera for this site (tap the camera or lock icon in the address bar), then try again."
          : name === "NotFoundError" ? "No camera was found on this device." : "The camera couldn't start. Close other apps using it and try again.");
      }
    })();
    return () => { cancelled = true; stream.current?.getTracks().forEach((t) => t.stop()); };
  }, [facing]);

  function capture() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height); // saved un-mirrored, as the camera sees it
    setShot(c.toDataURL("image/jpeg", 0.85));
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Take ${label.toLowerCase()}`} style={{ position: "fixed", inset: 0, zIndex: 60, background: "#000", display: "flex", flexDirection: "column", padding: "calc(16px + env(safe-area-inset-top,0px)) 16px calc(16px + env(safe-area-inset-bottom,0px))", gap: 14 }}>
      <div className="row between"><span className="b">{label}</span><button type="button" className="link small" onClick={onCancel}>Cancel</button></div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 18, overflow: "hidden", background: "#0A0A0B", position: "relative" }}>
        {err ? (
          <p className="small p" style={{ textAlign: "center", maxWidth: 360 }}>{err}</p>
        ) : shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot} alt={`${label} preview`} style={{ maxWidth: "100%", maxHeight: "100%", transform: facing === "user" ? "scaleX(-1)" : undefined }} />
        ) : (
          <>
            <video ref={video} playsInline muted autoPlay style={{ width: "100%", height: "100%", objectFit: "cover", transform: facing === "user" ? "scaleX(-1)" : undefined }} />
            {facing === "user" && ready && <div aria-hidden="true" style={{ position: "absolute", width: "58%", aspectRatio: "3 / 4", border: "2px solid rgba(236,232,225,.7)", borderRadius: "50%" }} />}
            {facing === "environment" && ready && <div aria-hidden="true" style={{ position: "absolute", width: "80%", aspectRatio: "1.6 / 1", border: "2px solid rgba(236,232,225,.7)", borderRadius: 14 }} />}
            {!ready && <span className="small muted" style={{ position: "absolute" }}>Starting camera…</span>}
          </>
        )}
      </div>
      <span className="xs muted" style={{ textAlign: "center" }}>{facing === "user" ? "Center your face in the oval, in good light." : "Fit your school ID in the frame so your name, school and photo are clear."}</span>
      {err ? (
        <button type="button" className="btn ghost" onClick={onCancel}>Back</button>
      ) : shot ? (
        <div className="grid2"><button type="button" className="btn ghost" onClick={() => setShot("")}>Retake</button><button type="button" className="btn" onClick={() => onDone(shot)}>Use photo</button></div>
      ) : (
        <button type="button" className="btn" onClick={capture} disabled={!ready} aria-label={`Capture ${label.toLowerCase()}`}>Capture</button>
      )}
    </div>
  );
}

function Shot({ name, label, hint, facing, value, onPick, icon, allowUpload }: { name: string; label: string; hint: string; facing: "user" | "environment"; value: string; onPick: (v: string) => void; icon: string; allowUpload: boolean }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="col" style={{ gap: 6 }}>
      <input type="hidden" name={name} value={value} />
      <button type="button" className="cam" onClick={() => setOpen(true)} style={{ height: 210, flexDirection: "column", gap: 10, cursor: "pointer", padding: 12, width: "100%", font: "inherit", color: "inherit" }}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} style={{ maxHeight: 150, maxWidth: "100%", borderRadius: 12, transform: facing === "user" ? "scaleX(-1)" : undefined }} />
        ) : (
          <span className="muted"><Icon name={icon} size="xl" /></span>
        )}
        <span className="small b">{value ? `Retake ${label.toLowerCase()}` : `Take ${label.toLowerCase()}`}</span>
        <span className="xs muted" style={{ textAlign: "center" }}>{err || hint}</span>
      </button>
      {/* Backup: an existing photo (ID only), or the phone's own camera app if the in-page camera is blocked */}
      <input ref={file} type="file" accept="image/*" capture={facing} hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setErr("");
        try { onPick(await shrink(f)); } catch { setErr("Couldn't read that photo. Try again."); }
        e.target.value = "";
      }} />
      <button type="button" className="link xs" style={{ alignSelf: "center" }} onClick={() => file.current?.click()}>
        {allowUpload ? "Or upload a photo of your ID" : "Camera not working? Use your phone's camera app"}
      </button>
      {open && <Camera facing={facing} label={label} onCancel={() => setOpen(false)} onDone={(v) => { onPick(v); setOpen(false); }} />}
    </div>
  );
}

export function IdCapture() {
  const [state, run, pending] = useActionState<FormState, FormData>(submitIdDocs, {});
  const [idPhoto, setIdPhoto] = useState("");
  const [selfie, setSelfie] = useState("");
  return (
    <form action={run} className="col g16">
      <Shot name="school_id" label="Photo of school ID" hint="Name, school and photo clearly visible" facing="environment" value={idPhoto} onPick={setIdPhoto} icon="id" allowUpload />
      <Shot name="selfie" label="Selfie" hint="Opens your camera — face it in good light" facing="user" value={selfie} onPick={setSelfie} icon="face" allowUpload={false} />
      {state.error && <p className="err" role="alert">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending || !idPhoto || !selfie}>{pending ? "Sending…" : "Submit for verification"}</button>
    </form>
  );
}
