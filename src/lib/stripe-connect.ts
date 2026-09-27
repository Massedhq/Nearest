import "server-only";
import { stripe } from "./stripe";

/**
 * Creates a Stripe connected account for payouts (bank account or debit card), Express-style.
 * Uses Stripe's current "controller" settings first; falls back to the older `type: "express"` only if needed.
 */
export async function createPayoutAccount(opts: { email?: string | null; metadata: Record<string, string> }) {
  const base = { country: "US", email: opts.email ?? undefined, business_type: "individual" as const, capabilities: { transfers: { requested: true } }, metadata: opts.metadata };
  try {
    return await stripe().accounts.create({
      ...base,
      controller: { stripe_dashboard: { type: "express" }, fees: { payer: "application" }, losses: { payments: "application" }, requirement_collection: "stripe" },
    });
  } catch (first) {
    try {
      return await stripe().accounts.create({ ...base, type: "express" });
    } catch {
      throw first; // report Stripe's answer to the current method
    }
  }
}
