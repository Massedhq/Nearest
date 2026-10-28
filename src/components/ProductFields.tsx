"use client";
import { useState } from "react";
import { ShopUpload } from "./ShopUpload";

type P = { id: string; kind: string; title: string; description: string | null; priceCents: number; shippingCents: number; stock: number | null; photoUrl: string | null; fileUrl: string | null; fileAccess: string | null; fileName: string | null; fileSize: number | null; active: boolean };

/** Fields for one partner-shop product. Digital: the file buyers download right after paying. Physical: shipping + stock. */
export function ProductFields({ userId, product }: { userId: string; product?: P }) {
  const [kind, setKind] = useState(product?.kind === "physical" ? "physical" : "digital");
  const k = product?.id ?? "new";
  const d = (c: number | null | undefined) => (c === null || c === undefined ? "" : (c / 100).toFixed(2).replace(/\.00$/, ""));
  return (
    <>
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="col g8">
        <span className="lbl">What are you selling?</span>
        <div className="row" style={{ gap: 8 }}>
          {[["digital", "Digital download"], ["physical", "Physical product"]].map(([v, l]) => (
            <label key={v} className={`chip${kind === v ? " on" : ""}`} style={{ flex: 1, justifyContent: "center" }}>
              <input type="radio" name="kind" value={v} checked={kind === v} onChange={() => setKind(v)} style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} />{l}
            </label>
          ))}
        </div>
        <span className="xs muted">{kind === "digital" ? "Workbooks, guides, templates, presets, videos — buyers download it right after paying." : "Shampoo, tools, flat irons, lash kits — you ship it to the buyer."}</span>
      </div>
      <div className="field"><label htmlFor={`pt-${k}`}>Name</label><input id={`pt-${k}`} name="title" required maxLength={80} defaultValue={product?.title ?? ""} placeholder={kind === "digital" ? "Get Booked Workbook" : "Pro Lash Kit"} /></div>
      <div className="field"><label htmlFor={`pd-${k}`}>Description</label><textarea id={`pd-${k}`} name="description" maxLength={2000} defaultValue={product?.description ?? ""} placeholder={kind === "digital" ? "42-page PDF: pricing, posting plan, DM scripts…" : "What's in the box, sizes, how to use it"} /></div>
      <div className="row" style={{ gap: 10 }}>
        <div className="field grow"><label htmlFor={`pp-${k}`}>Price ($)</label><input id={`pp-${k}`} name="price" inputMode="decimal" required defaultValue={d(product?.priceCents)} placeholder="25" /></div>
        {kind === "physical" && <div className="field grow"><label htmlFor={`ps-${k}`}>Shipping ($)</label><input id={`ps-${k}`} name="shipping" inputMode="decimal" defaultValue={d(product?.shippingCents ?? 0)} placeholder="0 = free" /></div>}
      </div>
      {kind === "physical" && <div className="field"><label htmlFor={`pk-${k}`}>How many do you have? (optional)</label><input id={`pk-${k}`} name="stock" inputMode="numeric" defaultValue={product?.stock ?? ""} placeholder="Leave blank for no limit" /></div>}
      <div className="col g4"><span className="lbl">Photo</span><ShopUpload userId={userId} kind="photo" name="photo" initialUrl={product?.photoUrl} /></div>
      {kind === "digital" && (
        <div className="col g4">
          <span className="lbl">The download</span>
          <ShopUpload userId={userId} kind="file" name="file" initialUrl={product?.fileUrl} initialLabel={product?.fileName} initialAccess={product?.fileAccess} initialSize={product?.fileSize} />
          <span className="xs muted">Only buyers get it — never shown on your page. PDF, ZIP, EPUB, MP4, MP3 or image, up to 200 MB.</span>
        </div>
      )}
      <label className="row small" style={{ gap: 10 }}><input type="checkbox" name="active" defaultChecked={product?.active ?? true} /> Show in my shop</label>
    </>
  );
}
