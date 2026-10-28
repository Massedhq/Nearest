import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, partnerOrders } from "@/db";
import { confirmShopOrder } from "@/lib/shop";
import { money } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Thank you", robots: { index: false } };
const ACCENT = "#E8C4C0";

/** After Stripe Checkout: confirms the order, then shows the Download button (digital) or the order summary (physical). */
export default async function ShopThanks({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ o?: string; t?: string; session_id?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const oid = /^[0-9a-f-]{36}$/.test(sp.o ?? "") ? sp.o! : null;
  if (sp.session_id && /^cs_[A-Za-z0-9_]+$/.test(sp.session_id)) { try { await confirmShopOrder(sp.session_id); } catch (e) { console.error("shop confirm", e); } }
  const o = oid ? await db.query.partnerOrders.findFirst({ where: eq(partnerOrders.id, oid) }) : undefined;
  const paid = o && (o.status === "paid" || o.status === "shipped") && (!sp.session_id || o.stripeSessionId === sp.session_id);
  const back = `/link/${slug.toLowerCase()}`;
  const btn = { display: "block", textAlign: "center" as const, borderRadius: 999, padding: 17, textDecoration: "none", fontWeight: 800, fontSize: 13, letterSpacing: 2, textTransform: "uppercase" as const };
  return (
    <div style={{ minHeight: "100dvh", background: "#000", color: "#F4F1EA", fontFamily: "var(--font-body), system-ui, sans-serif" }}>
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "48px 16px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
        {paid ? (
          <>
            <div style={{ width: 64, height: 64, borderRadius: 32, background: ACCENT, color: "#0B0B0C", display: "flex", alignItems: "center", justifyContent: "center" }}><svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></div>
            <h1 style={{ margin: 0, fontFamily: "var(--font-display), Georgia, serif", fontWeight: 500, fontSize: 34 }}>{o!.kind === "digital" ? "Your download is ready." : "Your order is in."}</h1>
            <span style={{ fontSize: 15, color: "#D9D4CA", lineHeight: 1.5 }}>{o!.qty > 1 ? `${o!.qty} × ` : ""}{o!.title} — {money(o!.totalCents)} paid. Order #{String(o!.number).padStart(5, "0")}.</span>
            {o!.kind === "digital" && sp.t && <a href={`/api/shop/download/${o!.id}?t=${encodeURIComponent(sp.t)}`} style={{ ...btn, background: ACCENT, color: "#0B0B0C" }}>Download now</a>}
            <span style={{ fontSize: 13, color: "#B8B2A7", lineHeight: 1.5 }}>{o!.kind === "digital" ? "We also emailed you the download link — keep that email to download it again later." : "We emailed your receipt. You'll get another email when it ships."}</span>
          </>
        ) : (
          <>
            <h1 style={{ margin: 0, fontFamily: "var(--font-display), Georgia, serif", fontWeight: 500, fontSize: 30 }}>Finishing your order…</h1>
            <span style={{ fontSize: 14, color: "#D9D4CA", lineHeight: 1.5 }}>Your payment is still being confirmed. Refresh this page in a moment — your receipt and any download link also come by email.</span>
          </>
        )}
        <Link href={back} style={{ ...btn, border: "1px solid #3A3A3F", color: "#F4F1EA" }}>Back to the page</Link>
      </main>
    </div>
  );
}

