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
  FIRST_IN: { key: "nearest_pro_first_in_11", cents: 1100, name: "Nearest Pro — First In ($11/mo first 12 months)" }, // new sign-ups; earlier $10 members keep their price
  PRO_STUDENT: { key: "nearest_pro_student_16", cents: 1600, name: "Nearest Pro — Professional + Student ($16/mo first 12 months)" },
  GENERAL: { key: "nearest_pro_general_21", cents: 2100, name: "Nearest Pro — General Entry ($21/mo first 12 months)" },
  // Earlier plans, kept so existing subscriptions keep working
  FOUNDING: { key: "nearest_pro_founding_10", cents: 1000, name: "Nearest Pro — First In ($10/mo first 12 months)" },
  SECOND: { key: "nearest_pro_second_20", cents: 2000, name: "Nearest Pro — Early ($20/mo first 12 months)" },
  STANDARD: { key: "nearest_pro_standard_30", cents: 3000, name: "Nearest Pro — Standard" },
} as const;

/** Finds (or creates once) the monthly price for a plan, using a fixed lookup key. */
export type PlanKey = keyof typeof PLANS;
export async function priceFor(cohort: PlanKey) {
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
