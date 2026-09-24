"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gt, inArray, ne, or, lt } from "drizzle-orm";
import { db, bookings, proServices, modelCalls, professionalProfiles } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { liveProWhere } from "@/lib/search";
import { openSlots } from "@/lib/availability";
import { creditBalances, applyCredits } from "@/lib/credits";
import { confirmBooking, cancelByStudent, releasePayment, bookingCode } from "@/lib/bookings";
import { getSettings } from "@/lib/settings";
import { stripe, stripeEnabled, origin } from "@/lib/stripe";
import { chicagoToUtc } from "@/lib/time";
import type { FormState } from "@/components/ActionForm";

const HOLD_MIN = 31; // Stripe Checkout sessions must stay open at least 30 minutes.

async function livePro(proId: string) {
  const [p] = await db.select().from(professionalProfiles).where(and(eq(professionalProfiles.userId, proId), ...liveProWhere(null, "all"))).limit(1);
  return p ?? null;
}

async function checkout(b: typeof bookings.$inferSelect, email: string | null, proName: string) {
  const base = await origin();
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: email ?? undefined,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: b.chargedCents, product_data: { name: `${b.serviceName} with ${proName}`, description: `Booking ${bookingCode(b.number)} • includes a protected deposit` } } }],
    payment_intent_data: { transfer_group: b.id, metadata: { bookingId: b.id } },
    metadata: { bookingId: b.id },
    expires_at: Math.floor(Date.now() / 1000) + HOLD_MIN * 60,
    success_url: `${base}/bookings/${b.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/bookings/${b.id}?cancelled=1`,
  });
  await db.update(bookings).set({ stripeCheckoutId: session.id }).where(eq(bookings.id, b.id));
  return session.url!;
}

/** Creates a held booking, then sends the student to Stripe (or confirms right away when credit covers it). */
async function createAndPay(opts: {
  studentId: string; email: string | null; proId: string; proName: string; serviceId?: string; modelCallId?: string;
  serviceName: string; startsAt: Date; durationMin: number; priceCents: number;
}): Promise<FormState> {
  const s = await getSettings();
  if (s["status.bookings"] !== true) return { error: "Booking is paused right now. Please try again soon." };
  const deposit = Math.min(Number(s["appt.deposit_cents"]), opts.priceCents);
  const bal = await creditBalances(opts.studentId, opts.proId);
  const use = applyCredits(opts.priceCents, bal);
  if (use.charge > 0 && !stripeEnabled()) return { error: "Payments aren't set up yet." };
  const endsAt = new Date(opts.startsAt.getTime() + opts.durationMin * 60000);

  const [b] = await db.insert(bookings).values({
    studentId: opts.studentId, proId: opts.proId, serviceId: opts.serviceId ?? null, modelCallId: opts.modelCallId ?? null,
    serviceName: opts.serviceName, startsAt: opts.startsAt, endsAt, priceCents: opts.priceCents, depositCents: deposit,
    creditProCents: use.pro, creditGeneralCents: use.general, chargedCents: use.charge,
    holdExpiresAt: new Date(Date.now() + HOLD_MIN * 60000),
  }).returning();

  // Double-booking guard: if an earlier active booking overlaps this time, give up this one.
  if (!opts.modelCallId) {
    const clash = await db.select({ id: bookings.id }).from(bookings).where(and(
      eq(bookings.proId, opts.proId), ne(bookings.id, b.id), lt(bookings.number, b.number),
      lt(bookings.startsAt, endsAt), gt(bookings.endsAt, opts.startsAt),
      or(inArray(bookings.status, ["confirmed", "completed"]), and(eq(bookings.status, "pending_payment"), gt(bookings.holdExpiresAt, new Date()))),
    )).limit(1);
    if (clash.length) {
      await db.update(bookings).set({ status: "expired" }).where(eq(bookings.id, b.id));
      return { error: "Someone just booked that time. Please pick another." };
    }
  }

  if (use.charge === 0) {
    await confirmBooking(b.id);
    redirect(`/bookings/${b.id}?booked=1`);
  }
  redirect(await checkout(b, opts.email, opts.proName));
}

export async function bookService(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireVerifiedStudent();
  if (form.get("agree") !== "on") return { error: "Please agree to the booking and cancellation terms." };
  const serviceId = String(form.get("serviceId") ?? "");
  const day = String(form.get("day") ?? "");
  const time = String(form.get("time") ?? "");
  const svc = await db.query.proServices.findFirst({ where: and(eq(proServices.id, serviceId), eq(proServices.active, true)) });
  if (!svc) return { error: "That service isn't available." };
  const pro = await livePro(svc.userId);
  if (!pro) return { error: "This professional isn't taking bookings right now." };
  if (!(await openSlots(svc.userId, svc.durationMin, day)).includes(time)) return { error: "That time was just taken or is no longer available. Please pick another." };
  return createAndPay({
    studentId: user.id, email: user.email, proId: svc.userId, proName: pro.businessName ?? "your professional", serviceId: svc.id,
    serviceName: svc.name, startsAt: chicagoToUtc(day, time), durationMin: svc.durationMin, priceCents: svc.priceCents,
  });
}

export async function bookModelCall(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireVerifiedStudent();
  if (form.get("agree") !== "on") return { error: "Please agree to the booking and cancellation terms." };
  const id = String(form.get("modelCallId") ?? "");
  const call = await db.query.modelCalls.findFirst({ where: and(eq(modelCalls.id, id), eq(modelCalls.status, "open")) });
  if (!call || call.startsAt.getTime() < Date.now() || call.spotsTaken >= call.spots) return { error: "This model call is full or no longer open." };
  const pro = await livePro(call.userId);
  if (!pro) return { error: "This professional isn't taking bookings right now." };
  const mine = await db.query.bookings.findFirst({ where: and(eq(bookings.modelCallId, id), eq(bookings.studentId, user.id), inArray(bookings.status, ["confirmed", "pending_payment"])) });
  if (mine?.status === "confirmed") return { error: "You already have a spot in this model call." };
  return createAndPay({
    studentId: user.id, email: user.email, proId: call.userId, proName: pro.businessName ?? "your professional", modelCallId: call.id,
    serviceName: `${call.serviceName} (Model Call)`, startsAt: call.startsAt, durationMin: call.durationMin, priceCents: call.priceCents,
  });
}

export async function resumePayment(form: FormData) {
  const { user } = await requireVerifiedStudent();
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, String(form.get("id"))), eq(bookings.studentId, user.id), eq(bookings.status, "pending_payment")) });
  if (!b || !b.holdExpiresAt || b.holdExpiresAt.getTime() < Date.now()) redirect("/bookings");
  const pro = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, b.proId) });
  redirect(await checkout(b, user.email, pro?.businessName ?? "your professional"));
}

export async function cancelMyBooking(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireVerifiedStudent();
  const res = await cancelByStudent(String(form.get("id")), user.id);
  revalidatePath("/bookings");
  return res.error ? { error: res.error } : { ok: res.ok };
}

export async function releaseMyPayment(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireVerifiedStudent();
  try {
    const res = await releasePayment(String(form.get("id")), user.id);
    revalidatePath("/bookings");
    return res.error ? { error: res.error } : { ok: res.ok };
  } catch (e) {
    console.error(e);
    return { error: "Something went wrong releasing payment. Your payment is still protected — try again in a minute." };
  }
}
