"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db, professionalProfiles } from "@/db";
import { requirePro } from "@/lib/pro";
import { stripe, origin, priceFor } from "@/lib/stripe";
import { saveSubscription } from "@/lib/pro-stripe";
import { cancelAsProFault } from "@/lib/bookings";
import type { FormState } from "@/components/ActionForm";

export async function startMembership() {
  const { user, profile } = await requirePro();
  const base = await origin();
  if (profile.stripeCustomerId && profile.subscriptionStatus && !["canceled", "incomplete_expired"].includes(profile.subscriptionStatus)) {
    const portal = await stripe().billingPortal.sessions.create({ customer: profile.stripeCustomerId, return_url: `${base}/pro/payments` });
    redirect(portal.url);
  }
  const price = await priceFor(profile.cohort);
  const firstTime = !profile.subscriptionId; // the free month is only for a pro's first membership
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    ...(profile.stripeCustomerId ? { customer: profile.stripeCustomerId } : { customer_email: user.email ?? undefined }),
    client_reference_id: user.id,
    subscription_data: { ...(firstTime ? { trial_period_days: 30 } : {}), metadata: { userId: user.id, cohort: profile.cohort } },
    metadata: { userId: user.id, kind: "membership" },
    success_url: `${base}/pro/payments?sub={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pro/payments`,
  });
  redirect(session.url!);
}

export async function finishMembership(sessionId: string) {
  const { user } = await requirePro();
  const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  if (session.client_reference_id !== user.id || !session.subscription) return;
  await saveSubscription(user.id, session.subscription as Stripe.Subscription);
}

export async function startIdentity() {
  const { user } = await requirePro();
  const base = await origin();
  const vs = await stripe().identity.verificationSessions.create({
    type: "document",
    options: { document: { require_live_capture: true, require_matching_selfie: true } },
    metadata: { userId: user.id },
    return_url: `${base}/pro/payments`,
  });
  await db.update(professionalProfiles).set({ identitySessionId: vs.id, identityStatus: "pending" }).where(eq(professionalProfiles.userId, user.id));
  redirect(vs.url!);
}

export async function startPayouts() {
  const { user, profile } = await requirePro();
  const base = await origin();
  let acct = profile.stripeAccountId;
  if (!acct) {
    const a = await stripe().accounts.create({
      type: "express", country: "US", email: user.email ?? undefined, business_type: "individual",
      capabilities: { transfers: { requested: true } }, metadata: { userId: user.id },
    });
    acct = a.id;
    await db.update(professionalProfiles).set({ stripeAccountId: acct }).where(eq(professionalProfiles.userId, user.id));
  }
  if (profile.payoutsEnabled) {
    const link = await stripe().accounts.createLoginLink(acct);
    redirect(link.url);
  }
  const link = await stripe().accountLinks.create({ account: acct, refresh_url: `${base}/pro/payments`, return_url: `${base}/pro/payments`, type: "account_onboarding" });
  redirect(link.url);
}

export async function proCancelBooking(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePro();
  const res = await cancelAsProFault(String(form.get("id")), "Professional cancelled", user.id);
  revalidatePath("/pro", "layout");
  return res.error ? { error: res.error } : { ok: res.ok };
}
