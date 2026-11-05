import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, cardPlaces, cities, nearestCards, nearestCardBatches } from "@/db";
import { activateDays, activateBy, digits } from "./nearest-cards";

/**
 * Card places: where Nearest gives out Nearest Cards (youth programs, community centers, churches, charities, shelters…).
 * Any owner adds places and assigns cards to them — a stack by its # range from the batch's printer file, or exact card
 * numbers. Only the main owner makes batches (src/app/admin/card-actions.ts). Students see places that still have cards
 * (assigned cards not yet saved to an account and still able to be saved). Nobody meets students to hand out cards.
 */
export const PLACE_KINDS: Record<string, string> = {
  youth_program: "Youth program",
  community_center: "Community center",
  church: "Church",
  charity: "Charity",
  shelter: "Shelter",
  other: "Other",
};

/** A card can still be handed to a student: not saved, not turned off/discarded/locked, batch on, and still inside its save window. */
async function stillGoodSql() {
  const days = await activateDays();
  return sql`c.status = 'issued' and b.status = 'active' and b.valid_thru > now()
    and coalesce(b.handed_out_at, b.created_at) + make_interval(days => ${days}) > now()`;
}

/** Every place with its counts: cards assigned, saved by students (activated), and still good to give out. */
export async function placesWithCounts(opts: { activeOnly?: boolean } = {}) {
  const good = await stillGoodSql();
  const rows = (await db.execute(sql`
    select p.id, p.name, p.kind, p.address, p.notes, p.active, p.city_id as "cityId", ci.name as city, p.created_at as "createdAt",
      count(c.id)::int as assigned,
      count(c.id) filter (where c.status = 'activated')::int as activated,
      count(c.id) filter (where ${good})::int as "left"
    from card_places p
    left join cities ci on ci.id = p.city_id
    left join nearest_cards c on c.place_id = p.id
    left join nearest_card_batches b on b.id = c.batch_id
    ${opts.activeOnly ? sql`where p.active` : sql``}
    group by p.id, ci.name
    order by ci.name nulls last, p.name`)).rows as { id: string; name: string; kind: string; address: string | null; notes: string | null; active: boolean; cityId: number | null; city: string | null; createdAt: Date; assigned: number; activated: number; left: number }[];
  return rows;
}

/** What students see: active places that still have cards, by city (no internal notes). */
export async function publicPlaces() {
  return (await placesWithCounts({ activeOnly: true })).filter((p) => p.left > 0)
    .map(({ id, name, kind, address, city, left }) => ({ id, name, kind: PLACE_KINDS[kind] ?? "Other", address, city, left }));
}

/** Cards in a batch not given to any place yet (and still good), with their # range — for the "assign a stack" form. */
export async function unassignedByBatch() {
  const good = await stillGoodSql();
  return (await db.execute(sql`
    select b.id, b.name, b.kind, b.amount_cents as "amountCents",
      count(c.id) filter (where c.place_id is null and ${good})::int as free,
      min(c.print_seq) filter (where c.place_id is null and ${good})::int as "firstSeq",
      max(c.print_seq) filter (where c.place_id is null and ${good})::int as "lastSeq"
    from nearest_card_batches b join nearest_cards c on c.batch_id = b.id
    where b.status = 'active'
    group by b.id order by b.created_at desc`)).rows as { id: string; name: string; kind: string; amountCents: number; free: number; firstSeq: number | null; lastSeq: number | null }[];
}

type Result = { ok: string } | { error: string };

/** Give a stack of cards (#from to #to of a batch's printer file) to a place. Saved cards and cards already at a place are skipped. */
export async function assignRange(placeId: string, batchId: string, from: number, to: number, by: string, move = false): Promise<Result> {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) return { error: "Enter the first and last # of the stack (from the printer file)." };
  if (to - from + 1 > 1000) return { error: "Assign up to 1,000 cards at a time." };
  const place = await db.query.cardPlaces.findFirst({ where: eq(cardPlaces.id, placeId) });
  if (!place) return { error: "Choose a place." };
  const batch = await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.id, batchId) });
  if (!batch || batch.status === "discarded") return { error: "Choose a batch." };
  const done = await db.update(nearestCards).set({ placeId, assignedAt: new Date(), assignedBy: by })
    .where(and(eq(nearestCards.batchId, batchId), sql`${nearestCards.printSeq} between ${from} and ${to}`, inArray(nearestCards.status, ["issued", "off", "locked"]),
      move ? sql`true` : sql`${nearestCards.placeId} is null`))
    .returning({ id: nearestCards.id });
  const asked = to - from + 1;
  const skipped = asked - done.length;
  return { ok: `${done.length} card${done.length === 1 ? "" : "s"} (#${from}–#${to} of ${batch.name}) given to ${place.name}.${skipped > 0 ? ` ${skipped} skipped — already saved by a student${move ? "" : ", already at another place"} or not in this batch.` : ""}` };
}

/** Give specific cards (full 16-digit numbers, one per line or separated by commas) to a place. */
export async function assignNumbers(placeId: string, raw: string, by: string, move = false): Promise<Result> {
  const place = await db.query.cardPlaces.findFirst({ where: eq(cardPlaces.id, placeId) });
  if (!place) return { error: "Choose a place." };
  const nums = [...new Set(raw.split(/[\n,;]+/).map(digits).filter((n) => n.length > 0))];
  const bad = nums.filter((n) => n.length !== 16);
  if (!nums.length) return { error: "Paste or type at least one 16-digit card number." };
  if (nums.length > 1000) return { error: "Assign up to 1,000 cards at a time." };
  const good = nums.filter((n) => n.length === 16);
  const done = good.length ? await db.update(nearestCards).set({ placeId, assignedAt: new Date(), assignedBy: by })
    .where(and(inArray(nearestCards.number, good), inArray(nearestCards.status, ["issued", "off", "locked"]), move ? sql`true` : sql`${nearestCards.placeId} is null`))
    .returning({ id: nearestCards.id }) : [];
  const skipped = good.length - done.length;
  return { ok: `${done.length} card${done.length === 1 ? "" : "s"} given to ${place.name}.${skipped > 0 ? ` ${skipped} skipped — not found, already saved by a student${move ? "" : " or already at another place"}.` : ""}${bad.length ? ` ${bad.length} line${bad.length === 1 ? "" : "s"} weren't 16 digits.` : ""}` };
}

/** Cards at one place, in stack order (for the place's detail list). */
export async function cardsAtPlace(placeId: string) {
  const days = await activateDays();
  const rows = await db.select({ c: nearestCards, b: nearestCardBatches }).from(nearestCards)
    .innerJoin(nearestCardBatches, eq(nearestCardBatches.id, nearestCards.batchId))
    .where(eq(nearestCards.placeId, placeId)).orderBy(asc(nearestCardBatches.createdAt), asc(nearestCards.printSeq)).limit(1000);
  return rows.map(({ c, b }) => ({
    id: c.id, number: c.number, seq: c.printSeq, batch: b.name, kind: b.kind,
    state: c.status === "activated" ? "Saved by a student" : c.status === "issued" && b.status === "active" && activateBy(b, days) > new Date() && b.validThru > new Date() ? "Not saved yet" : c.status === "issued" ? "Inactive — not saved in time" : c.status === "off" ? "Turned off" : c.status === "locked" ? "Locked" : "Discarded",
  }));
}

export const cityName = async (id: number | null) => (id ? (await db.query.cities.findFirst({ where: eq(cities.id, id) }))?.name ?? null : null);
