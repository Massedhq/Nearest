import "server-only";
import { and, eq, gt, inArray, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import { db, bookings, campaignEntries, campaignOffers, cities, professionalProfiles, proServices, users } from "@/db";
import { CAMPAIGN_KEY, getCampaign, recordEvent } from "./campaign";
import { MIN_REWARD_CENTS } from "./campaign-pro";
import { liveProWhere } from "./search";

/**
 * The launch campaign's free-service reward. One per approved student, non-transferable, booked only through a
 * confirmed arrangement (campaign_offers) once booking opens. The student pays $0 — no deposit, no service fee,
 * no travel fee (always at the professional's location). Participating professionals agreed to give the service free
 * (payout $0) — new pros at submit, earlier pros from their home card (src/lib/campaign-pro.ts).
 */
export async function rewardOffers() {
  return db.select({
    o: campaignOffers, service: proServices, pro: professionalProfiles,
    first: users.firstName, last: users.lastName, city: cities.name,
  }).from(campaignOffers)
    .innerJoin(proServices, eq(proServices.id, campaignOffers.serviceId))
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, campaignOffers.proId))
    .innerJoin(users, eq(users.id, campaignOffers.proId))
    .leftJoin(cities, eq(cities.id, professionalProfiles.cityId))
    .where(and(
      eq(campaignOffers.campaignKey, CAMPAIGN_KEY), eq(campaignOffers.active, true), isNotNull(campaignOffers.confirmedAt), sql`${campaignOffers.slotsUsed} < ${campaignOffers.slotsTotal}`,
      // Only professionals who agreed to the free service, still live on Nearest, offering an active service listed at $25+.
      eq(professionalProfiles.campaignChoice, "agreed"), eq(proServices.active, true), sql`${proServices.priceCents} >= ${MIN_REWARD_CENTS}`,
      isNotNull(professionalProfiles.addressLine), ...liveProWhere(null, "all"),
    ));
}

/** Why this approved student can't book the reward right now (null = they can). */
export async function rewardBlocker(entry: typeof campaignEntries.$inferSelect | null | undefined) {
  if (!entry || entry.status !== "approved") return "Your participation must be approved first.";
  if (entry.rewardBookingId) return "Your free service is already booked.";
  const c = await getCampaign();
  if (!c.bookingOpensAt || c.bookingOpensAt.getTime() > Date.now()) return "Booking hasn't opened yet.";
  if (!(await rewardOffers()).length) return "No reward appointments are available right now — check back soon.";
  return null;
}

/** Book the reward. Every step that could double-use it is a single conditional statement. */
export async function bookReward(studentId: string, offerId: string, startsAt: Date): Promise<{ bookingId: string } | { error: string }> {
  const entry = await db.query.campaignEntries.findFirst({ where: and(eq(campaignEntries.campaignKey, CAMPAIGN_KEY), eq(campaignEntries.studentId, studentId)) });
  const blocked = await rewardBlocker(entry);
  if (blocked) return { error: blocked };
  const offer = (await rewardOffers()).find((r) => r.o.id === offerId)?.o;
  if (!offer) return { error: "That appointment option isn't available." };
  const svc = await db.query.proServices.findFirst({ where: eq(proServices.id, offer.serviceId) });
  const pro = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, offer.proId) });
  if (!svc || !pro?.addressLine) return { error: "That appointment option isn't available." };
  const endsAt = new Date(startsAt.getTime() + svc.durationMin * 60000);

  // 1) Take one of the offer's appointments (atomic).
  const [slot] = await db.update(campaignOffers).set({ slotsUsed: sql`${campaignOffers.slotsUsed} + 1` })
    .where(and(eq(campaignOffers.id, offer.id), sql`${campaignOffers.slotsUsed} < ${campaignOffers.slotsTotal}`)).returning();
  if (!slot) return { error: "Those reward appointments just filled up. Try another option." };

  // 2) The booking request (the student pays nothing; Nearest pays the professional).
  const city = pro.cityId ? await db.query.cities.findFirst({ where: eq(cities.id, pro.cityId) }) : null;
  const { requestDeadline, notifyNewRequest } = await import("./requests");
  const [b] = await db.insert(bookings).values({
    studentId, proId: offer.proId, serviceId: svc.id, serviceName: `${svc.name} — Nearest launch reward`, startsAt, endsAt,
    priceCents: 0, travelFeeCents: 0, depositCents: 0, creditProCents: 0, creditGeneralCents: 0, chargedCents: 0, inviteDiscountCents: 0,
    serviceFeeCents: 0, isRequest: true, status: "requested", holdExpiresAt: null, requestExpiresAt: requestDeadline(startsAt),
    locationType: "pro", locationAddress: `${pro.addressLine}${pro.addressUnit ? `, ${pro.addressUnit}` : ""}, ${city?.name ?? ""}, ${city?.state ?? "TX"} ${pro.zip ?? ""}`.trim(),
    lat: pro.lat, lng: pro.lng,
    campaignEntryId: entry!.id, campaignOfferId: offer.id, campaignPayoutCents: offer.payoutCents,
  }).returning();

  const undo = async (msg: string) => {
    await db.update(bookings).set({ status: "expired", campaignSlotReleased: true }).where(eq(bookings.id, b.id));
    await db.update(campaignOffers).set({ slotsUsed: sql`greatest(${campaignOffers.slotsUsed} - 1, 0)` }).where(eq(campaignOffers.id, offer.id));
    return { error: msg };
  };

  // 3) Same time already taken with this professional?
  const clash = await db.select({ id: bookings.id }).from(bookings).where(and(
    eq(bookings.proId, offer.proId), ne(bookings.id, b.id), lt(bookings.number, b.number), lt(bookings.startsAt, endsAt), gt(bookings.endsAt, startsAt),
    or(inArray(bookings.status, ["confirmed", "completed", "requested"]), and(eq(bookings.status, "pending_payment"), gt(bookings.holdExpiresAt, new Date()))),
  )).limit(1);
  if (clash.length) return undo("Someone just booked that time. Please pick another.");

  // 4) Claim the student's one reward (atomic: only if approved and not already in use).
  const [claimed] = await db.update(campaignEntries).set({ rewardBookingId: b.id, version: sql`${campaignEntries.version} + 1` })
    .where(and(eq(campaignEntries.id, entry!.id), eq(campaignEntries.status, "approved"), sql`${campaignEntries.rewardBookingId} is null`)).returning();
  if (!claimed) return undo("Your free service is already booked.");

  await recordEvent(entry!.id, studentId, "reward_booked", `${svc.name} requested for ${startsAt.toISOString()}`);
  await notifyNewRequest(b);
  return { bookingId: b.id };
}

