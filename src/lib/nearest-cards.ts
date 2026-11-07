import "server-only";
import { randomInt } from "crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, credits, nearestCardBatches, nearestCards, nearestCardAttempts } from "@/db";
import { MAX_PRICE_CENTS } from "./pricing";
import { chicagoToUtc } from "./time";

/**
 * Nearest Cards — printed promotional cards (no cash value) that students add to their account.
 * Discount cards: 16-digit number + 3-digit code, worth $5–$30. Free cards: 16-digit number + 4-digit code, cover a
 * service up to the batch amount. A card must be saved within cards.activate_days (30) of the batch's handed_out_at, or it
 * goes inactive. Owners can turn cards off and discard batches (src/app/admin/card-actions.ts). Adding a card SAVES it on the student's account (so a lost card can't be used by anyone
 * else). It is never applied automatically: the student chooses it on the booking they want (confirm page or a booking
 * waiting for payment). One card = one booking. Its value is written into the booking's credit_general_cents (and
 * promo_cents) and confirmBooking adds it as PROMOTIONAL credit first. Since 2026-11-04 cards are honored by the
 * professional (it comes out of that booking's payout), cover the SERVICE only (the student still pays the booking fee
 * and deposit), work only with professionals who accepted those Terms, and a Free Card only on the professional's one
 * free service — see src/lib/promo.ts. Credit only, no cash value.
 */
export const CARD_LIMITS = {
  discountMin: 500, discountMax: 3000, // $5–$30
  freeMax: MAX_PRICE_CENTS, // a free card never covers more than the $150 student price cap
  batchMax: 5000,
  triesPerHour: 5, // wrong number/code tries per student per hour
  lockAfter: 10, // wrong codes on one card number → card locked until an owner unlocks it
  prefix: "8877", // every card number starts like the printed design
};

export type CardKind = "discount" | "free";
export const cardLabel = (kind: string) => (kind === "free" ? "Nearest Free Card" : "Nearest Card");
export const digits = (s: string) => String(s ?? "").replace(/\D/g, "");
export const last4 = (n: string) => n.slice(-4);
export const groupNumber = (n: string) => n.replace(/(\d{4})(?=\d)/g, "$1 ");
export const validThruLabel = (d: Date) => d.toLocaleDateString("en-US", { month: "2-digit", year: "2-digit", timeZone: "America/Chicago" });

/** "2030-12" → the last minute of December 2030, Central time. */
export function endOfMonth(ym: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return new Date(chicagoToUtc(`${m[1]}-${m[2]}-${String(lastDay).padStart(2, "0")}`, "23:59").getTime() + 59000);
}

function newNumber() {
  let s = CARD_LIMITS.prefix;
  while (s.length < 16) s += String(randomInt(0, 10));
  return s;
}
/** Codes never start with 0: a free card is always 4 digits (1000–9999) and a discount card always 3 (100–999), even in a spreadsheet. */
const newCode = (kind: CardKind) => String(kind === "free" ? randomInt(1000, 10000) : randomInt(100, 1000));

/** Days a student has to save a card after the batch is handed out (Rules & Settings → cards.activate_days, default 30). */
export async function activateDays() {
  const { getSettings } = await import("./settings");
  const d = Number((await getSettings())["cards.activate_days"] ?? 30);
  return Number.isFinite(d) && d >= 1 ? Math.floor(d) : 30;
}

