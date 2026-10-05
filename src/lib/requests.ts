import "server-only";
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db, bookings, professionalProfiles, users } from "@/db";
import { confirmBooking } from "./bookings";
import { restoreInviteRewards } from "./student-invites";
import { membershipState } from "./membership";
import { isOwnerBusiness } from "./entry";
import { fmtDate, fmtTime, money } from "./time";

const base = () => process.env.APP_URL || "https://www.usenearest.com";
const when = (d: Date) => `${fmtDate(d, { weekday: "short", month: "short", day: "numeric" })} at ${fmtTime(d)}`;

/**
 * Every booking starts as a request. Nothing is charged when the student sends it.
 *   requested       → the professional has 24 hours (never later than 2 hours before the appointment) to accept
 *   pending_payment → accepted; the student has 12 hours (never later than 1 hour before) to pay and confirm
 *   confirmed       → paid
 * A professional whose membership isn't active activates it first — then the same request is accepted.
 */
export function requestDeadline(startsAt: Date) {
  return new Date(Math.min(Date.now() + 24 * 3600000, startsAt.getTime() - 2 * 3600000));
}
function paymentDeadline(startsAt: Date) {
  return new Date(Math.min(Date.now() + 12 * 3600000, startsAt.getTime() - 3600000));
}

async function tell(userId: string, title: string, body: string, href: string, email?: { subject: string; heading: string; lines: string[]; button: string }) {
  try {
    const { inbox } = await import("./inbox");
    await inbox(userId, { kind: "booking", title, body, href });
    if (email) {
      const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
      if (u?.email) {
        const { sendEmail } = await import("./email");
        await sendEmail({ to: u.email, subject: email.subject, eyebrow: "Nearest", heading: email.heading, lines: email.lines, button: { label: email.button, url: `${base()}${href}` } });
      }
    }
  } catch (e) { console.error("request notify", e); }
}

/** A new request: tell the professional (normal booking-request details; never anything about membership to the student). */
export async function notifyNewRequest(b: typeof bookings.$inferSelect) {
  await db.update(professionalProfiles).set({ firstRequestAt: sql`coalesce(${professionalProfiles.firstRequestAt}, now())` }).where(eq(professionalProfiles.userId, b.proId));
  const pro = await db.query.users.findFirst({ where: eq(users.id, b.proId) });
  await tell(b.proId, "New booking request", `${b.serviceName} • ${when(b.startsAt)}. Tap to accept.`, `/pro/appointments/${b.id}`,
    { subject: `New booking request: ${b.serviceName}`, heading: `${pro?.firstName ?? "Hi"}, a client wants to book you.`, lines: [`${b.serviceName} • ${when(b.startsAt)}.`, "Open Nearest to accept it before it expires."], button: "View request" });
}

/** Accepted (membership active): the student is asked to pay — or it confirms right away if credit covers it. */
async function acceptForPayment(b: typeof bookings.$inferSelect) {
  if (b.chargedCents === 0) {
    const done = await confirmBooking(b.id);
    await db.update(bookings).set({ respondedAt: new Date() }).where(eq(bookings.id, b.id));
    await tell(b.studentId, "Your appointment is confirmed", `${b.serviceName} • ${when(b.startsAt)}.`, `/bookings/${b.id}`);
    return done;
  }
  const until = paymentDeadline(b.startsAt);
  const [row] = await db.update(bookings).set({ status: "pending_payment", respondedAt: new Date(), holdExpiresAt: until })
    .where(and(eq(bookings.id, b.id), eq(bookings.status, "requested"))).returning();
  if (!row) return null;
  await tell(b.studentId, "Accepted — complete payment to confirm", `${b.serviceName} • ${when(b.startsAt)}. Pay ${money(b.chargedCents)} by ${fmtTime(until)} to confirm.`, `/bookings/${b.id}`,
    { subject: `Accepted: ${b.serviceName} — confirm with payment`, heading: "Your professional accepted your request.", lines: [`${b.serviceName} • ${when(b.startsAt)}.`, `Complete your payment by ${fmtDate(until, { month: "short", day: "numeric" })} at ${fmtTime(until)} to confirm your appointment.`], button: "Pay and confirm" });
  return row;
}

export type AcceptResult = { ok: true } | { needsActivation: true; rateCents: number } | { error: string };

