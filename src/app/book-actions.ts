"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gt, inArray, ne, or, lt } from "drizzle-orm";
import { db, bookings, proServices, modelCalls, professionalProfiles, cities } from "@/db";
import { geocode } from "@/lib/geo";
import { MAX_PRICE_CENTS } from "@/lib/pricing";
import { isAdult } from "@/lib/age";
import { studentSuspendedUntil } from "@/lib/enforcement";
import { requireVerifiedStudent, requireBooker } from "@/lib/student";
import { liveProWhere } from "@/lib/search";
import { openSlots } from "@/lib/availability";
import { creditBalances } from "@/lib/credits";
import { inviteRewardFor, reserveInviteReward, restoreInviteRewards } from "@/lib/student-invites";
import { confirmBooking, cancelByStudent, releasePayment, bookingCode, releaseHold, releaseMyHolds } from "@/lib/bookings";
import { getSettings } from "@/lib/settings";
import { stripe, stripeEnabled, origin } from "@/lib/stripe";
import { chicagoToUtc } from "@/lib/time";
import type { FormState } from "@/components/ActionForm";

const HOLD_MIN = 31; // Stripe Checkout sessions must stay open at least 30 minutes.

type Where = { locationType: "pro" | "student"; locationAddress: string; lat: number | null; lng: number | null };

/** Works out where the appointment happens and snapshots it on the booking. */
async function resolveLocation(pro: typeof professionalProfiles.$inferSelect, form: FormData, forceProPlace = false): Promise<Where | { error: string }> {
  const city = pro.cityId ? await db.query.cities.findFirst({ where: eq(cities.id, pro.cityId) }) : null;
  const wantsStudent = !forceProPlace && (pro.serviceMode === "travel" || (pro.serviceMode === "both" && form.get("where") === "student"));
  if (!wantsStudent && pro.addressLine) {
    let lat = pro.lat, lng = pro.lng;
    if (lat == null && city && pro.zip) {
      const pt = await geocode(pro.addressLine, city.name, pro.zip, city.state);
      if (pt) { lat = pt.lat; lng = pt.lng; await db.update(professionalProfiles).set({ lat, lng }).where(eq(professionalProfiles.userId, pro.userId)); }
    }
    return { locationType: "pro", locationAddress: `${pro.addressLine}${pro.addressUnit ? `, ${pro.addressUnit}` : ""}, ${city?.name ?? ""}, ${city?.state ?? "TX"} ${pro.zip ?? ""}`.trim(), lat, lng };
  }
  const street = String(form.get("street") ?? "").trim().slice(0, 160);
  const unit = String(form.get("unit") ?? "").trim().slice(0, 40);
  const sCity = String(form.get("city") ?? "").trim().slice(0, 60);
  const zip = String(form.get("zip") ?? "").trim();
  if (!street || !sCity || !/^\d{5}$/.test(zip)) return { error: "Enter the address where the professional should come (street, city and 5-digit ZIP)." };
  const st = city?.state ?? "TX"; // the student's address is in the professional's state
  const pt = await geocode(street, sCity, zip, st);
  return { locationType: "student", locationAddress: `${street}${unit ? `, ${unit}` : ""}, ${sCity}, ${st} ${zip}`, lat: pt?.lat ?? null, lng: pt?.lng ?? null };
}

async function livePro(proId: string) {
  const [p] = await db.select().from(professionalProfiles).where(and(eq(professionalProfiles.userId, proId), ...liveProWhere(null, "all"))).limit(1);
  return p ?? null;
}

async function checkout(b: typeof bookings.$inferSelect, email: string | null, proName: string) {
  const base = await origin();
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: email ?? undefined,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: b.chargedCents, product_data: { name: `${b.serviceName} with ${proName}`, description: `Booking ${bookingCode(b.number)} • includes the Deposit/Booking Fee` } } }],
    payment_intent_data: { transfer_group: b.id, metadata: { bookingId: b.id } },
    metadata: { bookingId: b.id },
    expires_at: Math.floor(Date.now() / 1000) + HOLD_MIN * 60,
    success_url: `${base}/bookings/${b.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/api/book/abandon?id=${b.id}`, // Stripe's back arrow: give the time back, return to where they were
  });
  await db.update(bookings).set({ stripeCheckoutId: session.id }).where(eq(bookings.id, b.id));
  return session.url!;
}

