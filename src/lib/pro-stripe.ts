import "server-only";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, professionalProfiles } from "@/db";
import { stripe, stripeEnabled } from "./stripe";

type Profile = typeof professionalProfiles.$inferSelect;

export async function saveSubscription(userId: string, sub: Stripe.Subscription) {
  const end = sub.items.data[0]?.current_period_end;
  await db.update(professionalProfiles).set({
    subscriptionId: sub.id,
    subscriptionStatus: sub.status,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    currentPeriodEnd: end ? new Date(end * 1000) : null,
  }).where(eq(professionalProfiles.userId, userId));
}

/** Pulls the latest membership, ID and payout status from Stripe so the page is always current (works without webhooks). */
export async function syncPro(p: Profile): Promise<Profile> {
  if (!stripeEnabled()) return p;
  const s = stripe();
  const patch: Partial<Profile> = {};
  try {
    if (p.subscriptionId) {
      const sub = await s.subscriptions.retrieve(p.subscriptionId);
      await saveSubscription(p.userId, sub);
    }
    if (p.identitySessionId && p.identityStatus !== "verified") {
      const vs = await s.identity.verificationSessions.retrieve(p.identitySessionId);
      patch.identityStatus = vs.status === "verified" ? "verified" : vs.status === "processing" ? "pending" : vs.status === "requires_input" ? "rejected" : p.identityStatus;
    }
    if (p.stripeAccountId && !p.payoutsEnabled) {
      const acct = await s.accounts.retrieve(p.stripeAccountId);
      patch.payoutsEnabled = Boolean(acct.payouts_enabled);
    }
    if (Object.keys(patch).length) await db.update(professionalProfiles).set(patch).where(eq(professionalProfiles.userId, p.userId));
  } catch (e) {
    console.error("Stripe sync failed", e);
  }
  return (await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, p.userId) }))!;
}