/** "2026-11-04" → that day at 12:00 AM Central. */
export function startOfDay(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = chicagoToUtc(ymd, "00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The last moment a card from this batch can be saved to an account: handed out + N days (or the Valid thru date, if sooner). */
export function activateBy(b: { handedOutAt: Date | null; createdAt: Date; validThru: Date }, days: number) {
  const from = b.handedOutAt ?? b.createdAt;
  const by = new Date(from.getTime() + days * 86400000);
  return by < b.validThru ? by : b.validThru;
}

/** Most Nearest Cards that can ever be made (Rules & Settings → cards.max_total, default 3,000). */
export async function maxCards() {
  const { getSettings } = await import("./settings");
  const n = Number((await getSettings())["cards.max_total"] ?? 3000);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 3000;
}

/** Cards toward the limit: every card in a batch that isn't discarded, plus discarded cards a student had already saved. */
export async function cardTotals() {
  const r = (await db.execute(sql`select
      (select count(*)::int from nearest_cards c join nearest_card_batches b on b.id = c.batch_id where b.status <> 'discarded' or c.status = 'activated' or c.credit_id is not null) as made,
      (select count(*)::int from nearest_cards where student_id is not null and status = 'activated') as activated`)).rows[0] as { made: number; activated: number };
  const max = await maxCards();
  return { max, made: r.made, activated: r.activated, canMake: Math.max(0, max - r.made), leftToActivate: Math.max(0, max - r.activated) };
}

/** Number older cards in printer-file order (#1, #2…) so a stack of cards can be assigned to a place by its # range. */
export async function ensurePrintSeq() {
  await fixLeadingZeroCodes();
  await db.execute(sql`update nearest_cards c set print_seq = r.rn from (
      select id, (coalesce((select max(x.print_seq) from nearest_cards x where x.batch_id = n.batch_id), 0) + row_number() over (partition by batch_id order by created_at, ctid))::int as rn
      from nearest_cards n where print_seq is null) r where c.id = r.id`);
}

/**
 * One-time repair (2026-11-07): cards made before the fix could get a code starting with 0 ("0482"), which a spreadsheet
 * shows as "482" — so a free card looked like a 3-digit discount card. Every card no student has saved yet gets a new code
 * in the right range (free 1000–9999, discount 100–999). Saved cards are never changed. Logged once per repair.
 */
export async function fixLeadingZeroCodes() {
  const r = await db.execute(sql`update nearest_cards c set code = case when b.kind = 'free'
      then (1000 + floor(random() * 9000))::int::text else (100 + floor(random() * 900))::int::text end
    from nearest_card_batches b
    where b.id = c.batch_id and c.code like '0%' and c.student_id is null and c.used_booking_id is null
      and c.status in ('issued', 'off', 'locked')
    returning c.id, b.id as "batchId"`);
  const rows = r.rows as { id: string; batchId: string }[];
  if (!rows.length) return 0;
  const { logActivity } = await import("./log");
  const byBatch: Record<string, number> = {};
  for (const x of rows) byBatch[x.batchId] = (byBatch[x.batchId] ?? 0) + 1;
  await logActivity({ actorUserId: null, action: "cards.codes_fixed", targetType: "nearest_card_batch", after: { cards: rows.length, byBatch, reason: "code started with 0" } }).catch(() => {});
  return rows.length;
}

/** Check a batch request; returns a plain-words problem or null. */
export function batchProblem(b: { kind: string; amountCents: number; count: number; validThru: Date | null }) {
  if (b.kind !== "discount" && b.kind !== "free") return "Choose Discount card or Free card.";
  if (!Number.isInteger(b.amountCents)) return "Enter the card value.";
  if (b.kind === "discount" && (b.amountCents < CARD_LIMITS.discountMin || b.amountCents > CARD_LIMITS.discountMax)) return "Discount cards are $5 to $30.";
  if (b.kind === "free" && (b.amountCents < 100 || b.amountCents > CARD_LIMITS.freeMax)) return `A free card covers a service up to an amount from $1 to $${CARD_LIMITS.freeMax / 100}.`;
  if (!Number.isInteger(b.count) || b.count < 1 || b.count > CARD_LIMITS.batchMax) return `Make 1 to ${CARD_LIMITS.batchMax} cards at a time.`;
  if (!b.validThru) return "Choose the Valid thru month printed on the cards.";
  if (b.validThru.getTime() < Date.now()) return "Valid thru must be a future month.";
  return null;
}

/** Create a batch and its cards (random numbers, all unique). */
export async function createCardBatch(input: { name: string; kind: CardKind; amountCents: number; count: number; validThru: Date; handedOutAt?: Date | null; by: string }) {
  const [batch] = await db.insert(nearestCardBatches).values({ name: input.name, kind: input.kind, amountCents: input.amountCents, count: input.count, validThru: input.validThru, handedOutAt: input.handedOutAt ?? new Date(), createdBy: input.by }).returning();
  let made = 0;
  while (made < input.count) {
    const want = Math.min(500, input.count - made);
    const start = made;
    const rows = Array.from({ length: want }, (_, i) => ({ batchId: batch.id, number: newNumber(), code: newCode(input.kind), printSeq: start + i + 1 }));
    const inserted = await db.insert(nearestCards).values(rows).onConflictDoNothing().returning({ id: nearestCards.id });
    made += inserted.length; // a rare duplicate number is skipped and made again on the next pass
  }
  return batch;
}

export type AddResult = { ok: true; amountCents: number; kind: CardKind; last4: string; id: string } | { ok: false; error: string };
const WRONG = "That card number and code don't match. Check both and try again — the code is the 3 or 4 digits on the back.";

/** A student adds a card to their account: checks everything, then saves it there (no credit yet — they choose a booking). */
export async function addCardToAccount(userId: string, rawNumber: string, rawCode: string): Promise<AddResult> {
  const number = digits(rawNumber), code = digits(rawCode);
  const hourAgo = new Date(Date.now() - 3600000);
  const [{ n: misses }] = await db.select({ n: sql<number>`count(*)::int` }).from(nearestCardAttempts)
    .where(and(eq(nearestCardAttempts.userId, userId), eq(nearestCardAttempts.ok, false), gte(nearestCardAttempts.createdAt, hourAgo)));
  if (misses >= CARD_LIMITS.triesPerHour) return { ok: false, error: "Too many tries. For your security, try again in an hour." };
  const miss = async (cardId?: string) => {
    await db.insert(nearestCardAttempts).values({ userId, last4: number.slice(-4) || null, ok: false });
    if (cardId) {
      await db.update(nearestCards).set({ failedAttempts: sql`${nearestCards.failedAttempts} + 1` }).where(eq(nearestCards.id, cardId));
      await db.update(nearestCards).set({ status: "locked" }).where(and(eq(nearestCards.id, cardId), eq(nearestCards.status, "issued"), gte(nearestCards.failedAttempts, CARD_LIMITS.lockAfter)));
    }
  };
  if (number.length !== 16) { await miss(); return { ok: false, error: "Enter all 16 digits from the front of the card." }; }
  if (code.length !== 3 && code.length !== 4) { await miss(); return { ok: false, error: "Enter the 3 or 4 digit code from the back of the card." }; }
  const row = (await db.select({ c: nearestCards, b: nearestCardBatches }).from(nearestCards).innerJoin(nearestCardBatches, eq(nearestCardBatches.id, nearestCards.batchId)).where(eq(nearestCards.number, number)).limit(1))[0];
  if (!row) { await miss(); return { ok: false, error: WRONG }; }
  const { c, b } = row;
  if (c.status === "activated") return c.studentId === userId ? { ok: false, error: "This card is already saved on your account — choose it when you pay for a booking." } : { ok: false, error: "This card was already added to another account. Each card works once." };
  if (c.status === "locked") return { ok: false, error: "This card is locked for security. Email support@usenearest.com and we'll help." };
  if (c.code !== code) { await miss(c.id); return { ok: false, error: WRONG }; }
  if (c.status === "discarded" || b.status === "discarded") return { ok: false, error: "This card is no longer good. Email support@usenearest.com if you think that's a mistake." };
  if (c.status === "off" || b.status === "off") return { ok: false, error: "This card has been turned off. Email support@usenearest.com if you think that's a mistake." };
  if (b.validThru.getTime() < Date.now()) return { ok: false, error: `This card expired (valid thru ${validThruLabel(b.validThru)}).` };
  const days = await activateDays();
  if (activateBy(b, days).getTime() < Date.now()) return { ok: false, error: `This card is no longer good — cards must be saved to an account within ${days} days of being handed out.` };
  // One Nearest Card per student, ever (a card an owner turned off or discarded doesn't count).
  const mine = await db.query.nearestCards.findFirst({ where: and(eq(nearestCards.studentId, userId), eq(nearestCards.status, "activated")) });
  if (mine) return { ok: false, error: "You already have a Nearest Card on your account. It's one card per student." };
  // Claim it atomically so two people can never add the same card.
  const [claimed] = await db.update(nearestCards).set({ status: "activated", studentId: userId, activatedAt: new Date() })
    .where(and(eq(nearestCards.id, c.id), eq(nearestCards.status, "issued"))).returning();
  if (!claimed) return { ok: false, error: "This card was already added to another account. Each card works once." };
  await db.insert(nearestCardAttempts).values({ userId, last4: last4(number), ok: true });
  return { ok: true, amountCents: b.amountCents, kind: b.kind as CardKind, last4: last4(number), id: c.id };
}

// A card is FREE when it isn't tied to a booking, or its booking ended without being paid (expired, declined, cancelled
// before payment). It's SAVED while its booking is a request or waiting for payment, and USED once that booking is paid.
export const FREE_SQL = sql`(${nearestCards.usedBookingId} is null or not exists (select 1 from bookings bk where bk.id = ${nearestCards.usedBookingId} and (bk.paid_at is not null or bk.status in ('requested','pending_payment'))))`;

export type CardState = "ready" | "saved" | "used";

/** A student's added cards, newest first, with whether each is ready, saved for a booking or used. */
export async function myCards(userId: string) {
  const rows = await db.select({
    c: nearestCards, b: nearestCardBatches,
    bStatus: sql<string | null>`(select bk.status::text from bookings bk where bk.id = ${nearestCards.usedBookingId})`,
    bPaid: sql<boolean>`coalesce((select bk.paid_at is not null from bookings bk where bk.id = ${nearestCards.usedBookingId}), false)`,
  }).from(nearestCards).innerJoin(nearestCardBatches, eq(nearestCardBatches.id, nearestCards.batchId))
    .where(and(eq(nearestCards.studentId, userId), eq(nearestCards.status, "activated"))).orderBy(desc(nearestCards.activatedAt));
  return rows.map((r) => {
    const state: CardState = !r.c.usedBookingId ? "ready" : r.bPaid ? "used" : r.bStatus === "requested" || r.bStatus === "pending_payment" ? "saved" : "ready";
    return { ...r, state, bookingId: state === "ready" ? null : r.c.usedBookingId };
  });
}

/** Cards the student can choose for a booking right now (plus the one already on this booking, if any). */
export async function usableCards(userId: string, bookingId?: string) {
  return (await myCards(userId)).filter((x) => x.state === "ready" || (bookingId && x.bookingId === bookingId));
}

/**
 * How a booking's total is paid when the student chose a card: card first, then promotional credit, then credit with the
 * pro, then general credit. The card and promotional credit together never go past `cap` — the service only (promoCap in
 * src/lib/promo.ts), so the student always pays the booking fee and deposit.
 */
export function planWithCard(due: number, bal: { pro: number; general: number; promo?: number }, cardAmount: number, cap: number = due) {
  const limit = Math.max(0, Math.min(cap, due));
  let card = Math.min(Math.max(cardAmount, 0), limit);
  let promo = Math.min(Math.max(bal.promo ?? 0, 0), limit - card);
  let pro = Math.min(bal.pro, due - card - promo);
  let general = Math.min(bal.general, due - card - promo - pro);
  let charge = due - card - promo - pro - general;
  if (charge > 0 && charge < 50) {
    // Card payments have a $0.50 minimum: give back a little credit (then promo, then card value) so the charge is $0.50.
    let giveBack = 50 - charge;
    const g = Math.min(general, giveBack); general -= g; giveBack -= g;
    const p = Math.min(pro, giveBack); pro -= p; giveBack -= p;
    const pr = Math.min(promo, giveBack); promo -= pr; giveBack -= pr;
    card -= Math.min(card, giveBack);
    charge = due - card - promo - pro - general;
  }
  // general includes the card and promotional credit (see the header note); promoCents is the professional-honored part.
  return { card, promo, pro, general: general + card + promo, charge, promoCents: card + promo };
}

/**
 * Put a card on a booking (or take it off with cardId null). Reserves the card atomically so it can't be on two
 * bookings. Returns the card's amount (0 when none) or an error.
 */
export async function setBookingCard(userId: string, bookingId: string, cardId: string | null): Promise<{ ok: true; amountCents: number; kind?: CardKind; last4?: string } | { ok: false; error: string }> {
  // Release whatever card this booking held.
  await db.update(nearestCards).set({ usedBookingId: null }).where(and(eq(nearestCards.usedBookingId, bookingId), eq(nearestCards.studentId, userId)));
  if (!cardId) return { ok: true, amountCents: 0 };
  const [card] = await db.update(nearestCards).set({ usedBookingId: bookingId })
    .where(and(eq(nearestCards.id, cardId), eq(nearestCards.studentId, userId), eq(nearestCards.status, "activated"), FREE_SQL)).returning();
  if (!card) return { ok: false, error: "That card is already being used on another booking, or isn't on your account." };
  const batch = (await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.id, card.batchId) }))!;
  return { ok: true, amountCents: batch.amountCents, kind: batch.kind as CardKind, last4: last4(card.number) };
}

