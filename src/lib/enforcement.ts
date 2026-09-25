import "server-only";
import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db, studentProfiles, professionalProfiles, fines, incidents, bookings } from "@/db";
import { gt, isNull, lte } from "drizzle-orm";
import { getSettings } from "./settings";
import { releasePayment } from "./bookings";

const days = (n: number) => new Date(Date.now() + n * 86400000);

// ---------- Students ----------
export function studentSuspendedUntil(p: { bookingSuspendedUntil: Date | null }) {
  return p.bookingSuspendedUntil && p.bookingSuspendedUntil.getTime() > Date.now() ? p.bookingSuspendedUntil : null;
}

export async function suspendStudent(userId: string, reason: "no_shows" | "incomplete_completion" | "admin") {
  const s = await getSettings();
  const until = days(Number(s["enforce.customer_suspension_days"]));
  await db.update(studentProfiles).set({ bookingSuspendedUntil: until, suspensionReason: reason }).where(eq(studentProfiles.userId, userId));
  return until;
}

/** After a no-show: the no-show that goes past the limit (the 6th with a limit of 5) starts a suspension. */
export async function checkNoShowLimit(userId: string) {
  const s = await getSettings();
  const p = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, userId) });
  if (p && p.noShowCount > Number(s["enforce.customer_noshow_limit"]) && !studentSuspendedUntil(p)) await suspendStudent(userId, "no_shows");
}

export const SUSPENSION_TEXT: Record<string, string> = {
  no_shows: "Your booking privileges have been suspended due to repeated missed appointments.",
  incomplete_completion: "Your previous appointment was left without completing the required finish steps.",
  admin: "Your booking privileges have been paused by Nearest.",
};

// ---------- Professionals ----------
export async function proStanding(proId: string) {
  const s = await getSettings();
  const [p, open, [confirmed]] = await Promise.all([
    db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, proId) }),
    db.select().from(fines).where(and(eq(fines.proId, proId), eq(fines.status, "outstanding"))),
    db.select({ n: sql<number>`count(*)::int` }).from(incidents).innerJoin(bookings, eq(bookings.id, incidents.bookingId)).where(and(eq(bookings.proId, proId), eq(incidents.status, "pro_fault"))),
  ]);
  const now = Date.now();
  return {
    suspendedUntil: p?.suspendedUntil && p.suspendedUntil.getTime() > now ? p.suspendedUntil : null,
    fines: open,
    overdue: open.filter((f) => f.dueAt.getTime() < now),
    incidents: confirmed.n,
    limit: Number(s["enforce.pro_incident_limit"]),
  };
}

/** Confirmed professional fault: $50 fine due in 7 days; every 3rd confirmed incident also suspends for 30 days. */
export async function penalizePro(proId: string, bookingId: string, incidentId: string) {
  const s = await getSettings();
  await db.insert(fines).values({
    proId, bookingId, incidentId, amountCents: Number(s["enforce.fine_cents"]), reason: "Confirmed professional fault",
    dueAt: days(Number(s["enforce.fine_due_days"])),
  });
  const st = await proStanding(proId);
  if (st.incidents > 0 && st.incidents % st.limit === 0) {
    await db.update(professionalProfiles)
      .set({ suspendedUntil: days(Number(s["enforce.pro_suspension_days"])), suspensionReason: `${st.incidents} confirmed incidents` })
      .where(eq(professionalProfiles.userId, proId));
  }
}

/** Fines unpaid this long are flagged for an owner to decide on account removal. Nothing is deleted automatically. */
export async function finesPastTermination() {
  const s = await getSettings();
  const cutoff = new Date(Date.now() - Number(s["enforce.unpaid_fine_termination_days"]) * 86400000);
  return db.select().from(fines).where(and(eq(fines.status, "outstanding"), lt(fines.createdAt, cutoff)));
}

// ---------- Hourly sweep ----------
/**
 * Appointments the pro finished but the student never completed: after `enforce.completion_hours`,
 * pay the pro and suspend the student's booking (the "left without completing" rule).
 */
