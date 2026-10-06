"use client";
import { useState } from "react";
import { MAX_PRICE_DOLLARS } from "@/lib/pricing";
import { cleanPrice, underCap } from "./PriceInput";

export type Cat = { id: number; name: string; suggestions: string[] };
export type Row = { categoryId: number; name: string; price: string; duration: string; adultsOnly?: boolean; photo?: string | null; addFee?: boolean };

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

export function ServicesEditor({ categories, initial, userId, feeCents = 500 }: { categories: Cat[]; initial: Row[]; userId: string; feeCents?: number }) {
  const feeD = feeCents / 100;
  const fmt = (n: number) => `$${n.toFixed(2).replace(/\.00$/, "")}`;
  // What students see and pay for a row: the pro's price + the service fee (unless they chose to absorb it).
  const studentPrice = (r: Row) => { const p = Number(String(r.price).replace(/[$,\s]/g, "")); return Number.isFinite(p) && p > 0 ? (r.addFee === false ? p : p + feeD) : null; };
  const [rows, setRows] = useState<Row[]>(initial);
  const [cats, setCats] = useState<number[]>(() => [...new Set(initial.map((r) => r.categoryId))]);
  const [capWarn, setCapWarn] = useState(false);
  const [open, setOpen] = useState<Set<number>>(() => new Set(initial.map((r, i) => (!r.name.trim() || !String(r.price).trim() ? i : -1)).filter((i) => i >= 0)));
  const openRow = (i: number) => setOpen((o) => new Set(o).add(i));
  const close = (i: number) => setOpen((o) => { const n = new Set(o); n.delete(i); return n; });

  const [openCat, setOpenCat] = useState<number | null>(() => initial.find((r) => !r.name.trim() || !String(r.price).trim())?.categoryId ?? null);
  // Picking a new category opens it (and minimizes the others); removing one closes it.
  const toggleCat = (id: number) => setCats((c) => {
    if (c.includes(id)) { setOpenCat((o) => (o === id ? null : o)); return c.filter((x) => x !== id); }
    setOpenCat(id);
    return [...c, id];
  });
  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const add = (categoryId: number, name = "") => setRows((r) => { setOpen((o) => new Set(o).add(r.length)); setOpenCat(categoryId); return [...r, { categoryId, name, price: "", duration: "60", addFee: true }]; });
  // Removing shifts the rows after it up by one — keep the same services open.
  const remove = (i: number) => { setRows((r) => r.filter((_, j) => j !== i)); setOpen((o) => new Set([...o].filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)))); };
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
          <div key={c.id} className="card" style={{ gap: openCat === c.id ? 10 : 0 }}>
            <button type="button" className="row between" aria-expanded={openCat === c.id} onClick={() => setOpenCat((o) => (o === c.id ? null : c.id))}
              style={{ background: "none", border: 0, padding: 0, color: "inherit", font: "inherit", cursor: "pointer", width: "100%", textAlign: "left" }}>
              <span className="eyebrow">{c.name}</span>
              <span className="row xs muted" style={{ gap: 6 }}>{mine.length} service{mine.length === 1 ? "" : "s"}<span aria-hidden="true" style={{ fontSize: 14 }}>{openCat === c.id ? "▾" : "▸"}</span></span>
            </button>
            {openCat === c.id && (<>
            {mine.map(({ r, i }) => (
              open.has(i) ? (
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
              <label className="check" style={{ fontSize: 12, marginTop: -4 }}>
                <input type="checkbox" checked={r.addFee !== false} onChange={(e) => update(i, { addFee: e.target.checked })} />
                <span>Add the {fmt(feeD)} Nearest service fee to my price{studentPrice(r) != null ? <> — <span className="b">students see {fmt(studentPrice(r)!)}</span>{r.addFee === false ? `, you receive ${fmt(Math.max(0, studentPrice(r)! - feeD))}` : ""}</> : ""}</span>
              </label>
              <ServicePhoto userId={userId} url={r.photo} onChange={(u) => update(i, { photo: u })} />
              <button type="button" className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => close(i)}>Minimize</button>
            </div>
              ) : (
              // Saved services stay compact: one line with the price students see and an Edit button.
              <div key={i} className="row" style={{ gap: 10, padding: "6px 0", borderTop: "1px solid #1C1C1F" }}>
                {r.photo ? <span style={{ width: 40, height: 40, borderRadius: 8, overflow: "hidden", flex: "none" }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={r.photo} alt="" width={40} height={40} style={{ objectFit: "cover", width: 40, height: 40 }} /></span> : null}
                <div className="grow col" style={{ gap: 2, minWidth: 0 }}>
                  <span className="b" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name || "Untitled service"}{r.adultsOnly ? <span className="tag warn" style={{ marginLeft: 6 }}>18+</span> : null}</span>
                  <span className="xs muted">{studentPrice(r) != null ? `Students see ${fmt(studentPrice(r)!)}` : "No price yet"} • {r.duration || "?"} min</span>
                </div>
                <button type="button" className="btn ghost sm" style={{ flex: "none" }} onClick={() => openRow(i)}>Edit</button>
              </div>
              )
            ))}
            {unused.length > 0 && (
              <div className="chips">{unused.map((s) => <button key={s} type="button" className="chip" style={{ height: 32 }} onClick={() => add(c.id, s)}>+ {s}</button>)}</div>
            )}
            <button type="button" className="link small" style={{ alignSelf: "flex-start" }} onClick={() => add(c.id)}>+ Add custom service</button>
            </>)}
          </div>
        );
      })}
      {cats.length === 0 && <p className="small muted p">Pick at least one category above.</p>}
      {(capWarn || rows.some((r) => (studentPrice(r) ?? 0) > MAX_PRICE_DOLLARS)) && <p className="err small" role="alert">Students can&apos;t be charged more than ${MAX_PRICE_DOLLARS} per service{rows.some((r) => (studentPrice(r) ?? 0) > MAX_PRICE_DOLLARS) ? ` — with the ${fmt(feeD)} service fee, a service can be up to ${fmt(MAX_PRICE_DOLLARS - feeD)}.` : "."}</p>}
      <p className="xs muted p">Enter your price. Nearest adds its {fmt(feeD)} service fee, so students see one total price (no separate fee). Every service is ${MAX_PRICE_DOLLARS} or less for students.</p>
    </div>
  );
}
