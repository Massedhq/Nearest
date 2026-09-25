import "server-only";
import type Stripe from "stripe";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db, bookings, credits, modelCalls, professionalProfiles } from "@/db";
import { stripe } from "./stripe";
import { getSettings } from "./settings";

export const bookingCode = (n: number) => `NEA-${10000 + n}`;

export async function expireStaleHolds() {
  await db.update(bookings).set({ status: "expired" }).where(and(eq(bookings.status, "pending_payment"), lt(bookings.holdExpiresAt, new Date())));
}

/** Confirms a booking once. Records the charge, uses up the credits, and takes a model-call spot. Safe to call repeatedly. */
export async function confirmBooking(bookingId: string, charge?: { chargeId: string; chargedCents: number; feeCents: number }) {
  const [b] = await db
    .update(bookings)
    .set({
      status: "confirmed",
      paidAt: new Date(),
      holdExpiresAt: null,
      ...(charge ? { stripeChargeId: charge.chargeId, chargedCents: charge.chargedCents, stripeFeeCents: charge.feeCents } : {}),
    })
    .where(and(eq(bookings.id, bookingId), inArray(bookings.status, ["pending_payment", "expired"])))
    .returning();
  if (!b) return null; // already confirmed

  const used = [];
  if (b.creditProCents) used.push({ studentId: b.studentId, proId: b.proId, amountCents: -b.creditProCents, reason: `Used on ${bookingCode(b.number)}`, bookingId: b.id });
  if (b.creditGeneralCents) used.push({ studentId: b.studentId, proId: null, amountCents: -b.creditGeneralCents, reason: `Used on ${bookingCode(b.number)}`, bookingId: b.id });
  if (used.length) await db.insert(credits).values(used);

  if (b.modelCallId) {
    const [spot] = await db
      .update(modelCalls)
      .set({ spotsTaken: sql`${modelCalls.spotsTaken} + 1` })
      .where(and(eq(modelCalls.id, b.modelCallId), sql`${modelCalls.spotsTaken} < ${modelCalls.spots}`))
      .returning();
    if (!spot) {
      // Someone took the last spot while this student was paying: cancel and give the full value back as general credit.
      await cancelAsProFault(b.id, "Model call filled before payment finished", undefined, false);
      return b;
    }
    if (spot.spotsTaken >= spot.spots) await db.update(modelCalls).set({ status: "full" }).where(eq(modelCalls.id, spot.id));
  }
  try { await (await import("./notify")).notifyBooked(b); } catch (e) { console.error(e); }
  return b;
}

/** Reads a finished Checkout session and confirms its booking. */
export async function confirmFromCheckout(sessionId: string) {
  const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.latest_charge.balance_transaction"] });
  if (session.mode !== "payment" || session.payment_status !== "paid") return null;
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) return null;
  const pi = session.payment_intent as Stripe.PaymentIntent | null;
  const ch = pi?.latest_charge as Stripe.Charge | null;
  const bt = ch?.balance_transaction as Stripe.BalanceTransaction | null;
  return confirmBooking(bookingId, { chargeId: ch?.id ?? "", chargedCents: session.amount_total ?? 0, feeCents: bt?.fee ?? 0 });
}

const total = (b: typeof bookings.$inferSelect) => b.chargedCents + b.creditProCents + b.creditGeneralCents;

async function freeSpot(b: typeof bookings.$inferSelect) {
  if (!b.modelCallId) return;
  await db.update(modelCalls).set({ spotsTaken: sql`greatest(${modelCalls.spotsTaken} - 1, 0)`, status: "open" }).where(and(eq(modelCalls.id, b.modelCallId), inArray(modelCalls.status, ["open", "full"])));
}