export async function sweep() {
  const s = await getSettings();
  const cutoff = new Date(Date.now() - Number(s["enforce.completion_hours"]) * 3600000);
  const stuck = await db.select().from(bookings).where(and(eq(bookings.status, "confirmed"), isNotNull(bookings.finishedAt), lt(bookings.endsAt, cutoff)));
  let released = 0, suspended = 0, failed = 0;
  for (const b of stuck) {
    const openIncident = await db.query.incidents.findFirst({ where: and(eq(incidents.bookingId, b.id), inArray(incidents.status, ["open"])) });
    if (openIncident) continue; // an admin decides these
    try {
      const r = await releasePayment(b.id, b.studentId);
      if (r.error) { failed++; continue; }
      released++;
      const p = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, b.studentId) });
      if (p && !studentSuspendedUntil(p)) { await suspendStudent(b.studentId, "incomplete_completion"); suspended++; }
    } catch (e) {
      console.error("Sweep release failed", b.id, e);
      failed++;
    }
  }
  return { checked: stuck.length, released, suspended, failed };
}

/** Marks a fine paid from a finished Checkout session (return page and webhook both call this). */
export async function confirmFinePayment(sessionId: string) {
  const { stripe } = await import("./stripe");
  const session = await stripe().checkout.sessions.retrieve(sessionId);
  const fineId = session.metadata?.fineId;
  if (!fineId || session.payment_status !== "paid") return;
  await db.update(fines).set({ status: "paid", paidAt: new Date() }).where(and(eq(fines.id, fineId), eq(fines.status, "outstanding")));
}

/** Reminder emails: ~24 hours and ~2 hours before (the check runs every 15 minutes). Each is sent once. */
export async function sendReminders() {
  const { notifyReminder } = await import("./notify");
  const now = Date.now();
  let sent = 0;
  const due24 = await db.select().from(bookings).where(and(eq(bookings.status, "confirmed"), isNull(bookings.remind24At), gt(bookings.startsAt, new Date(now + 3 * 3600000)), lte(bookings.startsAt, new Date(now + 24 * 3600000))));
  for (const b of due24) {
    const [claimed] = await db.update(bookings).set({ remind24At: new Date() }).where(and(eq(bookings.id, b.id), isNull(bookings.remind24At))).returning();
    if (claimed && b.createdAt.getTime() < now - 3600000) { await notifyReminder(b, 24); sent++; } // skip for bookings made in the last hour
  }
  const due2 = await db.select().from(bookings).where(and(eq(bookings.status, "confirmed"), isNull(bookings.remind2At), gt(bookings.startsAt, new Date(now)), lte(bookings.startsAt, new Date(now + 2 * 3600000))));
  for (const b of due2) {
    const [claimed] = await db.update(bookings).set({ remind2At: new Date() }).where(and(eq(bookings.id, b.id), isNull(bookings.remind2At))).returning();
    if (claimed && b.createdAt.getTime() < now - 30 * 60000) { await notifyReminder(b, 2); sent++; }
  }
  return sent;
}

/** After the 12-month intro, Founding ($10) and early ($20) memberships move to the standard price. */
export async function stepUpPrices() {
  const { stripe, stripeEnabled, priceFor } = await import("./stripe");
  if (!stripeEnabled()) return 0;
  const due = await db.select().from(professionalProfiles).where(and(
    lte(professionalProfiles.introEndsAt, new Date()), isNull(professionalProfiles.priceSteppedAt), isNotNull(professionalProfiles.subscriptionId),
    inArray(professionalProfiles.cohort, ["FOUNDING", "SECOND"]),
  ));
  let n = 0;
  for (const p of due) {
    try {
      const sub = await stripe().subscriptions.retrieve(p.subscriptionId!);
      if (!["active", "trialing", "past_due"].includes(sub.status)) continue;
      const standard = await priceFor("STANDARD");
      const item = sub.items.data[0];
      if (item.price.id !== standard) {
        await stripe().subscriptions.update(sub.id, { items: [{ id: item.id, price: standard }], proration_behavior: "none", metadata: { steppedUp: "1" } });
      }
      await db.update(professionalProfiles).set({ priceSteppedAt: new Date() }).where(eq(professionalProfiles.userId, p.userId));
      n++;
    } catch (e) {
      console.error("Price step-up failed", p.userId, e);
    }
  }
  return n;
}
