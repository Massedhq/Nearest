import "server-only";
import type Stripe from "stripe";
import { and, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db, platformSettings, entryCounters, professionalProfiles, proStudentLinks, users } from "@/db";
import { getSettings } from "./settings";
import { stripe, priceFor } from "./stripe";
import { saveSubscription } from "./pro-stripe";
import { logActivity } from "./log";

// ---------- Entry types (rate locked to each professional's account) ----------
export const ENTRY = {
  FIRST_IN: { cents: 1100, label: "First In", short: "First In" },
  PRO_STUDENT: { cents: 1600, label: "Professional + Student", short: "Pro + Student" },
  GENERAL: { cents: 2100, label: "General Entry", short: "General" },
  // DFW after the 750 First In spots, and every market after DFW (Houston, other cities and states).
  DFW_NEXT: { cents: 1700, label: "DFW entry", short: "DFW" },
  MARKET: { cents: 2000, label: "Market rate", short: "Market" },
  // Owner-granted (invitation only, main owner): no Stripe subscription — Nearest manages these memberships.
  AMBASSADOR: { cents: 0, label: "Ambassador — free", short: "Ambassador" },
  BOOKING_PAID: { cents: 1500, label: "Pay from bookings", short: "Pay from bookings" },
} as const;

/** Memberships Nearest runs itself (no card, no Stripe subscription). */
export const MANAGED_ENTRIES = ["AMBASSADOR", "BOOKING_PAID"] as const;
export type ManagedEntryType = (typeof MANAGED_ENTRIES)[number];
export const isManagedEntry = (t: string | null | undefined): t is ManagedEntryType => (MANAGED_ENTRIES as readonly string[]).includes(t ?? "");
export type EntryType = keyof typeof ENTRY;
export const isEntryType = (v: unknown): v is EntryType => typeof v === "string" && v in ENTRY;

// ---------- Enrollment state (admin-controlled, no code changes) ----------
export const ENTRY_STATES = ["FIRST_IN_OPEN", "FIRST_IN_CLOSED", "NEXT_ENTRY_OPEN"] as const;
export type EntryState = (typeof ENTRY_STATES)[number];
const STATE_KEY = "entry.state";

export async function getEntryState(): Promise<EntryState> {
  const row = await db.query.platformSettings.findFirst({ where: eq(platformSettings.key, STATE_KEY) });
  const v = row?.value as string | undefined;
  return (ENTRY_STATES as readonly string[]).includes(v ?? "") ? (v as EntryState) : "FIRST_IN_OPEN";
}

export async function setEntryState(state: EntryState, actorId: string | null) {
  const before = await getEntryState();
  await db.insert(platformSettings).values({ key: STATE_KEY, value: state, updatedBy: actorId })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value: state, updatedBy: actorId, updatedAt: new Date() } });
  await logActivity({ actorUserId: actorId, action: "entry.state", targetType: "setting", targetId: STATE_KEY, before, after: state });
}

// ---------- First In seats: a hard limit enforced by one atomic counter ----------
const HOLD_MIN = 35; // a seat is held this long while someone pays
const CHECKOUT_MIN = 31; // Stripe's minimum is 30 — checkout always expires before the hold, so no 751st payment can finish

async function capacity() {
  return Number((await getSettings())["growth.founding_capacity"]) || 750;
}

export async function firstInStats() {
  const cap = await capacity();
  const [paid] = await db.select({ n: sql<number>`count(*)::int` }).from(professionalProfiles)
    .where(and(eq(professionalProfiles.entryType, "FIRST_IN"), isNotNull(professionalProfiles.entryPaidAt)));
  const [held] = await db.select({ n: sql<number>`count(*)::int` }).from(professionalProfiles)
    .where(and(eq(professionalProfiles.entryType, "FIRST_IN"), isNull(professionalProfiles.entryPaidAt), sql`${professionalProfiles.entryHoldUntil} > now()`));
  const state = await getEntryState();
  return { capacity: cap, registered: paid.n, holding: held.n, remaining: Math.max(0, cap - paid.n), state, open: state === "FIRST_IN_OPEN" && paid.n < cap };
}