/** The professional taps Accept. Membership not active yet → they activate first (the request stays pending). */
export async function acceptRequest(bookingId: string, proId: string): Promise<AcceptResult> {
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, bookingId), eq(bookings.proId, proId)) });
  if (!b || b.status !== "requested") return { error: "This request isn't waiting anymore." };
  if (b.requestExpiresAt && b.requestExpiresAt.getTime() < Date.now()) return { error: "This request expired." };
  const p = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, proId) });
  if (!p) return { error: "Not found." };
  const state = membershipState(p, await isOwnerBusiness(proId));
  if (state === "not_activated") return { needsActivation: true, rateCents: p.monthlyRateCents ?? 1100 };
  if (state === "payment_issue") return { error: "Your membership payment needs attention before you can accept bookings. Open Subscription to fix it." };
  await acceptForPayment(b);
  return { ok: true };
}

/** The professional declines. The student wasn't charged. Not a cancellation penalty. */
export async function declineRequest(bookingId: string, proId: string) {
  const [b] = await db.update(bookings).set({ status: "cancelled_pro", cancelledAt: new Date(), respondedAt: new Date() })
    .where(and(eq(bookings.id, bookingId), eq(bookings.proId, proId), eq(bookings.status, "requested"))).returning();
  if (!b) return false;
  await restoreInviteRewards();
  await tell(b.studentId, "Your request wasn't confirmed", `${b.serviceName} couldn't be confirmed. You weren't charged — try another time or professional.`, `/bookings/${b.id}`);
  return true;
}

/** The student withdraws their request before it's accepted (nothing was charged). */
export async function cancelRequest(bookingId: string, studentId: string) {
  const [b] = await db.update(bookings).set({ status: "cancelled_student", cancelledAt: new Date() })
    .where(and(eq(bookings.id, bookingId), eq(bookings.studentId, studentId), inArray(bookings.status, ["requested", "pending_payment"]), sql`${bookings.paidAt} is null`)).returning();
  if (!b) return false;
  await restoreInviteRewards();
  return true;
}

/** Cron: requests nobody answered in time, and accepted requests the student didn't pay for in time, expire. */
export async function expireRequests() {
  const unanswered = await db.update(bookings).set({ status: "expired" }).where(and(eq(bookings.status, "requested"), lt(bookings.requestExpiresAt, new Date()))).returning();
  for (const b of unanswered) await tell(b.studentId, "Your request expired", `The professional couldn't confirm ${b.serviceName} in time. You weren't charged — try another time or professional.`, `/bookings/${b.id}`);
  const unpaid = await db.update(bookings).set({ status: "expired", holdExpiresAt: null })
    .where(and(eq(bookings.status, "pending_payment"), eq(bookings.isRequest, true), sql`${bookings.respondedAt} is not null`, lt(bookings.holdExpiresAt, new Date()))).returning();
  for (const b of unpaid) {
    await tell(b.studentId, "Your booking wasn't completed", `Payment for ${b.serviceName} wasn't finished in time, so the time was released.`, `/bookings/${b.id}`);
    await tell(b.proId, "A client didn't complete payment", `${b.serviceName} • ${when(b.startsAt)} was released — the time is open again.`, `/pro/appointments/${b.id}`);
  }
  if (unanswered.length || unpaid.length) await restoreInviteRewards();
  return unanswered.length + unpaid.length;
}

/** Cron: a professional who got a request but hasn't activated within 7 days gives up their spot (and their open requests expire). */
export async function releaseUnactivated() {
  const rows = await db.select().from(professionalProfiles).where(and(
    sql`${professionalProfiles.firstRequestAt} < now() - interval '7 days'`, isNull(professionalProfiles.placementReleasedAt),
    isNull(professionalProfiles.subscriptionId), sql`coalesce(${professionalProfiles.entryType}, '') not in ('AMBASSADOR','BOOKING_PAID')`,
  ));
  let n = 0;
  for (const p of rows) {
    if (await isOwnerBusiness(p.userId)) continue;
    await db.update(professionalProfiles).set({ placementReleasedAt: new Date() }).where(eq(professionalProfiles.userId, p.userId));
    const open = await db.update(bookings).set({ status: "expired" }).where(and(eq(bookings.proId, p.userId), eq(bookings.status, "requested"))).returning();
    for (const b of open) await tell(b.studentId, "Your request expired", `${b.serviceName} couldn't be confirmed. You weren't charged — try another professional.`, `/bookings/${b.id}`);
    await tell(p.userId, "Your Nearest spot was released", "You didn't activate your membership within 7 days of your first booking request, so your spot opened up. Activate from Subscription to claim a spot again if one is open.", "/pro/payments",
      { subject: "Your Nearest spot was released", heading: "Your spot was released.", lines: ["You received a booking request but didn't activate your membership within 7 days, so your spot opened for another professional.", "You can activate from Subscription and claim a spot again if one is open."], button: "Open Subscription" });
    n++;
  }
  if (n) await restoreInviteRewards();
  return n;
}