/** Booking confirmed (the professional accepted) → the reward is redeemed. Called from confirmBooking. */
export async function markRewardRedeemed(b: typeof bookings.$inferSelect) {
  if (!b.campaignEntryId) return;
  const [e] = await db.update(campaignEntries).set({ status: "redeemed", redeemedAt: new Date(), version: sql`${campaignEntries.version} + 1` })
    .where(and(eq(campaignEntries.id, b.campaignEntryId), eq(campaignEntries.rewardBookingId, b.id), eq(campaignEntries.status, "approved"))).returning();
  if (e) await recordEvent(e.id, null, "reward_redeemed", "The professional accepted the free-service booking.");
}

/**
 * A reward booking that ended without the service (declined, expired, cancelled by either side) gives the reward back,
 * and the offer's appointment back — exactly once. A no-show keeps it used (published in the campaign terms).
 */
export async function reconcileRewards(onlyEntryId?: string) {
  const rows = await db.select({ e: campaignEntries, b: bookings }).from(campaignEntries)
    .innerJoin(bookings, eq(bookings.id, campaignEntries.rewardBookingId))
    .where(and(eq(campaignEntries.campaignKey, CAMPAIGN_KEY), inArray(bookings.status, ["cancelled_student", "cancelled_pro", "expired"]),
      ...(onlyEntryId ? [eq(campaignEntries.id, onlyEntryId)] : [])));
  let restored = 0;
  for (const { e, b } of rows) {
    const [back] = await db.update(campaignEntries).set({ status: "approved", rewardBookingId: null, redeemedAt: null, version: sql`${campaignEntries.version} + 1` })
      .where(and(eq(campaignEntries.id, e.id), eq(campaignEntries.rewardBookingId, b.id))).returning();
    if (!back) continue;
    const [rel] = await db.update(bookings).set({ campaignSlotReleased: true }).where(and(eq(bookings.id, b.id), eq(bookings.campaignSlotReleased, false))).returning();
    if (rel && b.campaignOfferId) await db.update(campaignOffers).set({ slotsUsed: sql`greatest(${campaignOffers.slotsUsed} - 1, 0)` }).where(eq(campaignOffers.id, b.campaignOfferId));
    await recordEvent(e.id, null, "reward_restored", "The reward booking didn't go ahead, so the free service is available again.");
    const { notifyOnce } = await import("./campaign-notify");
    await notifyOnce(`reward-restored:${b.id}`, e.studentId, { title: "Your free service is available again", body: "That appointment didn't go ahead — you can book your free service again.", href: "/campaign" });
    restored++;
  }
  return restored;
}
