import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, professionalProfiles } from "@/db";
import { stripe } from "@/lib/stripe";
import { confirmFromCheckout } from "@/lib/bookings";
import { saveSubscription } from "@/lib/pro-stripe";
import { confirmFinePayment } from "@/lib/enforcement";
import { recordInvoice } from "@/lib/partner";

// Stripe calls this in the background so payments, memberships, ID checks and payouts stay current
// even if someone closes the browser before returning to Nearest.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook secret not set", { status: 500 });
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        if (s.mode === "payment" && s.metadata?.fineId) await confirmFinePayment(s.id);
        else if (s.mode === "payment") await confirmFromCheckout(s.id);
        if (s.mode === "subscription" && s.client_reference_id && s.subscription) {
          const sub = await stripe().subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id);
          await saveSubscription(s.client_reference_id, sub);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const p = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.subscriptionId, sub.id) });
        if (p) await saveSubscription(p.userId, sub);
        break;
      }
      case "identity.verification_session.verified":
      case "identity.verification_session.requires_input": {
        const vs = event.data.object;
        await db.update(professionalProfiles)
          .set({ identityStatus: event.type.endsWith("verified") ? "verified" : "rejected" })
          .where(eq(professionalProfiles.identitySessionId, vs.id));
        break;
      }
      case "invoice.paid": {
        await recordInvoice(event.data.object);
        break;
      }
      case "account.updated": {
        const a = event.data.object;
        await db.update(professionalProfiles).set({ payoutsEnabled: Boolean(a.payouts_enabled) }).where(eq(professionalProfiles.stripeAccountId, a.id));
        break;
      }
    }
  } catch (e) {
    console.error("Webhook handling failed", event.type, e);
    return new Response("Handler error", { status: 500 });
  }
  return new Response("ok");
}
