"use server";
import { redirect } from "next/navigation";
import { origin } from "@/lib/stripe";
import { startShopCheckout } from "@/lib/shop";

type FormState = { error?: string; ok?: string };

/** Public: Buy now on a partner's product page → Stripe Checkout (no Nearest account needed). */
export async function buyProduct(_: FormState, form: FormData): Promise<FormState> {
  const productId = String(form.get("productId") ?? "");
  const slug = String(form.get("slug") ?? "").toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(productId) || !/^[a-z0-9-]{2,40}$/.test(slug)) return { error: "This product isn't available." };
  let url: string | undefined;
  try {
    const r = await startShopCheckout({ productId, qty: Number(form.get("qty") ?? 1), slug, origin: await origin() });
    if ("error" in r) return { error: r.error };
    url = r.url;
  } catch (e) {
    console.error("Shop checkout failed", e);
    return { error: "Checkout couldn't start. Try again in a minute." };
  }
  redirect(url);
}
