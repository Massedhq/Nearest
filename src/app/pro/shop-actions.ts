"use server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, partnerOrders, partnerProducts } from "@/db";
import { requirePro } from "@/lib/pro";
import { partnerPageFor } from "@/lib/partners";
import { ownBlobUrl, payoutShopOrder, shopRules, SHOP_LIMITS } from "@/lib/shop";
import { sendEmail } from "@/lib/email";

type FormState = { error?: string; ok?: string };
const str = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);
const dollars = (raw: string) => { const n = Number(raw.replace(/[$,\s]/g, "")); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };

async function requirePartner() {
  const { user } = await requirePro();
  const page = await partnerPageFor(user.id);
  if (!page) throw new Error("Your partner page isn't approved yet.");
  if (page.pausedAt) throw new Error("Nearest paused your partner page. Contact support.");
  return user;
}

/** Add or edit a product (digital download or physical product). */
export async function saveProduct(_: FormState, form: FormData): Promise<FormState> {
  let user;
  try { user = await requirePartner(); } catch (e) { return { error: (e as Error).message }; }
  const id = str(form, "id", 40);
  const kind = str(form, "kind", 10) === "physical" ? "physical" : "digital";
  const title = str(form, "title", SHOP_LIMITS.title);
  const description = str(form, "description", SHOP_LIMITS.description) || null;
  const price = dollars(str(form, "price", 12));
  const rules = await shopRules();
  if (title.length < 2) return { error: "Give the product a name." };
  if (!Number.isInteger(price) || price < 100) return { error: "Enter a price of at least $1." };
  if (price > rules.maxPriceCents) return { error: `The highest price is $${(rules.maxPriceCents / 100).toFixed(0)}.` };
  const photoUrl = str(form, "photo", 600) || null;
  if (photoUrl && !ownBlobUrl(photoUrl, user.id, "shop")) return { error: "Upload the photo again." };

  let shippingCents = 0, stock: number | null = null;
  let file: { fileUrl: string | null; fileAccess: string | null; fileName: string | null; fileSize: number | null } = { fileUrl: null, fileAccess: null, fileName: null, fileSize: null };
  if (kind === "physical") {
    shippingCents = str(form, "shipping", 12) ? dollars(str(form, "shipping", 12)) : 0;
    if (!Number.isInteger(shippingCents) || shippingCents < 0 || shippingCents > SHOP_LIMITS.shippingMax) return { error: "Shipping must be between $0 and $100." };
    const rawStock = str(form, "stock", 6);
    if (rawStock) { stock = Number(rawStock); if (!Number.isInteger(stock) || stock < 0 || stock > 99999) return { error: "Enter how many you have, or leave it blank for no limit." }; }
  } else {
    const fileUrl = str(form, "file", 600);
    if (!fileUrl) return { error: "Upload the file buyers will download." };
    if (!ownBlobUrl(fileUrl, user.id, "shop-file")) return { error: "Upload the file again." };
    file = { fileUrl, fileAccess: str(form, "file_access", 10) === "public" ? "public" : "private", fileName: str(form, "file_name", 120) || "download", fileSize: Number(str(form, "file_size", 12)) || null };
  }
  const active = form.get("active") === "on";
  const values = { kind, title, description, priceCents: price, shippingCents, stock, photoUrl, ...file, active, updatedAt: new Date() };

  if (id) {
    const before = await db.query.partnerProducts.findFirst({ where: and(eq(partnerProducts.id, id), eq(partnerProducts.userId, user.id)) });
    if (!before) return { error: "Product not found." };
    // Keeping the same file: the form sends the existing URL back unchanged.
    await db.update(partnerProducts).set(values).where(eq(partnerProducts.id, id));
  } else {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(partnerProducts).where(and(eq(partnerProducts.userId, user.id), sql`${partnerProducts.archivedAt} is null`));
    if (n >= SHOP_LIMITS.products) return { error: `Up to ${SHOP_LIMITS.products} products.` };
    await db.insert(partnerProducts).values({ userId: user.id, ...values, sort: n });
  }
  revalidatePath("/pro/partner/shop");
  return { ok: active ? "Saved — it's in your shop." : "Saved. It's hidden until you turn on Show in my shop." };
}

/** Take a product out of the shop for good (orders already placed keep working, downloads included). */
export async function removeProduct(_: FormState, form: FormData): Promise<FormState> {
  let user;
  try { user = await requirePartner(); } catch (e) { return { error: (e as Error).message }; }
  const id = str(form, "id", 40);
  const [row] = await db.update(partnerProducts).set({ archivedAt: new Date(), active: false }).where(and(eq(partnerProducts.id, id), eq(partnerProducts.userId, user.id))).returning();
  if (!row) return { error: "Product not found." };
  revalidatePath("/pro/partner/shop");
  return { ok: "Removed from your shop." };
}

/** Seller marks a physical order shipped (optional carrier + tracking): the buyer is emailed and the seller is paid. */
export async function markShipped(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePro();
  const id = str(form, "id", 40);
  const carrier = str(form, "carrier", 40) || null;
  const tracking = str(form, "tracking", 80) || null;
  const [o] = await db.update(partnerOrders).set({ status: "shipped", shippedAt: new Date(), carrier, tracking })
    .where(and(eq(partnerOrders.id, id), eq(partnerOrders.sellerId, user.id), eq(partnerOrders.kind, "physical"), eq(partnerOrders.status, "paid"))).returning();
  if (!o) return { error: "This order can't be marked shipped." };
  await payoutShopOrder(o.id);
  sendEmail({ to: o.buyerEmail, subject: `Shipped: ${o.title}`, eyebrow: `Order #${String(o.number).padStart(5, "0")}`, heading: "Your order shipped.", lines: [`${o.qty} × ${o.title} is on its way.`, ...(tracking ? [`${carrier ? `${carrier} ` : ""}tracking: ${tracking}`] : [])] }).catch(() => {});
  revalidatePath("/pro/partner/orders");
  return { ok: "Marked shipped — the buyer was emailed." };
}
