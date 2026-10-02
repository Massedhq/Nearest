import "server-only";
import { and, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db, cities, professionalProfiles, users, studentProfiles, schools } from "@/db";
import { stripe, priceFor, type PlanKey } from "./stripe";
import { saveSubscription } from "./pro-stripe";
import { isManagedEntry, isOwnerBusiness, ENTRY } from "./entry";
import { sendCityOpenEmail } from "./email";
import { logActivity } from "./log";

const base = () => process.env.APP_URL || "https://www.usenearest.com";
const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

export type ActivationSummary = { started: number; extended: number; cardFailed: number; released: number; students: number };

/**
 * Open a city for booking. For every professional placed there:
 *  - card saved, profile submitted → membership starts today on the saved card (12-month rate lock from today)
 *  - card saved, profile never submitted → spot released (no charge)
 *  - already paying from before → next charge moves to 30 days from today
 * Owners, Ambassadors and pay-from-bookings accounts are left alone. Verified students in the city are notified.
 */
export async function activateCity(cityId: number, actorId: string): Promise<ActivationSummary> {
  const city = await db.query.cities.findFirst({ where: eq(cities.id, cityId) });
  if (!city) throw new Error("City not found.");
  if (!city.bookingOpenAt) await db.update(cities).set({ bookingOpenAt: new Date() }).where(eq(cities.id, cityId));
  const out: ActivationSummary = { started: 0, extended: 0, cardFailed: 0, released: 0, students: 0 };
  const pros = await db.select({ p: professionalProfiles, u: users }).from(professionalProfiles).innerJoin(users, eq(users.id, professionalProfiles.userId))
    .where(and(sql`coalesce(${professionalProfiles.cityId}, ${professionalProfiles.slotCityId}) = ${cityId}`, isNotNull(professionalProfiles.entryPaidAt), isNull(professionalProfiles.placementReleasedAt)));
  const thirtyDays = Math.floor(Date.now() / 1000) + 30 * 86400;
  const { inbox } = await import("./inbox");
  for (const { p, u } of pros) {
    if (isManagedEntry(p.entryType) || (await isOwnerBusiness(p.userId))) continue;
    try {
      // Already paying from before the city opened: push the next charge to 30 days from today (once).
      if (p.subscriptionId && ["active", "trialing", "past_due"].includes(p.subscriptionStatus ?? "")) {
        const sub = await stripe().subscriptions.retrieve(p.subscriptionId);
        if (sub.metadata?.cityOpenExtended !== "1") {
          const updated = await stripe().subscriptions.update(p.subscriptionId, { trial_end: thirtyDays, proration_behavior: "none", metadata: { ...sub.metadata, cityOpenExtended: "1" } });
          await saveSubscription(p.userId, updated);
          out.extended++;
          if (u.email) await sendCityOpenEmail({ to: u.email, first: u.firstName ?? "Hi", city: city.name, kind: "extended", link: `${base()}/pro/home` });
        }
        continue;
      }
      if (!p.cardSavedAt || p.subscriptionId) continue;
      // Profile never submitted: release the spot (no charge).
      if (p.reviewStatus === "draft") {
        await db.update(professionalProfiles).set({ placementReleasedAt: new Date() }).where(eq(professionalProfiles.userId, p.userId));
        out.released++;
        await inbox(p.userId, { kind: "placement", title: `Your spot in ${city.name} was released`, body: "Your profile wasn't submitted when bookings opened. You weren't charged.", href: "/pro/home" });
        if (u.email) await sendCityOpenEmail({ to: u.email, first: u.firstName ?? "Hi", city: city.name, kind: "released", link: `${base()}/pro/home` });
        continue;
      }
      // Start the membership on the saved card.
      const type = (p.entryType && p.entryType in ENTRY ? p.entryType : "DFW_NEXT") as PlanKey;
      const sub = await stripe().subscriptions.create({
        customer: p.stripeCustomerId!, items: [{ price: await priceFor(type) }],
        payment_behavior: "allow_incomplete", metadata: { userId: p.userId, entryType: String(type), startedAtCityOpen: "1" },
      });
      await saveSubscription(p.userId, sub);
      const amount = money(p.monthlyRateCents ?? 1100);
      if (["active", "trialing"].includes(sub.status)) {
        out.started++;
        await inbox(p.userId, { kind: "placement", title: `Bookings are open in ${city.name}`, body: `Your membership started today at ${amount}/month.`, href: "/pro/home" });
        if (u.email) await sendCityOpenEmail({ to: u.email, first: u.firstName ?? "Hi", city: city.name, kind: "started", amount, link: `${base()}/pro/home` });
      } else {
        out.cardFailed++;
        await inbox(p.userId, { kind: "placement", title: "Your card didn't go through", body: "Update your card within 7 days to keep your spot.", href: "/pro/payments" });
        if (u.email) await sendCityOpenEmail({ to: u.email, first: u.firstName ?? "Hi", city: city.name, kind: "card_failed", link: `${base()}/pro/payments` });
      }
    } catch (e) { console.error("activate city", p.userId, e); }
  }
  // Tell verified students at schools in this city that booking is open.
  const students = await db.select({ id: studentProfiles.userId }).from(studentProfiles).innerJoin(schools, eq(schools.id, studentProfiles.schoolId))
    .where(and(eq(schools.cityId, cityId), eq(studentProfiles.verificationStatus, "verified")));
  for (const s of students) {
    try { await inbox(s.id, { kind: "city_open", title: `Booking is open in ${city.name}`, body: "Professionals near you are ready to book now.", href: "/home" }); out.students++; } catch { /* keep going */ }
  }
  await logActivity({ actorUserId: actorId, action: "city.booking_opened", targetType: "city", targetId: String(cityId), after: out });
  return out;
}

/** Cards that failed when a city opened: after 7 days without a working card, the spot is released. */
export async function releaseFailedPlacements() {
  const rows = await db.select({ p: professionalProfiles }).from(professionalProfiles)
    .innerJoin(cities, sql`${cities.id} = coalesce(${professionalProfiles.cityId}, ${professionalProfiles.slotCityId})`)
    .where(and(isNotNull(professionalProfiles.cardSavedAt), isNull(professionalProfiles.placementReleasedAt),
      inArray(professionalProfiles.subscriptionStatus, ["incomplete", "incomplete_expired", "past_due", "unpaid"]),
      lt(cities.bookingOpenAt, sql`now() - interval '7 days'`)));
  for (const { p } of rows) {
    try { if (p.subscriptionId) await stripe().subscriptions.cancel(p.subscriptionId); } catch (e) { console.error(e); }
    await db.update(professionalProfiles).set({ placementReleasedAt: new Date(), subscriptionStatus: "canceled" }).where(eq(professionalProfiles.userId, p.userId));
  }
  return rows.length;
}
