import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type Stripe from "stripe";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, partnerOrders, partnerProducts, professionalProfiles, users } from "@/db";
import { stripe } from "@/lib/stripe";
import { getSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/email";
import { inbox } from "@/lib/inbox";
import { money } from "@/lib/time";
import { SITE_URL } from "@/lib/public/site";

/**
 * Partner shop: digital downloads (workbooks, guides, presets) and physical products (shampoo, flat irons, lash kits)
 * sold from a partner page. Buyers check out with Stripe without a Nearest account. Nearest charges the card and sends
 * the money to the seller's payout account — digital orders right after payment, physical orders once marked shipped.
 * Card processing comes out of the seller's side, like bookings.
 */

export type ProductKind = "digital" | "physical";
export const SHOP_LIMITS = { products: 24, title: 80, description: 2000, maxQty: 10, shippingMax: 10000, fileMb: 200 } as const;
export const DIGITAL_TYPES = ["application/pdf", "application/zip", "application/x-zip-compressed", "application/epub+zip", "image/jpeg", "image/png", "video/mp4", "audio/mpeg", "audio/mp4"] as const;

export async function shopRules() {
  const s = await getSettings();
  return {
    feeCents: Math.max(0, Number(s["shop.order_fee_cents"]) || 0),
    maxPriceCents: Math.max(100, Number(s["shop.max_price_cents"]) || 50000),
    downloadLimit: Math.max(1, Number(s["shop.download_limit"]) || 10),
    downloadDays: Math.max(1, Number(s["shop.download_days"]) || 365),
  };
}

const sha = (t: string) => createHash("sha256").update(t).digest("hex");

/** A Blob upload this seller made (pros/<id>/shop… on Vercel Blob) — never someone else's file or an outside link. */
export function ownBlobUrl(url: string, userId: string, folder: "shop" | "shop-file") {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com") && decodeURIComponent(u.pathname).startsWith(`/pros/${userId}/${folder}/`);
  } catch { return false; }
}

/** Products a shopper can buy on this partner's page, in the seller's order. */
export async function shopProducts(userId: string) {
  return db.select().from(partnerProducts)
    .where(and(eq(partnerProducts.userId, userId), eq(partnerProducts.active, true), sql`${partnerProducts.archivedAt} is null`))
    .orderBy(asc(partnerProducts.sort), asc(partnerProducts.createdAt));
}

/** Can this seller take payments right now? (Payouts connected — money goes straight to them.) */
export async function sellerReady(userId: string) {
  const p = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, userId), columns: { stripeAccountId: true, payoutsEnabled: true } });
  return Boolean(p?.stripeAccountId && p.payoutsEnabled);
}

export const soldOut = (p: typeof partnerProducts.$inferSelect) => p.kind === "physical" && p.stock !== null && p.stock <= 0;

