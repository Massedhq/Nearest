import "server-only";
import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db, studentProfiles, professionalProfiles, fines, incidents, bookings } from "@/db";
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
