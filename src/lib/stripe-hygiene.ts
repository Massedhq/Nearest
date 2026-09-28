import "server-only";
import { eq, isNotNull, or } from "drizzle-orm";
import { db, professionalProfiles, adminMembers } from "@/db";
import { stripe } from "./stripe";

const missing = (e: unknown) => {
  const x = e as { code?: string; statusCode?: number; message?: string };
  return x?.code === "resource_missing" || x?.statusCode === 404 || /No such (customer|account|subscription)/i.test(x?.message ?? "");
};
async function exists(kind: "customer" | "account" | "subscription", id: string) {
  try {
    if (kind === "customer") { const c = await stripe().customers.retrieve(id); return !("deleted" in c && c.deleted); }
    if (kind === "account") { await stripe().accounts.retrieve(id); return true; }
    await stripe().subscriptions.retrieve(id); return true;
  } catch (e) { if (missing(e)) return false; throw e; }
}

export type Stale = { who: "professional" | "owner"; userId: string; name: string; customer?: string; account?: string; subscription?: string };

/** Stripe links saved in Nearest that don't exist in the Stripe account the site uses now (left over from test mode). */
export async function findStaleStripeRefs(limit = 60): Promise<Stale[]> {
  const pros = await db.select().from(professionalProfiles)
    .where(or(isNotNull(professionalProfiles.stripeCustomerId), isNotNull(professionalProfiles.stripeAccountId), isNotNull(professionalProfiles.subscriptionId))).limit(limit);
  const owners = await db.select().from(adminMembers).where(isNotNull(adminMembers.stripeAccountId));
  const out: Stale[] = [];
  for (const p of pros) {
    const s: Stale = { who: "professional", userId: p.userId, name: p.businessName ?? "Professional" };
    if (p.stripeCustomerId && !(await exists("customer", p.stripeCustomerId))) s.customer = p.stripeCustomerId;
    if (p.stripeAccountId && !(await exists("account", p.stripeAccountId))) s.account = p.stripeAccountId;
    if (p.subscriptionId && !(await exists("subscription", p.subscriptionId))) s.subscription = p.subscriptionId;
    if (s.customer || s.account || s.subscription) out.push(s);
  }
  for (const o of owners) {
    if (o.stripeAccountId && !(await exists("account", o.stripeAccountId))) out.push({ who: "owner", userId: o.userId, name: "Owner payout account", account: o.stripeAccountId });
  }
  return out;
}

/** Clears only the leftover test links. The account, profile, bookings and entry stay; they reconnect in live mode. */
export async function clearStaleStripeRefs() {
  const stale = await findStaleStripeRefs(500);
  for (const s of stale) {
    if (s.who === "owner") {
      await db.update(adminMembers).set({ stripeAccountId: null, stripePayoutsEnabled: false, payoutDestination: null }).where(eq(adminMembers.userId, s.userId));
      continue;
    }
    await db.update(professionalProfiles).set({
      ...(s.customer ? { stripeCustomerId: null } : {}),
      ...(s.account ? { stripeAccountId: null, payoutsEnabled: false } : {}),
      ...(s.subscription ? { subscriptionId: null, subscriptionStatus: null, currentPeriodEnd: null, membershipPausedAt: null, membershipEndsAt: null } : {}),
    }).where(eq(professionalProfiles.userId, s.userId));
  }
  return stale;
}