/** Starts Stripe Checkout for one product. Returns the Stripe URL to send the shopper to. */
export async function startShopCheckout(opts: { productId: string; qty: number; slug: string; origin: string }) {
  const product = await db.query.partnerProducts.findFirst({ where: eq(partnerProducts.id, opts.productId) });
  if (!product || !product.active || product.archivedAt) return { error: "This product isn't available." };
  if (product.kind === "digital" && !product.fileUrl) return { error: "This download isn't ready yet." };
  if (soldOut(product)) return { error: "Sold out." };
  if (!(await sellerReady(product.userId))) return { error: "This shop isn't taking orders yet." };
  const qty = product.kind === "digital" ? 1 : Math.min(SHOP_LIMITS.maxQty, Math.max(1, Math.floor(opts.qty) || 1));
  if (product.kind === "physical" && product.stock !== null && qty > product.stock) return { error: `Only ${product.stock} left.` };
  const rules = await shopRules();
  // Digital: the download key is made now so the thank-you page can show the Download button the moment payment
  // finishes (whether the page or Stripe's webhook confirms first). Only its hash is stored here.
  const dl = product.kind === "digital" ? randomBytes(24).toString("base64url") : null;
  const [order] = await db.insert(partnerOrders).values({
    productId: product.id, sellerId: product.userId, kind: product.kind, title: product.title, qty,
    unitCents: product.priceCents, shippingCents: product.kind === "physical" ? product.shippingCents : 0, feeCents: rules.feeCents,
    downloadTokenHash: dl ? sha(dl) : null,
  }).returning();
  const back = `${opts.origin}/link/${opts.slug}/shop/${product.id}`;
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ quantity: qty, price_data: { currency: "usd", unit_amount: product.priceCents, product_data: { name: product.title, ...(product.photoUrl ? { images: [product.photoUrl] } : {}), ...(product.description ? { description: product.description.slice(0, 300) } : {}) } } }],
    ...(product.kind === "physical"
      ? {
          shipping_address_collection: { allowed_countries: ["US"] },
          shipping_options: [{ shipping_rate_data: { type: "fixed_amount", display_name: product.shippingCents ? "Shipping" : "Free shipping", fixed_amount: { amount: product.shippingCents, currency: "usd" } } }],
        }
      : {}),
    customer_creation: "if_required",
    metadata: { kind: "shop", orderId: order.id, ...(dl ? { dl } : {}) },
    payment_intent_data: { metadata: { kind: "shop", orderId: order.id }, transfer_group: order.id },
    success_url: `${opts.origin}/link/${opts.slug}/shop/thanks?o=${order.id}${dl ? `&t=${dl}` : ""}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: back,
  }, { idempotencyKey: `shop-${order.id}` });
  await db.update(partnerOrders).set({ stripeSessionId: session.id }).where(eq(partnerOrders.id, order.id));
  return { url: session.url! };
}

/**
 * Marks an order paid from its finished Checkout session (called from the thank-you page AND the Stripe webhook —
 * whichever comes first does the work, the other changes nothing). Digital: a download link is created and emailed,
 * and the seller is paid. Physical: the seller is told to ship; they're paid when they mark it shipped.
 */
export async function confirmShopOrder(sessionId: string): Promise<{ orderId: string } | null> {
  const s = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.latest_charge.balance_transaction"] });
  const orderId = s.metadata?.orderId;
  if (s.metadata?.kind !== "shop" || !orderId || s.payment_status !== "paid") return null;
  const pi = s.payment_intent as Stripe.PaymentIntent | null;
  const ch = pi?.latest_charge as Stripe.Charge | null;
  const bt = ch?.balance_transaction as Stripe.BalanceTransaction | null;
  const addr = s.collected_information?.shipping_details?.address ?? s.customer_details?.address ?? null;
  const shipName = s.collected_information?.shipping_details?.name ?? s.customer_details?.name ?? null;
  const token = s.metadata?.dl ?? "";
  const [o] = await db.update(partnerOrders).set({
    status: "paid", paidAt: new Date(), totalCents: s.amount_total ?? 0, stripeFeeCents: bt?.fee ?? 0, stripeChargeId: ch?.id ?? null, stripeSessionId: s.id,
    buyerEmail: s.customer_details?.email?.toLowerCase() ?? null, buyerName: s.customer_details?.name ?? null,
    shipTo: addr ? { name: shipName ?? undefined, line1: addr.line1 ?? undefined, line2: addr.line2 ?? undefined, city: addr.city ?? undefined, state: addr.state ?? undefined, postal: addr.postal_code ?? undefined, country: addr.country ?? undefined } : null,
    payoutStatus: sql`case when ${partnerOrders.kind} = 'digital' then 'none' else 'waiting' end`,
  }).where(and(eq(partnerOrders.id, orderId), eq(partnerOrders.status, "pending"))).returning();
  if (!o) return { orderId }; // already done
  // Stock: never below zero.
  if (o.kind === "physical") await db.update(partnerProducts).set({ stock: sql`greatest(${partnerProducts.stock} - ${o.qty}, 0)` }).where(and(eq(partnerProducts.id, o.productId), sql`${partnerProducts.stock} is not null`));
  const seller = await db.query.users.findFirst({ where: eq(users.id, o.sellerId), columns: { email: true, firstName: true } });
  const prof = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, o.sellerId), columns: { slug: true, businessName: true, displayName: true } });
  const shopName = prof?.businessName ?? prof?.displayName ?? "the shop";
  const code = `#${String(o.number).padStart(5, "0")}`;
  if (o.kind === "digital") {
    const link = `${SITE_URL}/api/shop/download/${o.id}?t=${token}`;
    const rules = await shopRules();
    sendEmail({ to: o.buyerEmail, subject: `Your download: ${o.title}`, eyebrow: `Order ${code}`, heading: "Here's your download.", lines: [`${o.title} from ${shopName} — ${money(o.totalCents)} paid.`, `Keep this email. The button works ${rules.downloadLimit} times for ${rules.downloadDays} days.`], button: { label: "Download", url: link } }).catch(() => {});
    await payoutShopOrder(o.id);
    await inbox(o.sellerId, { kind: "shop", title: `Sold: ${o.title}`, body: `${money(o.totalCents)} · digital download sent to the buyer`, href: "/pro/partner/orders" });
    sendEmail({ to: seller?.email, subject: `You sold ${o.title}`, eyebrow: `Order ${code}`, heading: "You made a sale.", lines: [`${o.title} — ${money(o.totalCents)}. The buyer got their download right away.`], button: { label: "See orders", url: `${SITE_URL}/pro/partner/orders` } }).catch(() => {});
    return { orderId: o.id };
  }
  sendEmail({ to: o.buyerEmail, subject: `Order received: ${o.title}`, eyebrow: `Order ${code}`, heading: "Your order is in.", lines: [`${o.qty} × ${o.title} from ${shopName} — ${money(o.totalCents)} paid.`, "We'll email you when it ships."] }).catch(() => {});
  await inbox(o.sellerId, { kind: "shop", title: `New order to ship: ${o.title}`, body: `${o.qty} × ${o.title} · ${money(o.totalCents)}`, href: "/pro/partner/orders" });
  sendEmail({ to: seller?.email, subject: `New order to ship: ${o.title}`, eyebrow: `Order ${code}`, heading: "Ship this order.", lines: [`${o.qty} × ${o.title} — ${money(o.totalCents)}.`, "Open your orders for the shipping address, then tap Mark shipped. You're paid when it's marked shipped."], button: { label: "Open orders", url: `${SITE_URL}/pro/partner/orders` } }).catch(() => {});
  return { orderId: o.id };
}

