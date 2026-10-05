import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, professionalProfiles } from "@/db";
import { stripe } from "@/lib/stripe";
import { confirmFromCheckout } from "@/lib/bookings";
import { saveSubscription } from "@/lib/pro-stripe";
import { confirmFinePayment } from "@/lib/enforcement";
import { recordInvoice } from "@/lib/partner";
import { savePartnerAccount } from "@/lib/partner-stripe";
import { finalizeEntry } from "@/lib/entry";

// Stripe calls this in the background so payments, memberships, ID checks and payouts stay current
// even if someone closes the browser before returning to Nearest.
export async function POST(req: Request) {
  // Stripe gives every event destination its own signing secret. Nearest has two destinations —
  // "Your account" (payments, memberships, invoices) and "Connected accounts" (payout setups) — so accept either.
  // STRIPE_WEBHOOK_SECRET may also hold several secrets separated by commas.
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET]
    .flatMap((v) => (v ?? "").split(","))
    .map((v) => v.trim())
    .filter(Boolean);
  if (!secrets.length) return new Response("Webhook secret not set", { status: 500 });
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try { event = stripe().webhooks.constructEvent(body, signature, secret); break; } catch { /* try the next secret */ }
  }
  if (!event) return new Response("Bad signature", { status: 400 });
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        if (s.mode === "payment" && s.metadata?.fineId) await confirmFinePayment(s.id);
        else if (s.mode === "payment") await confirmFromCheckout(s.id);
        if ((s.mode === "subscription" || s.mode === "setup") && s.metadata?.kind === "entry") await finalizeEntry(s.id); // registration: paid now, or card saved until the city opens
        else if (s.mode === "subscription" && s.client_reference_id && s.subscription) {
          const sub = await stripe().subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id);
          await saveSubscription(s.client_reference_id, sub);
          // Activated from a booking request: accept that booking even if they closed the page after paying.
          if (s.metadata?.kind === "membership" && s.metadata.bookingId && ["active", "trialing"].includes(sub.status)) {
            await (await import("@/lib/requests")).acceptRequest(s.metadata.bookingId, s.client_reference_id);
          }
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
        if (a.payouts_enabled) {
          // Send anything Nearest was holding while this pro finished payout setup.
          const pro = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.stripeAccountId, a.id) });
          if (pro) await (await import("@/lib/bookings")).payOwedToPro(pro.userId);
        }
        await savePartnerAccount(a); // partner payout accounts (bank or debit card)
        await (await import("@/lib/rep-stripe")).saveRepAccount(a); // sales rep payout accounts
        break;
      }
    }
  } catch (e) {
    console.error("Webhook handling failed", event.type, e);
    return new Response("Handler error", { status: 500 });
  }
  return new Response("ok");
}
