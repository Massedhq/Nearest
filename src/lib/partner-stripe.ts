import "server-only";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, adminMembers } from "@/db";
import { stripe } from "./stripe";

/** "Chase ••••4417" or "Visa debit ••••1234" — the only payout detail Nearest keeps. */
export function destinationLabel(a: Stripe.Account) {
  const ea = a.external_accounts?.data?.[0];
  if (!ea) return null;
  if (ea.object === "bank_account") return `${ea.bank_name ?? "Bank account"} ••••${ea.last4}`;
  if (ea.object === "card") return `${ea.brand ?? "Card"} debit ••••${ea.last4}`;
  return null;
}

export async function savePartnerAccount(a: Stripe.Account) {
  await db.update(adminMembers)
    .set({ stripePayoutsEnabled: Boolean(a.payouts_enabled), payoutDestination: destinationLabel(a) })
    .where(eq(adminMembers.stripeAccountId, a.id));
}

export async function syncPartnerStripe(userId: string) {
  const m = await db.query.adminMembers.findFirst({ where: eq(adminMembers.userId, userId) });
  if (!m?.stripeAccountId) return;
  await savePartnerAccount(await stripe().accounts.retrieve(m.stripeAccountId));
}