/** Takes one First In seat if one is left (atomic: two people can never get the last seat). */
async function takeSeat(): Promise<boolean> {
  const cap = await capacity();
  await db.insert(entryCounters).values({ key: "first_in", taken: 0 }).onConflictDoNothing();
  const [row] = await db.update(entryCounters).set({ taken: sql`${entryCounters.taken} + 1` })
    .where(and(eq(entryCounters.key, "first_in"), lt(entryCounters.taken, cap))).returning();
  return Boolean(row);
}
async function giveBackSeat() {
  await db.update(entryCounters).set({ taken: sql`greatest(${entryCounters.taken} - 1, 0)` }).where(eq(entryCounters.key, "first_in"));
}

/** Releases seats held by people who didn't finish paying (their checkout has already expired). */
export async function releaseExpiredHolds() {
  const expired = await db.update(professionalProfiles)
    .set({ entryType: null, monthlyRateCents: null, entryHoldUntil: null, entryCheckoutId: null })
    .where(and(eq(professionalProfiles.entryType, "FIRST_IN"), isNull(professionalProfiles.entryPaidAt), lt(professionalProfiles.entryHoldUntil, new Date())))
    .returning({ userId: professionalProfiles.userId });
  for (let i = 0; i < expired.length; i++) await giveBackSeat();
  return expired.length;
}

/** Entries paid by card through Stripe checkout (managed entries never go through checkout). */
export type PaidEntryType = Exclude<EntryType, (typeof MANAGED_ENTRIES)[number]>;
export type EntryChoice = { type: PaidEntryType; student?: { firstName: string; lastName: string; email: string; school?: string | null } };

/** Starts payment for an entry. Returns the Stripe checkout URL, or an error to show. */
/**
 * Which entry rates this professional can pay right now.
 * Enrollment state (Admin → First In) comes first; then their city + category spot decides the rate:
 * the first spots are First In, the next spots are next entry, and a full city + category has none (waitlist).
 * Invited, Nearest-managed and owner accounts follow the enrollment state only.
 */
/** "The next 750": DFW spots at the $17 rate after First In (earlier $16 / $21 members count too). */
export async function nextEntryStats() {
  const s = await getSettings();
  const capacity = Math.max(0, Number(s["growth.next_entry_capacity"] ?? 750));
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(professionalProfiles)
    .where(and(inArray(professionalProfiles.entryType, ["DFW_NEXT", "PRO_STUDENT", "GENERAL"]), isNotNull(professionalProfiles.entryPaidAt)));
  const registered = r?.n ?? 0;
  return { capacity, registered, left: Math.max(0, capacity - registered), open: registered < capacity };
}

export async function allowedEntries(profile: typeof professionalProfiles.$inferSelect): Promise<{ allowed: PaidEntryType[]; reason?: "paused" | "slot" | "full" | "next_full"; bypass?: boolean }> {
  const state = await getEntryState();
  if (state === "FIRST_IN_CLOSED") return { allowed: [], reason: "paused" };
  const next: PaidEntryType[] = ["DFW_NEXT"]; // DFW after First In: $17
  const { isCapExempt, slotStatus } = await import("./slots");
  if (await isCapExempt(profile)) return { allowed: state === "FIRST_IN_OPEN" ? ["FIRST_IN"] : next };
  const slot = await slotStatus(profile);
  if (!slot) return { allowed: [], reason: "slot" };
  // Houston and every market after DFW: one rate, $20 — the 10 spots per city and category still apply.
  const { marketOfCity } = await import("./city-booking");
  if ((await marketOfCity(slot.cityId)) !== "DFW") return slot.tier === "full" ? { allowed: [], reason: "full" } : { allowed: ["MARKET"] };
  if (slot.tier === "first_in" && state === "FIRST_IN_OPEN" && (await firstInStats()).open) return { allowed: ["FIRST_IN"] };
  // DFW after First In ($17), or skipping the waitlist in a full city — only while the next 750 has room.
  if (!(await nextEntryStats()).open) return { allowed: [], reason: slot.tier === "full" ? "full" : "next_full" };
  if (slot.tier === "full") return { allowed: next, reason: "full", bypass: true };
  return { allowed: next };
}