/** What the seller receives: total minus Nearest's order fee minus card processing. */
export const sellerAmount = (o: typeof partnerOrders.$inferSelect) => Math.max(0, o.totalCents - o.feeCents - o.stripeFeeCents);

/** Sends the seller their money for a paid digital order or a shipped physical order (held as owed without payouts). */
export async function payoutShopOrder(orderId: string) {
  const o = await db.query.partnerOrders.findFirst({ where: eq(partnerOrders.id, orderId) });
  if (!o || o.payoutStatus === "sent" || o.status === "refunded") return;
  if (o.kind === "physical" && o.status !== "shipped") return;
  if (o.kind === "digital" && o.status !== "paid") return;
  const amount = sellerAmount(o);
  const pro = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, o.sellerId), columns: { stripeAccountId: true, payoutsEnabled: true } });
  if (amount <= 0) { await db.update(partnerOrders).set({ payoutStatus: "sent", payoutCents: 0 }).where(eq(partnerOrders.id, o.id)); return; }
  if (!pro?.stripeAccountId || !pro.payoutsEnabled) { await db.update(partnerOrders).set({ payoutStatus: "owed", payoutCents: amount }).where(eq(partnerOrders.id, o.id)); return; }
  try {
    const t = await stripe().transfers.create(
      { amount, currency: "usd", destination: pro.stripeAccountId, transfer_group: o.id, ...(o.stripeChargeId ? { source_transaction: o.stripeChargeId } : {}), metadata: { orderId: o.id, kind: "shop" } },
      { idempotencyKey: `shop-pay-${o.id}` },
    );
    await db.update(partnerOrders).set({ payoutStatus: "sent", payoutCents: amount, transferId: t.id }).where(eq(partnerOrders.id, o.id));
  } catch (e) {
    console.error("Shop payout failed", o.id, e);
    await db.update(partnerOrders).set({ payoutStatus: "owed", payoutCents: amount }).where(eq(partnerOrders.id, o.id));
  }
}

