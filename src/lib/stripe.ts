import "server-only";
import Stripe from "stripe";
import { headers } from "next/headers";

let client: Stripe | null = null;

export const stripeEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Payments aren't set up yet (STRIPE_SECRET_KEY is missing).");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

const PLANS = {
  FOUNDING: { key: "nearest_pro_founding_10", cents: 1000, name: "Nearest Pro — Founding ($10/mo first 12 months)" },
  SECOND: { key: "nearest_pro_second_20", cents: 2000, name: "Nearest Pro — Early ($20/mo first 12 months)" },
  STANDARD: { key: "nearest_pro_standard_30", cents: 3000, name: "Nearest Pro — Standard" },
} as const;

/** Finds (or creates once) the monthly price for a cohort, using a fixed lookup key. */
export async function priceFor(cohort: keyof typeof PLANS) {
  const plan = PLANS[cohort];
  const s = stripe();
  const found = await s.prices.list({ lookup_keys: [plan.key], active: true, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const created = await s.prices.create({
    currency: "usd", unit_amount: plan.cents, recurring: { interval: "month" }, lookup_key: plan.key, product_data: { name: plan.name },
  });
  return created.id;
}

export const planCents = (cohort: keyof typeof PLANS) => PLANS[cohort].cents;