/** Student cancels. 24+ hours ahead: everything back as credit. Inside 24 hours: the deposit is forfeited to the pro. No cash refunds. */
export async function cancelByStudent(bookingId: string, studentId: string) {
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, bookingId), eq(bookings.studentId, studentId)) });
  if (!b || b.status !== "confirmed" || b.startsAt.getTime() <= Date.now()) return { error: "This appointment can't be cancelled." };
  const s = await getSettings();
  const early = b.startsAt.getTime() - Date.now() >= Number(s["cancel.cutoff_hours"]) * 3600000;
  const forfeit = early ? 0 : Math.min(b.depositCents, b.chargedCents + b.creditProCents);
  const [done] = await db.update(bookings).set({ status: "cancelled_student", cancelledAt: new Date() }).where(and(eq(bookings.id, b.id), eq(bookings.status, "confirmed"))).returning();
  if (!done) return { error: "This appointment was already changed." };

  const back = [];
  const proPart = b.chargedCents + b.creditProCents - forfeit;
  if (proPart > 0) back.push({ studentId, proId: b.proId, amountCents: proPart, reason: `Cancelled ${bookingCode(b.number)}`, bookingId: b.id });
  if (b.creditGeneralCents > 0) back.push({ studentId, proId: null, amountCents: b.creditGeneralCents, reason: `Cancelled ${bookingCode(b.number)}`, bookingId: b.id });
  if (back.length) await db.insert(credits).values(back);
  await freeSpot(b);

  if (forfeit > 0) {
    const pro = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, b.proId) });
    if (pro?.stripeAccountId && pro.payoutsEnabled) {
      try {
        const t = await stripe().transfers.create(
          { amount: forfeit, currency: "usd", destination: pro.stripeAccountId, transfer_group: b.id, ...(b.stripeChargeId ? { source_transaction: b.stripeChargeId } : {}), metadata: { bookingId: b.id, kind: "forfeited_deposit" } },
          { idempotencyKey: `deposit-${b.id}` },
        );
        await db.update(bookings).set({ transferId: t.id }).where(eq(bookings.id, b.id));
      } catch (e) {
        console.error("Deposit transfer failed", b.id, e);
      }
    }
  }
  try { await (await import("./notify")).notifyCancelled(done, "student"); } catch (e) { console.error(e); }
  return { ok: early ? "Cancelled. The full amount is saved as credit with this professional." : "Cancelled. The deposit was forfeited; the rest is saved as credit with this professional.", credit: proPart + b.creditGeneralCents };
}

/** Pro cancels (or the booking can't happen for a pro-side reason): the whole value comes back as general Nearest credit. */
export async function cancelAsProFault(bookingId: string, reason: string, proId?: string, heldSpot = true) {
  const where = proId ? and(eq(bookings.id, bookingId), eq(bookings.proId, proId), eq(bookings.status, "confirmed")) : and(eq(bookings.id, bookingId), eq(bookings.status, "confirmed"));
  const [b] = await db.update(bookings).set({ status: "cancelled_pro", cancelledAt: new Date() }).where(where).returning();
  if (!b) return { error: "This appointment can't be cancelled." };
  if (total(b) > 0) await db.insert(credits).values({ studentId: b.studentId, proId: null, amountCents: total(b), reason: `${reason} (${bookingCode(b.number)})`, bookingId: b.id });
  if (heldSpot) await freeSpot(b); // a booking that never got a spot must not give one back
  try { await (await import("./notify")).notifyCancelled(b, "pro"); } catch (e) { console.error(e); }
  return { ok: "Cancelled. The student received the full amount as Nearest credit." };
}

/** Student releases payment after the appointment started. The pro receives the price minus Stripe's processing fee. */
export async function releasePayment(bookingId: string, studentId: string) {
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, bookingId), eq(bookings.studentId, studentId)) });
  if (!b || b.status !== "confirmed") return { error: "This payment can't be released." };
  if (b.startsAt.getTime() > Date.now()) return { error: "You can release payment once your appointment has started." };
  const pro = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, b.proId) });
  const amount = Math.max(0, total(b) - (b.stripeFeeCents ?? 0));
  let transferId: string | null = null;
  if (amount > 0) {
    if (!pro?.stripeAccountId || !pro.payoutsEnabled) return { error: "Your professional hasn't finished payout setup yet. Your payment stays protected — try again later." };
    const t = await stripe().transfers.create(
      { amount, currency: "usd", destination: pro.stripeAccountId, transfer_group: b.id, ...(b.stripeChargeId && b.chargedCents === total(b) ? { source_transaction: b.stripeChargeId } : {}), metadata: { bookingId: b.id, kind: "service" } },
      { idempotencyKey: `release-${b.id}` },
    );
    transferId = t.id;
  }
  await db.update(bookings).set({ status: "completed", releasedAt: new Date(), transferId }).where(and(eq(bookings.id, b.id), eq(bookings.status, "confirmed")));
  return { ok: "Payment released. Thank you!" };
}
