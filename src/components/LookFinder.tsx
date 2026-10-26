"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "./Icon";

type Match = {
  userId: string; name: string; businessName: string | null; photoUrl: string | null; city: string | null; miles: number | null;
  score: number; label: string; why: string | null; photos: { url: string; bookHref: string | null; serviceName: string | null }[];
};
type Result = { ok: true; look: string | null; matches: Match[]; compared: number; ai: boolean; waiting: boolean } | { ok: false; error: string };

/** Shrink on the phone first (fast upload, EXIF rotation applied). */
async function shrink(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("shrink"))), "image/jpeg", 0.88));
}

export function LookFinder({ cats, canBook, finishStep }: { cats: { id: number; name: string }[]; canBook: boolean; finishStep: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [cat, setCat] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Extract<Result, { ok: true }> | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function pick(f: File | undefined) {
    if (!f) return;
    setErr(null); setRes(null);
    try {
      const b = await shrink(f);
      setBlob(b);
      setPreview(URL.createObjectURL(b));
    } catch {
      setErr("We couldn't open that photo. Try a screenshot or a different photo.");
    }
  }

  async function search() {
    if (!blob) return;
    setBusy(true); setErr(null); setRes(null);
    try {
      const fd = new FormData();
      fd.append("photo", blob, "inspo.jpg");
      if (cat) fd.append("category", cat);
      const r = await fetch("/api/look-match", { method: "POST", body: fd });
      const j = (await r.json()) as Result;
      if (!j.ok) setErr(j.error);
      else setRes(j);
    } catch {
      setErr("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card" style={{ gap: 12 }}>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        {preview ? (
          <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Your inspo photo" style={{ width: 110, height: 140, objectFit: "cover", borderRadius: 14 }} />
            <div className="col g4 grow">
              <span className="b">Your inspo photo</span>
              <span className="xs muted">Only used for this search — it isn&apos;t saved or shown to anyone.</span>
              <button type="button" className="link xs" style={{ textAlign: "left" }} onClick={() => input.current?.click()}>Choose a different photo</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn ghost" onClick={() => input.current?.click()}><Icon name="camera" /> Upload an inspo photo</button>
        )}
        <label className="field">
          <span className="xs muted">What&apos;s in the photo? (optional)</span>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Let Nearest figure it out</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <button type="button" className="btn" disabled={!blob || busy} onClick={search}>{busy ? "Comparing with professionals' work…" : "Find professionals who match"}</button>
        {busy && <span className="xs muted">This takes about 15–30 seconds — we&apos;re checking real portfolio photos, not just service names.</span>}
        <span className="xs muted">Tip: a clear, close-up photo of just the look works best (crop out backgrounds and text).</span>
      </div>

      {err && <div className="card warn"><span className="small">{err}</span></div>}

      {res && (
        <>
          <div className="row between">
            <h2 className="disp h2">{res.matches.length ? "Matches for your look" : "No close matches yet"}</h2>
            <span className="xs muted">{res.matches.length} professional{res.matches.length === 1 ? "" : "s"}</span>
          </div>
          {res.look && <span className="small muted">We looked for: <span className="b">{res.look}</span></span>}
          {res.matches.length === 0 && (
            <div className="card" style={{ gap: 6 }}>
              <span className="small">No professional near you has this look (or one very close to it) in their portfolio right now. We only show close matches — never someone just because they list the service.</span>
              <span className="xs muted">Try a different photo of the same look, or a closer crop. New portfolio photos are added to matching all the time.</span>
            </div>
          )}
          {!canBook && res.matches.length > 0 && finishStep && (
            <Link className="card warn" href={finishStep} style={{ textDecoration: "none", color: "inherit", gap: 2 }}>
              <span className="b">Finish verifying to book</span>
              <span className="small">You can see every match now — booking opens once your student account is verified.</span>
            </Link>
          )}
          {res.matches.map((m) => {
            const initials = m.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
            return (
              <div key={m.userId} className="card" style={{ gap: 10 }}>
                <div className="row" style={{ gap: 12 }}>
                  {m.photoUrl ? <Image src={m.photoUrl} alt="" width={48} height={48} style={{ borderRadius: 24, objectFit: "cover" }} /> : <div className="avatar">{initials}</div>}
                  <div className="col g4 grow">
                    <span className="h3">{m.name}</span>
                    {m.businessName && m.businessName !== m.name && <span className="small muted">{m.businessName}</span>}
                    <span className="xs muted row" style={{ gap: 4 }}><Icon name="pin" size="s" /> {m.miles != null ? `${m.miles} mi away` : m.city}</span>
                  </div>
                  <span className={`tag ${m.label === "Very close match" ? "ok" : ""}`}>{m.label}</span>
                </div>
                <div className="grid3">
                  {m.photos.map((p) => (
                    <div key={p.url} className="col g4">
                      <div className="ph" style={{ height: 110, padding: 0 }}><Image src={p.url} alt="Matching photo from their portfolio" fill sizes="140px" style={{ objectFit: "cover" }} /></div>
                      {p.bookHref && canBook && <Link className="link xs" href={p.bookHref}>Book this look{p.serviceName ? ` — ${p.serviceName}` : ""}</Link>}
                    </div>
                  ))}
                </div>
                {m.why && <span className="xs muted">{m.why}</span>}
                <Link className="btn ghost sm" href={`/p/${m.userId}`} style={{ width: "100%" }}>View profile</Link>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}