/** Creates a held booking, then sends the student to Stripe (or confirms right away when credit covers it). */
async function createAndPay(opts: {
  studentId: string; email: string | null; proId: string; proName: string; serviceId?: string; modelCallId?: string;
  serviceName: string; startsAt: Date; durationMin: number; priceCents: number; where: Where; travelFeeCents?: number;
  serviceFeeCents?: number; // Nearest's service fee inside priceCents (kept when the booking completes; Model Calls too, except ones published before the fee)
  bundleId?: string;
  cardId?: string; // the Nearest Card the student chose for this booking (never automatic)
  addons?: { id: string; name: string; priceCents: number; extraMin: number }[]; // included in priceCents and durationMin
  // "partner" = booked from a partner's own page (2026-11-09): anyone with an account, no $150 cap, no Nearest Cards,
  // invite rewards or promotional credit (their own credit from a cancelled partner booking still applies).
  channel?: "student" | "partner";
}): Promise<FormState> {
  const partner = opts.channel === "partner";
  if (!partner && opts.priceCents > MAX_PRICE_CENTS) return { error: `This is priced above Nearest's $${MAX_PRICE_CENTS / 100} student limit, so it can't be booked.` };
  // The $150 cap is on the service; a travel fee ($35–$55) is added only when the pro travels to the student.
  const travelFee = opts.where.locationType === "student" ? Math.min(Math.max(opts.travelFeeCents ?? 0, 0), 5500) : 0;
  opts = { ...opts, priceCents: opts.priceCents + travelFee };
  const s = await getSettings();
  if (s["status.bookings"] !== true) return { error: "Booking is paused right now. Please try again soon." };
  const deposit = Math.min(Number(s["appt.deposit_cents"]), opts.priceCents);
  // Bundle bookings never use credits or invite rewards — those are for single bookings only.
  const bal = opts.bundleId ? { pro: 0, general: 0, promo: 0 } : partner ? { ...(await creditBalances(opts.studentId, opts.proId)), promo: 0 } : await creditBalances(opts.studentId, opts.proId);
  // Invite reward: $5 off a student's first booking with this pro (services only, one per booking). The pro funds it.
  const inv = opts.serviceId && !opts.bundleId && !partner ? await inviteRewardFor(opts.studentId, opts.proId, opts.priceCents) : null;
  // Nearest Card: only when the student picked one. Reserved for this booking (so it can't be used twice) before the insert.
  const newId = crypto.randomUUID();
  const cards = await import("@/lib/nearest-cards");
  let cardAmt = 0;
  if (opts.cardId && !opts.bundleId && !partner) {
    // Cards are honored by the professional: only pros who accepted those Terms, and a Free Card only on their free service.
    const problem = await (await import("@/lib/promo")).cardProblem(opts.cardId, opts.proId, opts.serviceId, { modelCall: Boolean(opts.modelCallId) });
    if (problem) return { error: problem };
    const r = await cards.setBookingCard(opts.studentId, newId, opts.cardId);
    if (!r.ok) return { error: r.error };
    cardAmt = r.amountCents;
  }
  // Cards and promotional credit cover the service only — the student always pays the booking fee and deposit.
  const { promoCap } = await import("@/lib/promo");
  const capFor = (invCents: number) => promoCap({ priceCents: opts.priceCents, travelFeeCents: travelFee, serviceFeeCents: opts.serviceFeeCents ?? 0, depositCents: deposit, inviteDiscountCents: invCents, modelCallId: opts.modelCallId });
  let use = cards.planWithCard(opts.priceCents - (inv?.cents ?? 0), bal, cardAmt, capFor(inv?.cents ?? 0));
  const endsAt = new Date(opts.startsAt.getTime() + opts.durationMin * 60000);
  await releaseMyHolds(opts.studentId); // an old unfinished payment never blocks a new booking (accepted requests are kept)
  // From November 19, 2026 booking is INSTANT: the student pays now and it's confirmed when payment goes through
  // (src/lib/instant-booking.ts). Before then every booking started as a request the professional accepted first.
  const { requestDeadline, notifyNewRequest } = await import("@/lib/requests");
  const { instantBooking } = await import("@/lib/instant-booking");
  const isRequest = !instantBooking();

  const [b] = await db.insert(bookings).values({
    id: newId, channel: partner ? "partner" : "student", cardId: use.card > 0 ? opts.cardId : null, cardCents: use.card, promoCents: use.promoCents,
    studentId: opts.studentId, proId: opts.proId, serviceId: opts.serviceId ?? null, modelCallId: opts.modelCallId ?? null,
    serviceName: opts.serviceName, startsAt: opts.startsAt, endsAt, priceCents: opts.priceCents, travelFeeCents: travelFee, depositCents: deposit,
    addons: opts.addons?.length ? opts.addons : null, addonsCents: (opts.addons ?? []).reduce((t, a) => t + a.priceCents, 0),
    creditProCents: use.pro, creditGeneralCents: use.general, chargedCents: use.charge, inviteDiscountCents: inv?.cents ?? 0, bundleId: opts.bundleId ?? null, isRequest, serviceFeeCents: opts.serviceFeeCents ?? 0,
    status: isRequest ? "requested" : "pending_payment",
    holdExpiresAt: isRequest ? null : new Date(Date.now() + HOLD_MIN * 60000),
    requestExpiresAt: isRequest ? requestDeadline(opts.startsAt) : null,
    locationType: opts.where.locationType, locationAddress: opts.where.locationAddress, lat: opts.where.lat, lng: opts.where.lng,
  }).returning();
  if (inv) {
    if (await reserveInviteReward(inv.id, b.id)) await db.update(bookings).set({ inviteRewardId: inv.id }).where(eq(bookings.id, b.id));
    else {
      // The reward was just used elsewhere: book at the full price instead.
      use = cards.planWithCard(opts.priceCents, bal, cardAmt, capFor(0));
      await db.update(bookings).set({ inviteDiscountCents: 0, cardCents: use.card, promoCents: use.promoCents, creditProCents: use.pro, creditGeneralCents: use.general, chargedCents: use.charge }).where(eq(bookings.id, b.id));
      b.chargedCents = use.charge; b.creditProCents = use.pro; b.creditGeneralCents = use.general; b.inviteDiscountCents = 0;
    }
  }

  // Double-booking guard: if an earlier active booking overlaps this time, give up this one.
  if (!opts.modelCallId) {
    const clash = await db.select({ id: bookings.id }).from(bookings).where(and(
      eq(bookings.proId, opts.proId), ne(bookings.id, b.id), lt(bookings.number, b.number),
      lt(bookings.startsAt, endsAt), gt(bookings.endsAt, opts.startsAt),
      or(inArray(bookings.status, ["confirmed", "completed", "requested"]), and(eq(bookings.status, "pending_payment"), gt(bookings.holdExpiresAt, new Date()))),
    )).limit(1);
    if (clash.length) {
      await db.update(bookings).set({ status: "expired" }).where(eq(bookings.id, b.id));
      await restoreInviteRewards();
      return { error: "Someone just booked that time. Please pick another." };
    }
  }

  if (isRequest) {
    await notifyNewRequest(b);
    redirect(`/bookings/${b.id}?requested=1`);
  }
  // Instant: pay now (or confirm right away when credit covers it). confirmBooking tells the student and the pro.
  const fresh = (await db.query.bookings.findFirst({ where: eq(bookings.id, b.id) }))!;
  if (fresh.chargedCents === 0) { await confirmBooking(fresh.id); redirect(`/bookings/${fresh.id}?booked=1`); }
  if (!stripeEnabled()) {
    await db.update(bookings).set({ status: "expired", holdExpiresAt: null }).where(eq(bookings.id, fresh.id));
    await restoreInviteRewards();
    return { error: "Payments aren't available right now. Please try again soon." };
  }
  redirect(await checkout(fresh, opts.email, opts.proName));
}

