"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db, bookings } from "@/db";
import { requirePro } from "@/lib/pro";
import { stripe, priceFor, type PlanKey } from "@/lib/stripe";
import { acceptRequest, declineRequest } from "@/lib/requests";

export type AcceptState = { error?: string; ok?: string; needsActivation?: boolean; rateCents?: number };

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

/** Accept a booking request. If the membership isn't active yet, the activation screen opens instead (booking stays pending). */
export async function acceptBookingRequest(_: AcceptState, form: FormData): Promise<AcceptState> {
  const { user } = await requirePro();
  const id = String(form.get("id") ?? "");
  const r = await acceptRequest(id, user.id);
  if ("needsActivation" in r) return { needsActivation: true, rateCents: r.rateCents };
  if ("error" in r) return { error: r.error };
  revalidatePath("/pro", "layout");
  redirect(`/pro/appointments/${id}?accepted=1`);
}

export async function declineBookingRequest(form: FormData) {
  const { user } = await requirePro();
  const id = String(form.get("id") ?? "");
  await declineRequest(id, user.id);
  revalidatePath("/pro", "layout");
  redirect("/pro/appointments?declined=1");
}

/** "ACTIVATE & ACCEPT BOOKING": start the membership in Stripe, then come straight back to this booking and accept it. */
export async function activateAndAccept(form: FormData) {
  const { user, profile } = await requirePro();
  const id = String(form.get("id") ?? "");
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, id), eq(bookings.proId, user.id)) });
  if (!b || b.status !== "requested") redirect(`/pro/appointments/${id}`);
  const base = await origin();
  const type = (profile.entryType && !["AMBASSADOR", "BOOKING_PAID"].includes(profile.entryType) ? profile.entryType : "FIRST_IN") as PlanKey;
  // Saved a card when they joined (earlier sign-up flow): activate in one tap on that card — no Stripe page.
  if (profile.cardSavedAt && profile.stripeCustomerId && !profile.subscriptionId) {
    let ok = false;
    try {
      const sub = await stripe().subscriptions.create({
        customer: profile.stripeCustomerId, items: [{ price: await priceFor(type) }],
        payment_behavior: "error_if_incomplete", metadata: { userId: user.id, entryType: String(type), activatedForBooking: id },
      });
      await (await import("@/lib/pro-stripe")).saveSubscription(user.id, sub);
      ok = ["active", "trialing"].includes(sub.status);
    } catch (e) { console.error("one-tap activation", e); } // card declined → use Stripe below to enter another card
    if (ok) {
      const r = await acceptRequest(id, user.id);
      redirect("ok" in r ? `/pro/appointments/${id}?accepted=1&activated=1` : `/pro/appointments/${id}?activated=1`);
    }
  }
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: await priceFor(type), quantity: 1 }],
    ...(profile.stripeCustomerId ? { customer: profile.stripeCustomerId } : { customer_email: user.email ?? undefined }),
    client_reference_id: user.id,
    subscription_data: { metadata: { userId: user.id, entryType: String(type), activatedForBooking: id } },
    metadata: { userId: user.id, kind: "membership", bookingId: id },
    success_url: `${base}/pro/requests/${id}/activated?session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pro/appointments/${id}?activation=cancelled`,
  });
  redirect(session.url!);
}
