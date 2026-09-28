import "server-only";
import { stripe } from "./stripe";

/**
 * Creates a Stripe connected account for payouts (bank account or debit card), Express-style.
 * Uses Stripe's current "controller" settings first; falls back to the older `type: "express"` only if needed.
 */
export type Prefill = {
  firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null; dob?: string | null; // YYYY-MM-DD
  url?: string; productDescription?: string; mcc?: string;
};

/** Fields Stripe would otherwise ask for (website, what you sell, name, birthday…), filled from Nearest. */
function prefillParams(p: Prefill) {
  const d = p.dob && /^\d{4}-\d{2}-\d{2}$/.test(p.dob) ? p.dob.split("-").map(Number) : null;
  const phone = p.phone && /^\+1\d{10}$/.test(p.phone.replace(/[^\d+]/g, "")) ? p.phone.replace(/[^\d+]/g, "") : undefined;
  return {
    business_profile: { ...(p.url ? { url: p.url } : {}), ...(p.productDescription ? { product_description: p.productDescription } : {}), ...(p.mcc ? { mcc: p.mcc } : {}) },
    individual: {
      ...(p.firstName ? { first_name: p.firstName } : {}), ...(p.lastName ? { last_name: p.lastName } : {}),
      ...(p.email ? { email: p.email } : {}), ...(phone ? { phone } : {}),
      ...(d ? { dob: { year: d[0], month: d[1], day: d[2] } } : {}),
    },
  };
}

/**
 * Creates a Stripe connected account for payouts (bank account or debit card), Express-style, pre-filled so
 * people only enter what the law requires (bank/card, SSN last 4, address). Uses Stripe's current "controller"
 * settings first; falls back to the older `type: "express"`, and to no pre-fill, only if needed.
 */
export async function createPayoutAccount(opts: { email?: string | null; metadata: Record<string, string>; prefill?: Prefill }) {
  const base = { country: "US", email: opts.email ?? undefined, business_type: "individual" as const, capabilities: { transfers: { requested: true } }, metadata: opts.metadata };
  const filled = opts.prefill ? { ...base, ...prefillParams(opts.prefill) } : base;
  const controller = { stripe_dashboard: { type: "express" as const }, fees: { payer: "application" as const }, losses: { payments: "application" as const }, requirement_collection: "stripe" as const };
  const attempts = [
    () => stripe().accounts.create({ ...filled, controller }),
    () => stripe().accounts.create({ ...base, controller }),
    () => stripe().accounts.create({ ...filled, type: "express" }),
    () => stripe().accounts.create({ ...base, type: "express" }),
  ];
  let first: unknown;
  for (const a of attempts) {
    try { return await a(); } catch (e) { first ??= e; }
  }
  throw first;
}

/** Existing accounts that haven't finished Stripe's form: add the pre-fill so the remaining questions drop away. */
export async function prefillExisting(accountId: string, prefill: Prefill) {
  try { await stripe().accounts.update(accountId, prefillParams(prefill)); } catch { /* Stripe may lock fields once submitted — fine */ }
}
