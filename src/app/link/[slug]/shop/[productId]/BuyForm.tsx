"use client";
import { useActionState, useState } from "react";
import { buyProduct } from "@/app/shop-actions";

/** Quantity (physical only) + Buy now → Stripe Checkout. */
export function BuyForm({ productId, slug, physical, maxQty, priceCents, shippingCents, accent }: { productId: string; slug: string; physical: boolean; maxQty: number; priceCents: number; shippingCents: number; accent: string }) {
  const [state, run, pending] = useActionState(buyProduct, {});
  const [qty, setQty] = useState(1);
  const total = priceCents * qty + (physical ? shippingCents : 0);
  const $ = (c: number) => `$${(c / 100).toFixed(2).replace(/\.00$/, "")}`;
  return (
    <form action={run} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="qty" value={qty} />
      {physical && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>Quantity</span>
          <button type="button" aria-label="Fewer" onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid #2A2A2E", background: "#121214", color: "#F4F1EA", cursor: "pointer" }}>−</button>
          <b style={{ width: 28, textAlign: "center" }}>{qty}</b>
          <button type="button" aria-label="More" onClick={() => setQty(Math.min(maxQty, qty + 1))} style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid #2A2A2E", background: "#121214", color: "#F4F1EA", cursor: "pointer" }}>+</button>
        </div>
      )}
      {physical && <span style={{ fontSize: 13, color: "#B8B2A7" }}>{shippingCents ? `Shipping ${$(shippingCents)}` : "Free shipping"} · Total {$(total)}</span>}
      {state.error && <p role="alert" style={{ margin: 0, color: "#F2A99A", fontSize: 13 }}>{state.error}</p>}
      <button type="submit" disabled={pending} style={{ width: "100%", background: accent, color: "#0B0B0C", border: "none", borderRadius: 999, padding: 17, font: "800 13px var(--font-body), system-ui, sans-serif", letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
        {pending ? "Opening checkout…" : physical ? `Buy now · ${$(total)}` : `Buy & download · ${$(total)}`}
      </button>
      <span style={{ fontSize: 12, color: "#8E897F", textAlign: "center" }}>Secure checkout on Nearest. No account needed.</span>
    </form>
  );
}
