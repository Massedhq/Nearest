import "server-only";
import { randomInt } from "crypto";
import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db, credits, nearestCardBatches, nearestCards, nearestCardAttempts } from "@/db";
import { MAX_PRICE_CENTS } from "./pricing";
import { chicagoToUtc } from "./time";

/**
 * Nearest Cards — printed promotional cards (no cash value) that students add to their account.
 * Discount cards: 16-digit number + 3-digit code, worth $10–$30. Free cards: 16-digit number + 4-digit code, cover a
 * service up to the batch amount. Adding a card creates general Nearest credit, which checkout applies automatically,
 * so a lost card can't be used by anyone else once it's on an account.
 */
export const CARD_LIMITS = {
  discountMin: 1000, discountMax: 3000, // $10–$30
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
const newCode = (kind: CardKind) => String(randomInt(0, kind === "free" ? 10000 : 1000)).padStart(kind === "free" ? 4 : 3, "0");

/** Check a batch request; returns a plain-words problem or null. */
export function batchProblem(b: { kind: string; amountCents: number; count: number; validThru: Date | null }) {
  if (b.kind !== "discount" && b.kind !== "free") return "Choose Discount card or Free card.";
  if (!Number.isInteger(b.amountCents)) return "Enter the card value.";
  if (b.kind === "discount" && (b.amountCents < CARD_LIMITS.discountMin || b.amountCents > CARD_LIMITS.discountMax)) return "Discount cards are $10 to $30.";
  if (b.kind === "free" && (b.amountCents < 100 || b.amountCents > CARD_LIMITS.freeMax)) return `A free card covers a service up to an amount from $1 to $${CARD_LIMITS.freeMax / 100}.`;
  if (!Number.isInteger(b.count) || b.count < 1 || b.count > CARD_LIMITS.batchMax) return `Make 1 to ${CARD_LIMITS.batchMax} cards at a time.`;
  if (!b.validThru) return "Choose the Valid thru month printed on the cards.";
  if (b.validThru.getTime() < Date.now()) return "Valid thru must be a future month.";
  return null;
}

/** Create a batch and its cards (random numbers, all unique). */
export async function createCardBatch(input: { name: string; kind: CardKind; amountCents: number; count: number; validThru: Date; by: string }) {
  const [batch] = await db.insert(nearestCardBatches).values({ name: input.name, kind: input.kind, amountCents: input.amountCents, count: input.count, validThru: input.validThru, createdBy: input.by }).returning();
  let made = 0;
  while (made < input.count) {
    const want = Math.min(500, input.count - made);
    const rows = Array.from({ length: want }, () => ({ batchId: batch.id, number: newNumber(), code: newCode(input.kind) }));
    const inserted = await db.insert(nearestCards).values(rows).onConflictDoNothing().returning({ id: nearestCards.id });
    made += inserted.length; // a rare duplicate number is skipped and made again on the next pass
  }
  return batch;
}

export type AddResult = { ok: true; amountCents: number; kind: CardKind; last4: string } | { ok: false; error: string };
const WRONG = "That card number and code don't match. Check both and try again — the code is the 3 or 4 digits on the back.";

/** A student adds a card to their account: checks everything, then turns it into general Nearest credit (once). */
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
  if (c.status === "activated") return c.studentId === userId ? { ok: false, error: "This card is already on your account — its value is in My credits." } : { ok: false, error: "This card was already added to another account. Each card works once." };
  if (c.status === "locked") return { ok: false, error: "This card is locked for security. Email support@usenearest.com and we'll help." };
  if (c.code !== code) { await miss(c.id); return { ok: false, error: WRONG }; }
  if (c.status === "off" || b.status === "off") return { ok: false, error: "This card has been turned off. Email support@usenearest.com if you think that's a mistake." };
  if (b.validThru.getTime() < Date.now()) return { ok: false, error: `This card expired (valid thru ${validThruLabel(b.validThru)}).` };
  const same = await db.query.nearestCards.findFirst({ where: and(eq(nearestCards.batchId, b.id), eq(nearestCards.studentId, userId)) });
  if (same) return { ok: false, error: "You've already added a card from this same group. It's one card per student." };
  // Claim it atomically so two people can never add the same card.
  const [claimed] = await db.update(nearestCards).set({ status: "activated", studentId: userId, activatedAt: new Date() })
    .where(and(eq(nearestCards.id, c.id), eq(nearestCards.status, "issued"))).returning();
  if (!claimed) return { ok: false, error: "This card was already added to another account. Each card works once." };
  const label = cardLabel(b.kind);
  const [cr] = await db.insert(credits).values({ studentId: userId, proId: null, amountCents: b.amountCents, reason: `${label} •••• ${last4(number)} added` }).returning();
  await db.update(nearestCards).set({ creditId: cr.id }).where(eq(nearestCards.id, c.id));
  await db.insert(nearestCardAttempts).values({ userId, last4: last4(number), ok: true });
  return { ok: true, amountCents: b.amountCents, kind: b.kind as CardKind, last4: last4(number) };
}

/** After a booking is paid: note which of the student's added cards paid toward it (oldest first), so the pro sees it. */
export async function linkCardsToBooking(b: { id: string; studentId: string; creditGeneralCents: number }) {
  if (!b.creditGeneralCents) return [];
  const mine = await db.select({ c: nearestCards, amount: nearestCardBatches.amountCents }).from(nearestCards).innerJoin(nearestCardBatches, eq(nearestCardBatches.id, nearestCards.batchId))
    .where(and(eq(nearestCards.studentId, b.studentId), eq(nearestCards.status, "activated"), isNull(nearestCards.usedBookingId))).orderBy(asc(nearestCards.activatedAt));
  const ids: string[] = [];
  let covered = 0;
  for (const { c, amount } of mine) {
    if (covered >= b.creditGeneralCents) break;
    ids.push(c.id);
    covered += amount;
  }
  if (ids.length) await db.update(nearestCards).set({ usedBookingId: b.id }).where(and(inArray(nearestCards.id, ids), isNull(nearestCards.usedBookingId)));
  return ids;
}

/** Cards that paid toward a booking (for the professional's appointment page). */
export async function cardsForBooking(bookingId: string) {
  return db.select({ kind: nearestCardBatches.kind, amountCents: nearestCardBatches.amountCents }).from(nearestCards)
    .innerJoin(nearestCardBatches, eq(nearestCardBatches.id, nearestCards.batchId)).where(eq(nearestCards.usedBookingId, bookingId));
}

/** A student's added cards, newest first. */
export async function myCards(userId: string) {
  return db.select({ c: nearestCards, b: nearestCardBatches }).from(nearestCards).innerJoin(nearestCardBatches, eq(nearestCardBatches.id, nearestCards.batchId))
    .where(eq(nearestCards.studentId, userId)).orderBy(desc(nearestCards.activatedAt));
}