/** On confirm: the chosen card's value becomes credit right before the booking uses it (net zero, keeps the books straight). */
export async function creditCardForBooking(b: { id: string; studentId: string; cardId: string | null; cardCents: number }, code: string) {
  if (!b.cardId || b.cardCents <= 0) return;
  const card = await db.query.nearestCards.findFirst({ where: eq(nearestCards.id, b.cardId) });
  const batch = card ? await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.id, card.batchId) }) : null;
  const [cr] = await db.insert(credits).values({ studentId: b.studentId, proId: null, promo: true, amountCents: b.cardCents, reason: `${cardLabel(batch?.kind ?? "discount")} •••• ${card ? last4(card.number) : ""} used on ${code}`, bookingId: b.id }).returning();
  if (card) await db.update(nearestCards).set({ creditId: cr.id, usedBookingId: b.id }).where(eq(nearestCards.id, card.id));
}

/** The card a booking used (for the professional's appointment page). */
export async function cardForBooking(b: { cardId: string | null; cardCents: number }) {
  if (!b.cardId || b.cardCents <= 0) return null;
  const row = (await db.select({ kind: nearestCardBatches.kind }).from(nearestCards).innerJoin(nearestCardBatches, eq(nearestCardBatches.id, nearestCards.batchId)).where(eq(nearestCards.id, b.cardId)).limit(1))[0];
  return row ? { kind: row.kind, amountCents: b.cardCents } : null;
}

