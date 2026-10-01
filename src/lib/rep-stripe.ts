import "server-only";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, salesReps } from "@/db";
import { stripe } from "./stripe";
import { destinationLabel } from "./partner-stripe";

/** Keeps a sales rep's payout status in step with Stripe (called from the webhook and when they open their dashboard). */
export async function saveRepAccount(a: Stripe.Account) {
  await db.update(salesReps)
    .set({ payoutsEnabled: Boolean(a.payouts_enabled), payoutDestination: destinationLabel(a) })
    .where(eq(salesReps.stripeAccountId, a.id));
}

export async function syncRepStripe(repId: string) {
  const r = await db.query.salesReps.findFirst({ where: eq(salesReps.id, repId) });
  if (!r?.stripeAccountId) return;
  try { await saveRepAccount(await stripe().accounts.retrieve(r.stripeAccountId)); } catch (e) { console.error(e); }
}
