import "server-only";
import type Stripe from "stripe";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db, bookings, credits, modelCalls, professionalProfiles } from "@/db";
import { stripe } from "./stripe";
import { getSettings } from "./settings";
import { collectDues } from "./dues";
import { useInviteReward, restoreInviteRewards } from "./student-invites";

export const bookingCode = (n: number) => `NEA-${10000 + n}`;

export async function expireStaleHolds() {
  await db.update(bookings).set({ status: "expired" }).where(and(eq(bookings.status, "pending_payment"), lt(bookings.holdExpiresAt, new Date())));
  await restoreInviteRewards();
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
  await useInviteReward(b.id, b.inviteRewardId);
  if (b.bundleId) { try { await (await import("./bundles")).onBundleBookingConfirmed(b); } catch (e) { console.error("bundle", e); } }

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

/**
 * The student backed out of paying: give the time back and close the Stripe page.
 * Safe if they actually paid in the meantime — then the booking is confirmed instead. Returns what happened.
 */
export async function releaseHold(bookingId: string, studentId: string): Promise<"released" | "paid" | "none"> {
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, bookingId), eq(bookings.studentId, studentId), eq(bookings.status, "pending_payment")) });
  if (!b) return "none";
  if (b.stripeCheckoutId) {
    try {
      await stripe().checkout.sessions.expire(b.stripeCheckoutId);
    } catch {
      // Already finished or expired. If it was paid, keep the booking.
      try {
        const s = await stripe().checkout.sessions.retrieve(b.stripeCheckoutId);
        if (s.payment_status === "paid") { await confirmFromCheckout(s.id); return "paid"; }
      } catch (e) { console.error(e); }
    }
  }
  await db.update(bookings).set({ status: "expired", holdExpiresAt: null }).where(and(eq(bookings.id, b.id), eq(bookings.status, "pending_payment")));
  await restoreInviteRewards();
  return "released";
}

/** A student has one unfinished payment at a time: starting a new booking releases their older holds. */
export async function releaseMyHolds(studentId: string) {
  const mine = await db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.studentId, studentId), eq(bookings.status, "pending_payment")));
  for (const m of mine) await releaseHold(m.id, studentId);
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
  if (done) await restoreInviteRewards();
  if (!done) return { error: "This appointment was already changed." };

  const back = [];
  const proPart = b.chargedCents + b.creditProCents - forfeit;
  if (proPart > 0) back.push({ studentId, proId: b.proId, amountCents: proPart, reason: `Cancelled ${bookingCode(b.number)}`, bookingId: b.id });
  if (b.creditGeneralCents > 0) back.push({ studentId, proId: null, amountCents: b.creditGeneralCents, reason: `Cancelled ${bookingCode(b.number)}`, bookingId: b.id });
  if (back.length) await db.insert(credits).values(back);
  await freeSpot(b);

  const proRow = forfeit > 0 ? await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, b.proId) }) : null;
  const toPro = forfeit - (await collectDues(proRow, b.id, forfeit)); // pay-from-bookings membership comes out first
  if (toPro > 0) {
    const pro = proRow;
    if (!pro?.stripeAccountId || !pro.payoutsEnabled) {
      // Pro hasn't connected payouts yet: Nearest holds the deposit and sends it once they do.
      await db.update(bookings).set({ payoutOwedCents: toPro }).where(eq(bookings.id, b.id));
    } else {
      try {
        const t = await stripe().transfers.create(
          { amount: toPro, currency: "usd", destination: pro.stripeAccountId, transfer_group: b.id, ...(b.stripeChargeId ? { source_transaction: b.stripeChargeId } : {}), metadata: { bookingId: b.id, kind: "forfeited_deposit" } },
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
  if (b) await restoreInviteRewards();
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
  // Release once the pro has finished (even if they started early) or the start time has passed.
  if (!b.finishedAt && b.startsAt.getTime() > Date.now()) return { error: "You can release payment once your appointment has started." };
  const pro = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, b.proId) });
  const gross = Math.max(0, total(b) - (b.stripeFeeCents ?? 0));
  const amount = gross - (await collectDues(pro, b.id, gross)); // pay-from-bookings membership comes out first
  let transferId: string | null = null;
  if (amount > 0) {
    if (pro?.stripeAccountId && pro.payoutsEnabled) {
      const t = await stripe().transfers.create(
        { amount, currency: "usd", destination: pro.stripeAccountId, transfer_group: b.id, ...(b.stripeChargeId && b.chargedCents === total(b) ? { source_transaction: b.stripeChargeId } : {}), metadata: { bookingId: b.id, kind: "service" } },
        { idempotencyKey: `release-${b.id}` },
      );
      transferId = t.id;
    }
  }
  // No payouts connected yet → the booking still completes; Nearest holds the money until the pro connects (payOwedToPro).
  const owed = amount > 0 && !transferId ? amount : 0;
  await db.update(bookings).set({ status: "completed", releasedAt: new Date(), transferId, payoutOwedCents: owed }).where(and(eq(bookings.id, b.id), eq(bookings.status, "confirmed")));
  return { ok: "Payment released. Thank you!" };
}


/** Sends everything Nearest has been holding for a pro, once their payout account is ready. Safe to call repeatedly. */
export async function payOwedToPro(proId: string) {
  const pro = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, proId) });
  if (!pro?.stripeAccountId || !pro.payoutsEnabled) return 0;
  const owed = await db.select().from(bookings).where(and(eq(bookings.proId, proId), sql`${bookings.payoutOwedCents} > 0`, sql`${bookings.transferId} is null`));
  let sent = 0;
  for (const b of owed) {
    try {
      const t = await stripe().transfers.create(
        { amount: b.payoutOwedCents, currency: "usd", destination: pro.stripeAccountId, transfer_group: b.id, ...(b.stripeChargeId ? { source_transaction: b.stripeChargeId } : {}), metadata: { bookingId: b.id, kind: b.status === "completed" ? "service" : "forfeited_deposit", held: "true" } },
        { idempotencyKey: `owed-${b.id}` },
      );
      await db.update(bookings).set({ transferId: t.id, payoutOwedCents: 0 }).where(eq(bookings.id, b.id));
      sent += b.payoutOwedCents;
    } catch (e) {
      console.error("Owed payout failed", b.id, e);
    }
  }
  return sent;
}