/** The full value of the card a booking holds (0 if none, or if the card is no longer tied to that booking). */
export async function cardAmount(cardId: string | null, bookingId: string) {
  if (!cardId) return 0;
  const row = (await db.select({ amount: nearestCardBatches.amountCents }).from(nearestCards).innerJoin(nearestCardBatches, eq(nearestCardBatches.id, nearestCards.batchId))
    .where(and(eq(nearestCards.id, cardId), eq(nearestCards.usedBookingId, bookingId))).limit(1))[0];
  return row?.amount ?? 0;
}

/**
 * The Nearest Cards fund: how much has been set aside from booking fees, how much cards have used, and what's left to
 * give back. Adds any completed bookings not counted yet (past ones too), each at the current setting, capped at that
 * booking's own fee. Bookings with no fee (campaign rewards, legacy prices) add nothing.
 */
export async function cardFund() {
  const { getSettings } = await import("./settings");
  const per = Math.max(0, Number((await getSettings())["cards.fund_per_booking_cents"] ?? 500));
  if (per > 0) {
    await db.execute(sql`insert into nearest_card_fund (booking_id, amount_cents, created_at)
      select b.id, least(b.service_fee_cents, ${per}), coalesce(b.released_at, now()) from bookings b
      where b.status = 'completed' and b.service_fee_cents > 0
        and not exists (select 1 from nearest_card_fund f where f.booking_id = b.id)
      on conflict do nothing`);
  }
  const r = (await db.execute(sql`select
      (select coalesce(sum(amount_cents), 0)::int from nearest_card_fund) as added,
      (select count(*)::int from nearest_card_fund) as bookings,
      (select coalesce(sum(card_cents), 0)::int from bookings where card_id is not null and paid_at is not null) as used,
      (select coalesce(sum(nb.amount_cents), 0)::int from nearest_cards c join nearest_card_batches nb on nb.id = c.batch_id where c.status = 'activated' and c.credit_id is null) as saved,
      (select coalesce(sum(nb.amount_cents), 0)::int from nearest_cards c join nearest_card_batches nb on nb.id = c.batch_id where c.status = 'issued' and nb.status = 'active' and nb.valid_thru > now()
        and coalesce(nb.handed_out_at, nb.created_at) + make_interval(days => ${await activateDays()}) > now()) as unclaimed`)).rows[0] as { added: number; bookings: number; used: number; saved: number; unclaimed: number };
  return { perBooking: per, ...r, available: r.added - r.used };
}