/** The professional accepted: the student pays now (credits re-checked) — or it confirms right away if credit covers it. */
export async function payAcceptedBooking(form: FormData) {
  const { user } = await requireBooker();
  const id = String(form.get("id") ?? "");
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, id), eq(bookings.studentId, user.id)) });
  if (!b || b.status !== "pending_payment" || !b.respondedAt || (b.holdExpiresAt && b.holdExpiresAt.getTime() < Date.now())) redirect(`/bookings/${id}`);
  const bal = b.bundleId ? { pro: 0, general: 0, promo: 0 } : await creditBalances(user.id, b.proId);
  const cards = await import("@/lib/nearest-cards");
  // A Free Card whose professional has since given their one free service can't be used any more.
  const { promoCap, cardProblem } = await import("@/lib/promo");
  const cardOk = !b.bundleId && b.cardId && !(await cardProblem(b.cardId, b.proId, b.serviceId, { modelCall: Boolean(b.modelCallId), bookingId: b.id }));
  const use = cards.planWithCard(b.priceCents - b.inviteDiscountCents, bal, cardOk ? await cards.cardAmount(b.cardId, b.id) : 0, promoCap(b));
  await db.update(bookings).set({ cardCents: use.card, cardId: use.card > 0 ? b.cardId : null, promoCents: use.promoCents, creditProCents: use.pro, creditGeneralCents: use.general, chargedCents: use.charge }).where(eq(bookings.id, id));
  if (use.charge === 0) { await confirmBooking(id); redirect(`/bookings/${id}?booked=1`); }
  if (!stripeEnabled()) redirect(`/bookings/${id}?payment=unavailable`);
  const pro = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, b.proId) });
  redirect(await checkout({ ...b, chargedCents: use.charge, creditProCents: use.pro, creditGeneralCents: use.general }, user.email, pro?.businessName ?? "your professional"));
}

