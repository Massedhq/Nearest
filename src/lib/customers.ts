import "server-only";
import { redirect } from "next/navigation";
import { db, users } from "@/db";
import { getViewer, clerkContact } from "./viewer";
import { validName, validDob, ageFrom } from "./validate";

/**
 * Partner clients (2026-11-09): anyone can book a Nearest Partner from the partner's own page (/link/<slug>).
 * They make a quick account — name, date of birth (18+), email verified with a code, optional phone — with no school
 * or ID check. accountType "customer". They only ever book partners; the student app stays verified students only.
 */
export const CUSTOMER_MIN_AGE = 18;

/** Only same-site partner booking paths may be returned to after sign-up / sign-in. */
export function safePartnerNext(raw: string | null | undefined) {
  return raw && /^\/link\/[a-z0-9-]{2,40}(\/[A-Za-z0-9/?&=%,._-]*)?$/.test(raw) ? raw : null;
}

/** Called right after the email code: builds the customer account from what they typed on the sign-up screen. */
export async function createCustomerFromSignUp(): Promise<"created" | "exists" | "problem" | "other"> {
  const viewer = await getViewer();
  if (!viewer) return "problem";
  if (viewer.user) return "exists";
  const c = await clerkContact();
  if (c && c.door !== "customer") return "other"; // a student/pro/rep sign-up that isn't finished goes its own way
  const firstName = c?.clerkUser.firstName?.trim() ?? "";
  const lastName = c?.clerkUser.lastName?.trim() ?? "";
  if (!c?.email || !c.emailVerifiedAt || !c.dob || !validDob(c.dob) || !validName(firstName) || !validName(lastName)) return "problem";
  if (ageFrom(c.dob) < CUSTOMER_MIN_AGE) return "problem";
  await db.insert(users).values({
    clerkUserId: viewer.clerkUserId, accountType: "customer", firstName, lastName, dateOfBirth: c.dob,
    phone: c.phone ?? c.typedPhone, phoneVerifiedAt: c.phoneVerifiedAt, email: c.email, emailVerifiedAt: c.emailVerifiedAt,
  }).onConflictDoNothing();
  return "created";
}

/** Anyone signed in with a Nearest account can book a partner (customers, students, professionals, owners). */
export async function requirePartnerBooker(slug: string, here: string) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/link/${slug}/join?next=${encodeURIComponent(here)}`);
  if (!viewer.user) redirect(`/customer/finish?next=${encodeURIComponent(here)}`);
  if (viewer.user.status === "deactivated") redirect("/");
  return viewer.user;
}