export async function startEntryCheckout(user: typeof users.$inferSelect, choice: EntryChoice, base: string): Promise<{ url: string } | { error: string }> {
  const profile = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, user.id) });
  if (!profile) return { error: "Finish creating your account first." };
  if (profile.entryPaidAt) return { error: "You've already joined Nearest." };
  const { allowed, reason, bypass } = await allowedEntries(profile);
  if (!allowed.includes(choice.type)) {
    return { error: reason === "paused" ? "New professional enrollment is paused right now."
      : reason === "slot" ? "Choose your city and main category first."
      : reason === "full" ? "Your city and category is full right now. Join the waitlist and we'll invite you when a spot opens."
      : reason === "next_full" ? "The next 750 spots are taken right now. Join the waitlist and we'll invite you when spots open."
      : "That option isn't available right now." };
  }
  // Skipping the waitlist in a full city: remember it so setup lets them list there.
  if (bypass && !profile.slotBypass) await db.update(professionalProfiles).set({ slotBypass: true }).where(eq(professionalProfiles.userId, user.id));

  // First In: hold a seat (reuse an unexpired hold if they come back)
  const heldAlready = profile.entryType === "FIRST_IN" && profile.entryHoldUntil && profile.entryHoldUntil > new Date();
  if (choice.type === "FIRST_IN" && !heldAlready) {
    if (profile.entryType === "FIRST_IN") await releaseExpiredHolds();
    if (!(await takeSeat())) return { error: "Every First In spot is taken or being paid for right now. If someone doesn't finish, a spot opens within 35 minutes." };
  }

  // Professional + Student: save the student they're registering
  let linkId: string | null = null;
  if (choice.type === "PRO_STUDENT") {
    const st = choice.student!;
    await db.delete(proStudentLinks).where(and(eq(proStudentLinks.proId, user.id), eq(proStudentLinks.status, "pending")));
    const [link] = await db.insert(proStudentLinks).values({ proId: user.id, firstName: st.firstName, lastName: st.lastName, email: st.email.toLowerCase(), school: st.school ?? null }).returning();
    linkId = link.id;
  }

  try {
    // City not open for booking yet: save the card now (no charge) — the membership starts the day the city opens.
    const { cityBookingOpen, proCityId } = await import("./city-booking");
    if (!(await cityBookingOpen(proCityId(profile)))) {
      let customer = profile.stripeCustomerId;
      if (!customer) {
        const c = await stripe().customers.create({ email: user.email ?? undefined, name: [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined, metadata: { userId: user.id } });
        customer = c.id;
        await db.update(professionalProfiles).set({ stripeCustomerId: customer }).where(eq(professionalProfiles.userId, user.id));
      }
      const session = await stripe().checkout.sessions.create({
        mode: "setup", currency: "usd", customer,
        client_reference_id: user.id,
        setup_intent_data: { metadata: { userId: user.id, kind: "entry" } },
        metadata: { userId: user.id, kind: "entry", entryType: choice.type, saveCard: "1", ...(linkId ? { studentLinkId: linkId } : {}) },
        expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_MIN * 60,
        success_url: `${base}/pro/join?session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/pro/join`,
      });
      await db.update(professionalProfiles).set({
        entryType: choice.type, monthlyRateCents: ENTRY[choice.type].cents, entryCheckoutId: session.id,
        entryHoldUntil: choice.type === "FIRST_IN" ? (heldAlready ? profile.entryHoldUntil : new Date(Date.now() + HOLD_MIN * 60000)) : null,
      }).where(eq(professionalProfiles.userId, user.id));
      return { url: session.url! };
    }

    const price = await priceFor(choice.type);
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      ...(profile.stripeCustomerId ? { customer: profile.stripeCustomerId } : { customer_email: user.email ?? undefined }),
      client_reference_id: user.id,
      subscription_data: { metadata: { userId: user.id, entryType: choice.type } }, // no trial — first month is paid now
      metadata: { userId: user.id, kind: "entry", entryType: choice.type, ...(linkId ? { studentLinkId: linkId } : {}) },
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_MIN * 60,
      success_url: `${base}/pro/join?session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pro/join`,
    });
    await db.update(professionalProfiles).set({
      entryType: choice.type, monthlyRateCents: ENTRY[choice.type].cents, entryCheckoutId: session.id,
      entryHoldUntil: choice.type === "FIRST_IN" ? (heldAlready ? profile.entryHoldUntil : new Date(Date.now() + HOLD_MIN * 60000)) : null,
    }).where(eq(professionalProfiles.userId, user.id));
    return { url: session.url! };
  } catch (e) {
    if (choice.type === "FIRST_IN" && !heldAlready) await giveBackSeat();
    return { error: `Payment couldn't start: ${(e as Error).message}` };
  }
}

/**
 * Called when payment succeeds (return page and webhook both call this; it only acts once).
 * Locks the entry type and rate, counts them toward First In, and closes First In at the limit.
 */