export async function bookService(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requireVerifiedStudent();
  if (studentSuspendedUntil(profile)) return { error: "Booking is temporarily unavailable on your account." };
  if (form.get("agree") !== "on") return { error: "Please agree to the booking and cancellation terms." };
  const serviceId = String(form.get("serviceId") ?? "");
  const day = String(form.get("day") ?? "");
  const time = String(form.get("time") ?? "");
  const svc = await db.query.proServices.findFirst({ where: and(eq(proServices.id, serviceId), eq(proServices.active, true)) });
  if (!svc) return { error: "That service isn't available." };
  if (svc.adultsOnly && !isAdult(user.dateOfBirth)) return { error: "This service is 18+ only. You must be 18 or older to book it." };
  const pro = await livePro(svc.userId);
  if (!pro) return { error: "This professional isn't taking bookings right now." };
  // Add-ons: price added to the service, time added to the appointment; the $150 limit covers both together.
  const { pickAddons, addonIds, withAddons } = await import("@/lib/addons");
  const picked = pickAddons(svc, addonIds(form.getAll("addon").map(String)));
  if (picked.overCap) return { error: `With those add-ons this would be over Nearest's $${MAX_PRICE_CENTS / 100} limit. Remove an add-on and try again.` };
  if (!(await openSlots(svc.userId, svc.durationMin + picked.minutes, day)).includes(time)) return { error: "That time was just taken or is no longer available. Please pick another." };
  const where = await resolveLocation(pro, form);
  if ("error" in where) return { error: where.error };
  // From a bundle: the day must be inside the bundle's week.
  const bundleItemId = String(form.get("bundleItem") ?? "");
  let bundleId: string | undefined;
  if (bundleItemId) {
    const bi = await (await import("@/lib/bundles")).bundleItemFor(bundleItemId, user.id, svc.id);
    if (!bi) return { error: "This bundle isn't available anymore." };
    if (!bi.days.includes(day)) return { error: "Pick a day during your bundle week." };
    bundleId = bi.bundle.id;
  }
  const cardId = String(form.get("cardId") ?? "");
  return createAndPay({ where, travelFeeCents: pro.travelFeeCents ?? 3500, bundleId, cardId: /^[0-9a-f-]{36}$/.test(cardId) ? cardId : undefined,
    studentId: user.id, email: user.email, proId: svc.userId, proName: pro.businessName ?? "your professional", serviceId: svc.id,
    serviceName: withAddons(svc.name, picked.list), startsAt: chicagoToUtc(day, time), durationMin: svc.durationMin + picked.minutes, priceCents: svc.priceCents + picked.cents,
    serviceFeeCents: svc.proPriceCents == null ? 0 : svc.serviceFeeCents, addons: picked.list,
  });
}

