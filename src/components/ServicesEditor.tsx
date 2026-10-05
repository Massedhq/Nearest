"use client";
import { useState } from "react";
import { MAX_PRICE_DOLLARS } from "@/lib/pricing";
import { cleanPrice, underCap } from "./PriceInput";

export type Cat = { id: number; name: string; licenseRequired: boolean; suggestions: string[] };
export type Row = { categoryId: number; name: string; price: string; duration: string; adultsOnly?: boolean; photo?: string | null };

/** Pick categories, then list each service with a price and length. Sends everything as one JSON field. */
/** Optional photo of one service: uploads straight to storage and keeps the link on that row. */
function ServicePhoto({ userId, url, onChange }: { userId: string; url?: string | null; onChange: (u: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setErr("Use a JPG, PNG or WebP photo."); return; }
    setBusy(true); setErr("");
    try {
      const { upload } = await import("@vercel/blob/client");
      const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
      const blob = await upload(`pros/${userId}/service/${Date.now()}.${ext}`, f, { access: "public", handleUploadUrl: "/api/blob" });
      onChange(blob.url);
    } catch { setErr("Upload didn't finish. Try again."); }
    setBusy(false);
  };
  return (
    <div className="row" style={{ gap: 8, marginTop: -2 }}>
      {url && <span style={{ width: 40, height: 40, borderRadius: 8, overflow: "hidden", flex: "none" }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt="" width={40} height={40} style={{ objectFit: "cover", width: 40, height: 40 }} /></span>}
      <label className="link xs" style={{ cursor: "pointer" }}>
        {busy ? "Uploading…" : url ? "Change photo" : "+ Add a photo of this service (optional)"}
        <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      {url && !busy && <button type="button" className="link xs" onClick={() => onChange(null)}>Remove</button>}
      {err && <span className="err xs">{err}</span>}
    </div>
  );
}

export function ServicesEditor({ categories, initial, userId }: { categories: Cat[]; initial: Row[]; userId: string }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [cats, setCats] = useState<number[]>(() => [...new Set(initial.map((r) => r.categoryId))]);
  const [capWarn, setCapWarn] = useState(false);

  const toggleCat = (id: number) => setCats((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const add = (categoryId: number, name = "") => setRows((r) => [...r, { categoryId, name, price: "", duration: "60" }]);
  const remove = (i: number) => setRows((r) => r.filter((_, j) => j !== i));
  const kept = rows.filter((r) => cats.includes(r.categoryId));

  return (
    <div className="col g16">
      <input type="hidden" name="payload" value={JSON.stringify(kept)} />
      <div className="chips">
        {categories.map((c) => (
          <button key={c.id} type="button" className={`chip${cats.includes(c.id) ? " on" : ""}`} aria-pressed={cats.includes(c.id)} onClick={() => toggleCat(c.id)}>{c.name}</button>
        ))}
      </div>
      {categories.filter((c) => cats.includes(c.id)).map((c) => {
        const mine = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.categoryId === c.id);
        const unused = c.suggestions.filter((s) => !mine.some(({ r }) => r.name.toLowerCase() === s.toLowerCase()));
        return (
          <div key={c.id} className="card">
            <div className="row between"><span className="eyebrow">{c.name}</span><span className="xs muted">Price • Minutes</span></div>
            {c.licenseRequired && <span className="tag warn" style={{ alignSelf: "flex-start" }}>License required</span>}
            {mine.map(({ r, i }) => (
              <div key={i} className="col" style={{ gap: 6 }}>
              <div className="row">
                <input className="ainput grow" aria-label="Service name" placeholder="Service name" value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
                <input className="ainput" style={{ width: 70, ...(Number(r.price) > MAX_PRICE_DOLLARS ? { borderColor: "#F2A38F" } : {}) }} aria-label={`${r.name || "Service"} price in dollars, up to $${MAX_PRICE_DOLLARS}`} aria-invalid={Number(r.price) > MAX_PRICE_DOLLARS || undefined} placeholder="$" inputMode="decimal" value={r.price}
                  onChange={(e) => { const next = cleanPrice(e.target.value); if (!underCap(next)) { setCapWarn(true); return; } setCapWarn(false); update(i, { price: next }); }} />
                <input className="ainput" style={{ width: 62 }} aria-label={`${r.name || "Service"} length in minutes`} inputMode="numeric" value={r.duration} onChange={(e) => update(i, { duration: e.target.value })} />
                <button type="button" className="iconbtn" style={{ width: 36, height: 36 }} aria-label={`Remove ${r.name || "service"}`} onClick={() => remove(i)}>×</button>
              </div>
              <label className="check" style={{ fontSize: 12, marginTop: -4 }}>
                <input type="checkbox" checked={Boolean(r.adultsOnly)} onChange={(e) => update(i, { adultsOnly: e.target.checked })} />
                <span><span className="b">18+ only</span> — must be 18 or older to book</span>
              </label>
              <ServicePhoto userId={userId} url={r.photo} onChange={(u) => update(i, { photo: u })} />
            </div>
            ))}
            {unused.length > 0 && (
              <div className="chips">{unused.map((s) => <button key={s} type="button" className="chip" style={{ height: 32 }} onClick={() => add(c.id, s)}>+ {s}</button>)}</div>
            )}
            <button type="button" className="link small" style={{ alignSelf: "flex-start" }} onClick={() => add(c.id)}>+ Add custom service</button>
          </div>
        );
      })}
      {cats.length === 0 && <p className="small muted p">Pick at least one category above.</p>}
      {(capWarn || rows.some((r) => Number(String(r.price).replace(/[$,\s]/g, "")) > MAX_PRICE_DOLLARS)) && <p className="err small" role="alert">Student prices can&apos;t be more than ${MAX_PRICE_DOLLARS} per service.{rows.some((r) => Number(String(r.price).replace(/[$,\s]/g, "")) > MAX_PRICE_DOLLARS) ? " Lower the price outlined in red to save." : ""}</p>}
      <p className="xs muted p">Nearest is a student marketplace — every service is ${MAX_PRICE_DOLLARS} or less.</p>
    </div>
  );
}
