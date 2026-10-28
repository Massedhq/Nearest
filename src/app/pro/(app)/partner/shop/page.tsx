import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, partnerProducts } from "@/db";
import { requirePro } from "@/lib/pro";
import { partnerPageFor } from "@/lib/partners";
import { sellerReady, shopRules, SHOP_LIMITS } from "@/lib/shop";
import { ActionForm } from "@/components/ActionForm";
import { ProductFields } from "@/components/ProductFields";
import { TopBar } from "@/components/TopBar";
import { saveProduct, removeProduct } from "@/app/pro/shop-actions";
import { money } from "@/lib/time";

export const metadata = { title: "My shop" };
export const dynamic = "force-dynamic";

/** Partner page → Shop: digital downloads and physical products buyers purchase right on the partner page. */
export default async function ShopEditor() {
  const { user } = await requirePro();
  const page = await partnerPageFor(user.id);
  if (!page) redirect("/pro/partner");
  const [products, ready, rules] = await Promise.all([
    db.select().from(partnerProducts).where(and(eq(partnerProducts.userId, user.id), sql`${partnerProducts.archivedAt} is null`)).orderBy(asc(partnerProducts.sort), asc(partnerProducts.createdAt)),
    sellerReady(user.id),
    shopRules(),
  ]);
  return (
    <div className="scr">
      <TopBar title="My shop" back="/pro/partner" />
      <div className="body" style={{ gap: 16 }}>
        {!ready && (
          <div className="card" style={{ gap: 8, borderColor: "#5A4A22" }}>
            <span className="b">Connect payouts to start selling</span>
            <span className="small muted">Buyers pay on Nearest and the money goes to your payout account, so your shop shows &quot;opens soon&quot; until payouts are connected.</span>
            <Link className="btn sm" href="/pro/payments">Set up payouts</Link>
          </div>
        )}
        <div className="card" style={{ gap: 6 }}>
          <span className="small">Digital downloads are delivered the moment someone pays — they get a Download button on screen and in their email. Physical products: you get the shipping address, ship it, then tap Mark shipped in Orders.</span>
          <span className="xs muted">{rules.feeCents ? `Nearest's fee is ${money(rules.feeCents)} per order, and card processing comes out of each sale.` : "Card processing comes out of each sale."} Digital sales are paid out right away; physical sales when you mark them shipped.</span>
          <Link className="link small" href="/pro/partner/orders">See my orders</Link>
        </div>

        {products.map((p) => (
          <details key={p.id} className="card" style={{ gap: 10 }}>
            <summary className="row between" style={{ cursor: "pointer", gap: 8 }}>
              <span className="col g4"><span className="b">{p.title}</span><span className="small muted">{p.kind === "digital" ? "Digital download" : `Physical${p.stock !== null ? ` · ${p.stock} left` : ""}`} · {money(p.priceCents)}</span></span>
              <span className={`tag ${p.active ? "ok" : ""}`}>{p.active ? "In shop" : "Hidden"}</span>
            </summary>
            <ActionForm action={saveProduct} submitLabel="Save product" className="col g12"><ProductFields userId={user.id} product={p} /></ActionForm>
            <ActionForm action={removeProduct} submitLabel="Remove from shop" buttonClass="btn ghost sm" className="col g4"><input type="hidden" name="id" value={p.id} /></ActionForm>
          </details>
        ))}

        {products.length < SHOP_LIMITS.products ? (
          <div className="card" style={{ gap: 12 }}>
            <span className="disp h3">Add a product</span>
            <ActionForm action={saveProduct} submitLabel="Add to my shop" className="col g12"><ProductFields userId={user.id} /></ActionForm>
          </div>
        ) : <span className="small muted">You have the most products a shop can hold ({SHOP_LIMITS.products}).</span>}
      </div>
    </div>
  );
}