export async function bookModelCall(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requireVerifiedStudent();
  if (studentSuspendedUntil(profile)) return { error: "Booking is temporarily unavailable on your account." };
  if (form.get("agree") !== "on") return { error: "Please agree to the booking and cancellation terms." };
  const id = String(form.get("modelCallId") ?? "");
  const call = await db.query.modelCalls.findFirst({ where: and(eq(modelCalls.id, id), eq(modelCalls.status, "open")) });
  if (!call || call.startsAt.getTime() < Date.now() || call.spotsTaken >= call.spots) return { error: "This model call is full or no longer open." };
  const pro = await livePro(call.userId);
  if (!pro) return { error: "This professional isn't taking bookings right now." };
  const mine = await db.query.bookings.findFirst({ where: and(eq(bookings.modelCallId, id), eq(bookings.studentId, user.id), inArray(bookings.status, ["confirmed", "pending_payment"])) });
  if (mine?.status === "confirmed") return { error: "You already have a spot in this model call." };
  let startsAt = call.startsAt;
  if (call.flexible) {
    const day = String(form.get("day") ?? ""), time = String(form.get("time") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Pick a day and time first." };
    if (!(await openSlots(call.userId, call.durationMin, day)).includes(time)) return { error: "That time was just taken or isn't available. Please pick another." };
    startsAt = chicagoToUtc(day, time);
    if (startsAt.getTime() > call.startsAt.getTime()) return { error: "That time is after this model call closes. Please pick an earlier time." };
  }
  const where = await resolveLocation(pro, form, Boolean(pro.addressLine));
  if ("error" in where) return { error: where.error };
  return createAndPay({ where, travelFeeCents: pro.travelFeeCents ?? 3500,
    studentId: user.id, email: user.email, proId: call.userId, proName: pro.businessName ?? "your professional", modelCallId: call.id,
    serviceName: `${call.serviceName} (Model Call)`, startsAt, durationMin: call.durationMin, priceCents: call.priceCents,
    serviceFeeCents: call.serviceFeeCents, // Nearest's service fee (0 on Model Calls published before the fee)
  });
}

export async function resumePayment(form: FormData) {
  const { user } = await requireBooker();
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, String(form.get("id"))), eq(bookings.studentId, user.id), eq(bookings.status, "pending_payment")) });
  if (!b || !b.holdExpiresAt || b.holdExpiresAt.getTime() < Date.now()) redirect("/bookings");
  const pro = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, b.proId) });
  redirect(await checkout(b, user.email, pro?.businessName ?? "your professional"));
}

export async function cancelMyBooking(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireBooker();
  const res = await cancelByStudent(String(form.get("id")), user.id);
  revalidatePath("/bookings");
  return res.error ? { error: res.error } : { ok: res.ok };
}

export async function releaseMyPayment(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireBooker();
  try {
    const res = await releasePayment(String(form.get("id")), user.id);
    revalidatePath("/bookings");
    return res.error ? { error: res.error } : { ok: res.ok };
  } catch (e) {
    console.error(e);
    return { error: "Something went wrong releasing payment. Your payment is still protected — try again in a minute." };
  }
}

