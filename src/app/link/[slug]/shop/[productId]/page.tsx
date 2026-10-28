import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, partnerProducts } from "@/db";
import { publicPartnerPage, partnerPagePath } from "@/lib/partners";
import { personName } from "@/lib/pro-name";
import { sellerReady, soldOut, SHOP_LIMITS } from "@/lib/shop";
import { money } from "@/lib/time";
import { abs } from "@/lib/public/site";
import { BuyForm } from "./BuyForm";

export const dynamic = "force-dynamic";
const ACCENT = "#E8C4C0";

async function load(slug: string, productId: string) {
  if (!/^[0-9a-f-]{36}$/.test(productId)) return null;
  const r = await publicPartnerPage(slug);
  if (!r) return null;
  const product = await db.query.partnerProducts.findFirst({ where: and(eq(partnerProducts.id, productId), eq(partnerProducts.userId, r.p.userId), eq(partnerProducts.active, true), sql`${partnerProducts.archivedAt} is null`) });
  return product ? { r, product } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productId: string }> }) {
  const { slug, productId } = await params;
  const x = await load(slug, productId);
  if (!x) return { title: "Nearest" };
  const name = personName(x.r.p.displayName, x.r.u.firstName, x.r.u.lastName);
  return { title: `${x.product.title} · ${name}`, description: x.product.description?.slice(0, 160) ?? `${x.product.title} from ${name}.`, manifest: `${partnerPagePath(x.r.p.slug!)}/manifest.webmanifest`, openGraph: { title: x.product.title, url: abs(`${partnerPagePath(x.r.p.slug!)}/shop/${productId}`), ...(x.product.photoUrl ? { images: [x.product.photoUrl] } : {}) } };
}

/** Public product page on a partner's page: digital download (delivered right after paying) or physical product. */
export default async function ProductPage({ params }: { params: Promise<{ slug: string; productId: string }> }) {
  const { slug, productId } = await params;
  const x = await load(slug, productId);
  if (!x) notFound();
  const { r, product } = x;
  const name = personName(r.p.displayName, r.u.firstName, r.u.lastName);
  const ready = await sellerReady(r.p.userId);
  const out = soldOut(product);
  const digital = product.kind === "digital";
  return (
    <div style={{ minHeight: "100dvh", background: "#000", color: "#F4F1EA", fontFamily: "var(--font-body), system-ui, sans-serif" }}>
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "22px 16px 32px", display: "flex", flexDirection: "column", gap: 18 }}>
        <Link href={partnerPagePath(r.p.slug!)} style={{ display: "flex", alignItems: "center", gap: 8, color: "#F4F1EA", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M15 5l-7 7 7 7" /></svg>{name}
        </Link>
        {product.photoUrl
          ? <Image src={product.photoUrl} alt={product.title} width={480} height={480} priority style={{ width: "100%", height: "auto", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 18 }} />
          : <div style={{ aspectRatio: "1 / 1", borderRadius: 18, background: "linear-gradient(160deg, #2A2320, #121214)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display), Georgia, serif", fontSize: 28, padding: 24, textAlign: "center" }}>{product.title}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 11, letterSpacing: 2, color: "#D4B886", textTransform: "uppercase", fontWeight: 800 }}>{digital ? "Digital download" : "Ships to you"}</span>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display), Georgia, serif", fontWeight: 500, fontSize: 30, lineHeight: 1.1 }}>{product.title}</h1>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{money(product.priceCents)}</span>
        </div>
        {product.description && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#D9D4CA", whiteSpace: "pre-wrap" }}>{product.description}</p>}
        {digital && <span style={{ fontSize: 13, color: "#B8B2A7" }}>Download it right after you pay{product.fileName ? ` (${product.fileName.split(".").pop()?.toUpperCase()})` : ""}. The link is also emailed to you.</span>}
        {!ready ? <div style={{ border: "1px solid #3A3A3F", borderRadius: 16, padding: 16, textAlign: "center", fontSize: 13 }}>This shop opens soon.</div>
          : out ? <div style={{ border: "1px solid #3A3A3F", borderRadius: 16, padding: 16, textAlign: "center", fontSize: 13 }}>Sold out.</div>
          : <BuyForm productId={product.id} slug={r.p.slug!} physical={!digital} maxQty={Math.min(SHOP_LIMITS.maxQty, product.stock ?? SHOP_LIMITS.maxQty)} priceCents={product.priceCents} shippingCents={product.shippingCents} accent={ACCENT} />}
        <span style={{ fontSize: 12, color: "#8E897F", lineHeight: 1.5 }}>Sold by {r.p.businessName ?? name}. Questions about this product go to the seller; payments are handled securely by Nearest.</span>
      </main>
    </div>
  );
}
