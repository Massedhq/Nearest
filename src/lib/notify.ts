import "server-only";
import { eq } from "drizzle-orm";
import { db, bookings, users, professionalProfiles } from "@/db";
import { sendEmail } from "./email";
import { fmtDate, fmtTime } from "./time";
import { bookingCode } from "./bookings";

type Booking = typeof bookings.$inferSelect;
const APP = () => process.env.APP_URL || "https://usenearest.com";

async function people(b: Booking) {
  const [student, proUser, pro] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, b.studentId) }),
    db.query.users.findFirst({ where: eq(users.id, b.proId) }),
    db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, b.proId) }),
  ]);
  return { student, proUser, proName: pro?.businessName ?? "your professional" };
}
const when = (b: Booking) => `${fmtDate(b.startsAt, { weekday: "long", month: "long", day: "numeric" })} at ${fmtTime(b.startsAt)}`;

/** All booking emails. Each one is best-effort: a failed email never blocks the booking. */
export async function notifyBooked(b: Booking) {
  const { student, proUser, proName } = await people(b);
  await Promise.all([
    sendEmail({ to: student?.email, subject: `You're booked with ${proName}`, eyebrow: `Booking ${bookingCode(b.number)}`, heading: "You're booked.", lines: [`${b.serviceName} with ${proName}`, when(b), "Your payment is held until you release it after the appointment. The address appears at 12:00 AM on the appointment day."], button: { label: "View appointment", url: `${APP()}/bookings/${b.id}` } }),
    sendEmail({ to: proUser?.email, subject: `New booking: ${b.serviceName}`, eyebrow: `Booking ${bookingCode(b.number)}`, heading: "You have a new booking.", lines: [`${b.serviceName} with ${student?.firstName ?? "a student"}`, when(b), "Paid in full and held until the student releases it."], button: { label: "Open appointment", url: `${APP()}/pro/appointments/${b.id}` } }),
  ]);
}

export async function notifyReminder(b: Booking, hours: 24 | 2) {
  const { student, proUser, proName } = await people(b);
  const jobs = [
    sendEmail({ to: student?.email, subject: hours === 24 ? `Tomorrow: ${b.serviceName} with ${proName}` : `In 2 hours: ${b.serviceName}`, eyebrow: "Reminder", heading: hours === 24 ? "Your appointment is tomorrow." : `Your appointment starts at ${fmtTime(b.startsAt)}.`, lines: [`${b.serviceName} with ${proName}`, when(b), hours === 24 ? "Need to cancel? Doing it now keeps your full payment as credit." : "Check in when you arrive — you'll need to be within 100 ft."], button: { label: "View appointment", url: `${APP()}/bookings/${b.id}` } }),
  ];
  if (hours === 24) jobs.push(sendEmail({ to: proUser?.email, subject: `Tomorrow: ${b.serviceName}`, eyebrow: "Reminder", heading: "You have an appointment tomorrow.", lines: [`${b.serviceName} with ${student?.firstName ?? "a student"}`, when(b)], button: { label: "Open appointment", url: `${APP()}/pro/appointments/${b.id}` } }));
  await Promise.all(jobs);
}

export async function notifyFinished(b: Booking) {
  const { student, proName } = await people(b);
  await sendEmail({ to: student?.email, subject: "Finish your appointment", eyebrow: proName, heading: "Your professional finished your service.", lines: ["Confirm the service, add an optional photo, leave a review, and release payment.", "Please complete these steps before you leave."], button: { label: "Finish now", url: `${APP()}/bookings/${b.id}/finish` } });
}

export async function notifyCancelled(b: Booking, by: "student" | "pro") {
  const { student, proUser, proName } = await people(b);
  if (by === "student") await sendEmail({ to: proUser?.email, subject: `Cancelled: ${b.serviceName} ${fmtDate(b.startsAt)}`, heading: "A student cancelled.", lines: [`${b.serviceName} • ${when(b)}`, "The time is open again on your calendar."] });
  else await sendEmail({ to: student?.email, subject: `${proName} cancelled your appointment`, heading: "Your appointment was cancelled.", lines: [`${b.serviceName} • ${when(b)}`, "The full amount is back as Nearest credit you can use with any professional."], button: { label: "Book someone else", url: `${APP()}/home` } });
}