export async function finalizeEntry(sessionOrId: string | Stripe.Checkout.Session) {
  const session = typeof sessionOrId === "string" ? await stripe().checkout.sessions.retrieve(sessionOrId, { expand: ["subscription"] }) : sessionOrId;
  if (session.metadata?.kind !== "entry") return { done: false };
  const userId = session.metadata.userId;
  const type = session.metadata.entryType;
  if (!userId || !isEntryType(type)) return { done: false };
  if (session.status !== "complete" || !["paid", "no_payment_required"].includes(session.payment_status ?? "")) return { done: false };

  const [row] = await db.update(professionalProfiles)
    .set({ entryType: type, monthlyRateCents: ENTRY[type].cents, entryPaidAt: new Date(), entryHoldUntil: null, cohort: type === "FIRST_IN" ? "FOUNDING" : "SECOND" })
    .where(and(eq(professionalProfiles.userId, userId), isNull(professionalProfiles.entryPaidAt)))
    .returning();
  if (!row) return { done: true, already: true }; // already finalized

  // Card saved (city not open yet): make it the default card for the membership that starts when the city opens.
  if (session.mode === "setup" && session.setup_intent) {
    try {
      const si = typeof session.setup_intent === "string" ? await stripe().setupIntents.retrieve(session.setup_intent) : session.setup_intent;
      const pm = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id;
      const cust = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (pm && cust) await stripe().customers.update(cust, { invoice_settings: { default_payment_method: pm } });
      await db.update(professionalProfiles).set({ cardSavedAt: new Date() }).where(eq(professionalProfiles.userId, userId));
    } catch (e) { console.error("save card", e); }
  }
  const sub = typeof session.subscription === "string" ? await stripe().subscriptions.retrieve(session.subscription) : session.subscription;
  if (sub) await saveSubscription(userId, sub);
  if (session.customer) await db.update(professionalProfiles).set({ stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer.id }).where(eq(professionalProfiles.userId, userId));

  if (type === "PRO_STUDENT" && session.metadata.studentLinkId) {
    const [link] = await db.update(proStudentLinks).set({ status: "invited" }).where(eq(proStudentLinks.id, session.metadata.studentLinkId)).returning();
    if (link) {
      try {
        const { sendEmail } = await import("./email");
        const pro = await db.query.users.findFirst({ where: eq(users.id, userId) });
        await sendEmail({
          to: link.email, subject: `${pro?.firstName ?? "A professional"} registered you on Nearest`,
          heading: `${link.firstName}, you're invited to Nearest.`,
          lines: [`${pro?.firstName ?? "A beauty professional"} added you as their student on Nearest — where verified students book trusted beauty professionals near them.`, "Create your account and verify your school to start booking."],
          button: { label: "Create my account", url: `${process.env.APP_URL || "https://usenearest.com"}/sign-up` },
        });
      } catch (e) { console.error("Student invite email failed", e); }
    }
  }

  await logActivity({ actorUserId: userId, action: "entry.paid", targetType: "professional", targetId: userId, after: { type, cents: ENTRY[type].cents } });

  // First In closes automatically when the last seat is paid.
  if (type === "FIRST_IN") {
    const stats = await firstInStats();
    if (stats.registered >= stats.capacity && (await getEntryState()) === "FIRST_IN_OPEN") await setEntryState("FIRST_IN_CLOSED", null);
  }
  return { done: true };
}

/** When a student signs up with the email a professional registered, link them. */
export async function linkRegisteredStudent(studentUserId: string, email: string | null | undefined) {
  if (!email) return;
  await db.update(proStudentLinks).set({ status: "joined", studentUserId })
    .where(and(eq(proStudentLinks.email, email.toLowerCase()), isNull(proStudentLinks.studentUserId), eq(proStudentLinks.status, "invited")));
}

/** Has this professional paid their entry? (Older accounts with a live membership count as paid.) */
export const hasPaidEntry = (p: typeof professionalProfiles.$inferSelect) =>
  Boolean(p.entryPaidAt) || ["active", "trialing", "past_due"].includes(p.subscriptionStatus ?? "");

/** Nearest owners (Avy, Kisses, Kee) run their own businesses on Nearest free — no entry payment, no membership. */
export async function isOwnerBusiness(userId: string) {
  const { adminMembers } = await import("@/db");
  const row = await db.query.adminMembers.findFirst({ where: and(eq(adminMembers.userId, userId), eq(adminMembers.role, "OWNER"), eq(adminMembers.active, true)) });
  return Boolean(row);
}