/** Payouts just turned on (or a transfer failed earlier): send every shop order waiting on this seller. */
export async function payOwedShopOrders(sellerId: string) {
  const owed = await db.select({ id: partnerOrders.id }).from(partnerOrders).where(and(eq(partnerOrders.sellerId, sellerId), eq(partnerOrders.payoutStatus, "owed")));
  for (const o of owed) {
    await db.update(partnerOrders).set({ payoutStatus: "none" }).where(eq(partnerOrders.id, o.id));
    await payoutShopOrder(o.id);
  }
}

/** Download check: right token, paid digital order, under the download limit, within the time limit. */
export async function downloadFor(orderId: string, token: string) {
  if (!/^[0-9a-f-]{36}$/.test(orderId) || !token) return { error: "This download link isn't valid." as const };
  const o = await db.query.partnerOrders.findFirst({ where: eq(partnerOrders.id, orderId) });
  if (!o || o.kind !== "digital" || o.status !== "paid" || !o.downloadTokenHash || o.downloadTokenHash !== sha(token)) return { error: "This download link isn't valid." as const };
  const rules = await shopRules();
  if (o.paidAt && Date.now() - o.paidAt.getTime() > rules.downloadDays * 86400_000) return { error: "This download link has expired. Contact the seller for a new copy." as const };
  const [bumped] = await db.update(partnerOrders).set({ downloads: sql`${partnerOrders.downloads} + 1` })
    .where(and(eq(partnerOrders.id, o.id), sql`${partnerOrders.downloads} < ${rules.downloadLimit}`)).returning({ n: partnerOrders.downloads });
  if (!bumped) return { error: `This link has been used ${rules.downloadLimit} times. Contact the seller for a new copy.` as const };
  const product = await db.query.partnerProducts.findFirst({ where: eq(partnerProducts.id, o.productId) });
  if (!product?.fileUrl) return { error: "This file isn't available right now. Contact the seller." as const };
  return { product, order: o };
}

/** Owner: refund an order that hasn't been paid out to the seller yet (unshipped physical, or failed payout). */
export async function refundShopOrder(orderId: string, by: string) {
  const o = await db.query.partnerOrders.findFirst({ where: eq(partnerOrders.id, orderId) });
  if (!o || !["paid", "shipped"].includes(o.status)) return { error: "Only paid orders can be refunded." };
  if (o.payoutStatus === "sent") return { error: "The seller has already been paid for this order — ask them to refund the buyer directly." };
  if (!o.stripeChargeId) return { error: "No card payment found for this order." };
  await stripe().refunds.create({ charge: o.stripeChargeId }, { idempotencyKey: `shop-refund-${o.id}` });
  await db.update(partnerOrders).set({ status: "refunded", refundedAt: new Date(), refundedBy: by, payoutStatus: "none", payoutCents: 0, downloadTokenHash: null }).where(eq(partnerOrders.id, o.id));
  if (o.kind === "physical") await db.update(partnerProducts).set({ stock: sql`${partnerProducts.stock} + ${o.qty}` }).where(and(eq(partnerProducts.id, o.productId), sql`${partnerProducts.stock} is not null`));
  sendEmail({ to: o.buyerEmail, subject: `Refund: ${o.title}`, eyebrow: `Order #${String(o.number).padStart(5, "0")}`, heading: "Your order was refunded.", lines: [`${money(o.totalCents)} is on its way back to your card. Refunds usually show in 5–10 business days.`] }).catch(() => {});
  await inbox(o.sellerId, { kind: "shop", title: `Order refunded: ${o.title}`, body: "Nearest refunded this order before it was paid out.", href: "/pro/partner/orders" });
  return { ok: true, before: o.status };
}