/** "Cancel — don't book" on an unfinished payment: give the time back, go back to Explore. */
export async function abandonBooking(form: FormData) {
  const { user } = await requireBooker();
  const id = String(form.get("id") ?? "");
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, id), eq(bookings.studentId, user.id)) });
  const r = await releaseHold(id, user.id);
  revalidatePath("/bookings");
  if (r === "paid") redirect(`/bookings/${id}?booked=1`);
  if (b?.channel === "partner") redirect(`${await partnerBase(b.proId)}?notbooked=1`);
  redirect(b ? `${b.modelCallId ? `/book/call/${b.modelCallId}` : `/p/${b.proId}`}?notbooked=1` : "/home");
}

/** The student withdraws a booking request before the professional confirms (the card hold is released). */
export async function cancelBookingRequest(form: FormData) {
  const { user } = await requireBooker();
  const id = String(form.get("id") ?? "");
  await (await import("@/lib/requests")).cancelRequest(id, user.id);
  redirect(`/bookings/${id}`);
}

/** A partner's page path (/link/<slug>), or their bookings list if the page is gone. */
async function partnerBase(proId: string) {
  const p = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, proId), columns: { slug: true } });
  return p?.slug ? `/link/${p.slug}` : "/bookings";
}

/**
 * Partner side (2026-11-09): book a partner from their own page. Anyone with a Nearest account (partner clients, students,
 * others). No $150 cap. Bundled services (several of the partner's own services in one visit) ride along like add-ons,
 * at the professional's own price. Same booking fee, deposit, cancellation, instant-booking and payment rules.
 */
export async function bookPartnerService(_: FormState, form: FormData): Promise<FormState> {
  const { getViewer } = await import("@/lib/viewer");
  const viewer = await getViewer();
  const user = viewer?.user;
  if (!user || user.status === "deactivated") return { error: "Please sign in to book." };
  if (form.get("agree") !== "on") return { error: "Please agree to the booking and cancellation terms." };
  const { partnerForBooking, partnerService, bundleExtras } = await import("@/lib/partner-booking");
  const x = await partnerForBooking(String(form.get("slug") ?? ""));
  if (!x) return { error: "This partner isn't taking bookings right now." };
  if (x.pro.userId === user.id) return { error: "You can't book yourself." };
  const svc = await partnerService(x.pro.userId, String(form.get("serviceId") ?? ""));
  if (!svc) return { error: "That service isn't available." };
  const { pickAddons, addonIds, withAddons } = await import("@/lib/addons");
  const picked = pickAddons(svc, addonIds(form.getAll("addon").map(String)));
  const extras = await bundleExtras(x.pro.userId, svc.id, String(form.get("with") ?? ""));
  const adultOnly = svc.adultsOnly || (extras.length > 0 && (await db.select({ a: proServices.adultsOnly }).from(proServices).where(inArray(proServices.id, extras.map((e) => e.id)))).some((r) => r.a));
  if (adultOnly && !isAdult(user.dateOfBirth)) return { error: "This includes an 18+ service. You must be 18 or older to book it." };
  const day = String(form.get("day") ?? ""), time = String(form.get("time") ?? "");
  const length = svc.durationMin + picked.minutes + extras.reduce((t, e) => t + e.extraMin, 0);
  if (!(await openSlots(svc.userId, length, day)).includes(time)) return { error: "That time was just taken or is no longer available. Please pick another." };
  const where = await resolveLocation(x.pro, form);
  if ("error" in where) return { error: where.error };
  const list = [...extras, ...picked.list];
  return createAndPay({ channel: "partner", where, travelFeeCents: x.pro.travelFeeCents ?? 3500,
    studentId: user.id, email: user.email, proId: x.pro.userId, proName: x.pro.businessName ?? x.name, serviceId: svc.id,
    serviceName: withAddons(svc.name, list), startsAt: chicagoToUtc(day, time), durationMin: length,
    priceCents: svc.priceCents + list.reduce((t, a) => t + a.priceCents, 0),
    serviceFeeCents: svc.proPriceCents == null ? 0 : svc.serviceFeeCents, addons: list,
  });
}
