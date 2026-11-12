import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { PLACE_KINDS } from "./card-places";

/**
 * GRANTED voucher distribution (2026-11-12). Three levels, never mixed up:
 *  1. Allocation — a distributor's campaigns (nearest_card_batches: one 16-digit number, 3-digit discount code + 4-digit
 *     free code; `count` = vouchers and claim limit, e.g. 900 / 100).
 *  2. Physical distribution — voucher_distributions: vouchers assigned to an organization location (card_places) and how
 *     many were actually delivered. Inventory only — it never limits activations.
 *  3. Student activation — nearest_cards (shared), attributed to an organization only by what the student REPORTED on
 *     Screen 2 (student_votes.source_*). Student-reported, not proof of delivery.
 * Every distributor query here is filtered to ONE distributor id on the server; only the main owner's pages pass null (all).
 * Counts only — no student names, emails or contact details ever leave this file.
 */
export const DIST_STATUS: Record<string, string> = { planned: "Planned", assigned: "Assigned", delivered: "Delivered", completed: "Completed", cancelled: "Canceled" };
export const ORG_KINDS = PLACE_KINDS;

/** Vouchers physically delivered on an assignment (older handout rows: delivered null = the whole quantity). */
export const DELIVERED = sql.raw(`(case when d.status = 'cancelled' then coalesce(d.delivered, 0) when d.status in ('delivered','completed') then coalesce(d.delivered, d.quantity) else coalesce(d.delivered, 0) end)`);
const ACTIVE = sql.raw(`d.status <> 'cancelled'`);

const nameSql = sql.raw(`coalesce(nullif(trim(u.first_name || ' ' || coalesce(u.last_name, '')), ''), u.email)`);

export type Campaign = { id: string; kind: string; count: number; number: string; code: string; status: string; draft: boolean; amountCents: number; validThru: Date; assigned: number; delivered: number; activated: number };

/** One distributor's published campaigns with inventory and activation counts. */
export async function distributorCampaigns(userId: string, includeDrafts = false) {
  return (await db.execute(sql`select b.id, b.kind, b.count, b.shared_number as number, b.shared_code as code, b.status, b.draft,
      b.amount_cents as "amountCents", b.valid_thru as "validThru",
      coalesce((select sum(d.quantity) from voucher_distributions d where d.batch_id = b.id and ${ACTIVE}), 0)::int as assigned,
      coalesce((select sum(${DELIVERED}) from voucher_distributions d where d.batch_id = b.id), 0)::int as delivered,
      (select count(*) from nearest_cards c where c.batch_id = b.id and c.shared)::int as activated
    from nearest_card_batches b where b.shared_number is not null and b.distributor_id = ${userId} ${includeDrafts ? sql`` : sql`and not b.draft`}
    order by b.kind`)).rows as Campaign[];
}

/** Votes and registrations attributed to a distributor: the student entered (or activated) one of their campaigns. */
export async function distributorVotes(userId: string) {
  return (await db.execute(sql`select count(*)::int as votes, count(*) filter (where v.user_id is not null)::int as registered
    from student_votes v where v.pending_batch_id in (select id from nearest_card_batches where distributor_id = ${userId} and shared_number is not null)
      or exists (select 1 from nearest_cards c join nearest_card_batches b on b.id = c.batch_id where c.shared and c.student_id = v.user_id and v.user_id is not null and b.distributor_id = ${userId})`)).rows[0] as { votes: number; registered: number };
}

export type OrgRow = {
  placeId: string; name: string; kind: string; street: string | null; city: string | null; state: string | null; zip: string | null; contactName: string | null; contact: string | null;
  distributorId: string; distributor: string;
  assignedDiscount: number; assignedFree: number; deliveredDiscount: number; deliveredFree: number; deliveries: number; last: Date | null;
  votes: number; registered: number; actDiscount: number; actFree: number;
};

/** Organization performance per location × distributor. distributorId null = every distributor (main owner only). */
export async function orgPerformance(distributorId: string | null): Promise<OrgRow[]> {
  const only = distributorId ? sql`and b.distributor_id = ${distributorId}` : sql``;
  const rows = (await db.execute(sql`select p.id as "placeId", p.name, p.kind, p.street, ci.name as city, coalesce(p.state, ci.state) as state, p.zip,
      p.contact_name as "contactName", p.contact, b.distributor_id as "distributorId", ${nameSql} as distributor,
      coalesce(sum(d.quantity) filter (where b.kind = 'discount' and ${ACTIVE}), 0)::int as "assignedDiscount",
      coalesce(sum(d.quantity) filter (where b.kind = 'free' and ${ACTIVE}), 0)::int as "assignedFree",
      coalesce(sum(${DELIVERED}) filter (where b.kind = 'discount'), 0)::int as "deliveredDiscount",
      coalesce(sum(${DELIVERED}) filter (where b.kind = 'free'), 0)::int as "deliveredFree",
      count(*) filter (where ${DELIVERED} > 0)::int as deliveries,
      max(d.distributed_at) filter (where ${ACTIVE}) as last,
      (select count(*) from student_votes v where v.source_place_id = p.id and (
          v.pending_batch_id in (select id from nearest_card_batches where distributor_id = b.distributor_id)
          or exists (select 1 from nearest_cards c join nearest_card_batches cb on cb.id = c.batch_id where c.shared and c.student_id = v.user_id and v.user_id is not null and cb.distributor_id = b.distributor_id)))::int as votes,
      (select count(*) from student_votes v where v.source_place_id = p.id and v.user_id is not null and (
          v.pending_batch_id in (select id from nearest_card_batches where distributor_id = b.distributor_id)
          or exists (select 1 from nearest_cards c join nearest_card_batches cb on cb.id = c.batch_id where c.shared and c.student_id = v.user_id and cb.distributor_id = b.distributor_id)))::int as registered,
      (select count(*) from nearest_cards c join nearest_card_batches cb on cb.id = c.batch_id where c.shared and c.source_place_id = p.id and cb.distributor_id = b.distributor_id and cb.kind = 'discount')::int as "actDiscount",
      (select count(*) from nearest_cards c join nearest_card_batches cb on cb.id = c.batch_id where c.shared and c.source_place_id = p.id and cb.distributor_id = b.distributor_id and cb.kind = 'free')::int as "actFree"
    from voucher_distributions d join nearest_card_batches b on b.id = d.batch_id join card_places p on p.id = d.place_id
      left join cities ci on ci.id = p.city_id left join users u on u.id = b.distributor_id
    where b.shared_number is not null ${only}
    group by p.id, ci.name, ci.state, b.distributor_id, u.first_name, u.last_name, u.email
    order by p.name, ci.name`)).rows as OrgRow[];
  return rows;
}

export type Assignment = { id: string; batchId: string; kind: string; placeId: string | null; place: string | null; city: string | null; street: string | null; quantity: number; delivered: number; status: string; at: Date; notes: string | null; distributorId: string; distributor: string; updatedAt: Date | null; createdAt: Date };

/** Individual assignments (every delivery is its own row). */
export async function assignments(distributorId: string | null, limit = 300): Promise<Assignment[]> {
  const only = distributorId ? sql`and b.distributor_id = ${distributorId}` : sql``;
  return (await db.execute(sql`select d.id, d.batch_id as "batchId", b.kind, d.place_id as "placeId", p.name as place, ci.name as city, p.street,
      d.quantity, ${DELIVERED}::int as delivered, d.status, d.distributed_at as at, d.notes, b.distributor_id as "distributorId", ${nameSql} as distributor,
      d.updated_at as "updatedAt", d.created_at as "createdAt"
    from voucher_distributions d join nearest_card_batches b on b.id = d.batch_id left join card_places p on p.id = d.place_id
      left join cities ci on ci.id = p.city_id left join users u on u.id = b.distributor_id
    where b.shared_number is not null ${only} order by d.distributed_at desc, d.created_at desc limit ${limit}`)).rows as Assignment[];
}

/** Change history (created, edited, delivered, canceled). */
export async function assignmentHistory(distributorId: string | null, limit = 100) {
  const only = distributorId ? sql`and b.distributor_id = ${distributorId}` : sql``;
  return (await db.execute(sql`select e.id, e.action, e.before, e.after, e.created_at as at, p.name as place, b.kind, ${nameSql} as actor,
      (select coalesce(nullif(trim(x.first_name || ' ' || coalesce(x.last_name, '')), ''), x.email) from users x where x.id = b.distributor_id) as distributor
    from voucher_distribution_events e join voucher_distributions d on d.id = e.distribution_id join nearest_card_batches b on b.id = d.batch_id
      left join card_places p on p.id = d.place_id left join users u on u.id = e.actor_id
    where true ${only} order by e.created_at desc limit ${limit}`)).rows as { id: string; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; at: Date; place: string | null; kind: string; actor: string; distributor: string }[];
}

/** Student-reported sources that didn't match the distributor's assignments (main owner review). Counts, no students. */
export async function unmatchedSources() {
  return (await db.execute(sql`select coalesce(p.name || coalesce(' — ' || ci.name, ''), c.source_text, '(no name given)') as source,
      case when c.source_place_id is not null then 'Listed location' when c.source_text is not null then 'Typed by student' else 'Other / someone' end as how,
      ${nameSql} as distributor, b.kind, count(*)::int as n, max(c.activated_at) as last
    from nearest_cards c join nearest_card_batches b on b.id = c.batch_id left join card_places p on p.id = c.source_place_id
      left join cities ci on ci.id = p.city_id left join users u on u.id = b.distributor_id
    where c.shared and c.source_match = 'unmatched'
    group by 1, 2, u.first_name, u.last_name, u.email, b.kind order by n desc, last desc limit 200`)).rows as { source: string; how: string; distributor: string; kind: string; n: number; last: Date }[];
}

/** Votes whose student picked "Other" or "Someone gave it to me" (main owner review of unrecognized names). */
export async function typedSources() {
  return (await db.execute(sql`select v.source_kind as kind, coalesce(nullif(trim(v.source_text), ''), '(no name given)') as text, count(*)::int as n, max(v.updated_at) as last
    from student_votes v where v.source_kind in ('other', 'someone') group by 1, 2 order by n desc limit 200`)).rows as { kind: string; text: string; n: number; last: Date }[];
}

/** Every distributor with a campaign: the main owner's campaign-wide view. */
export async function distributorsOverview() {
  const ds = (await db.execute(sql`select distinct b.distributor_id as id, ${nameSql} as name from nearest_card_batches b join users u on u.id = b.distributor_id
    where b.shared_number is not null order by name`)).rows as { id: string; name: string }[];
  return Promise.all(ds.map(async (d) => {
    const [camps, v, extra] = await Promise.all([
      distributorCampaigns(d.id, true), distributorVotes(d.id),
      db.execute(sql`select count(distinct d.place_id) filter (where ${DELIVERED} > 0)::int as visited,
          count(*) filter (where d.status in ('planned', 'assigned'))::int as current,
          greatest(max(d.created_at), max(d.updated_at)) as last
        from voucher_distributions d join nearest_card_batches b on b.id = d.batch_id where b.distributor_id = ${d.id} and b.shared_number is not null`),
    ]);
    const live = camps.filter((c) => !c.draft);
    const sum = (k: "count" | "assigned" | "delivered" | "activated", kind?: string) => live.filter((c) => !kind || c.kind === kind).reduce((n, c) => n + Number(c[k]), 0);
    const x = extra.rows[0] as { visited: number; current: number; last: Date | null };
    return { ...d, allocated: sum("count"), assigned: sum("assigned"), delivered: sum("delivered"), remaining: Math.max(0, sum("count") - sum("delivered")),
      votes: v.votes, registered: v.registered, activated: sum("activated"), free: sum("activated", "free"), discount: sum("activated", "discount"),
      visited: x.visited, current: x.current, last: x.last, drafts: camps.length - live.length };
  }));
}

/**
 * Screen 2 list: every organization location with an Assigned, Delivered or Completed assignment on a published campaign
 * (and locations that already got vouchers stay listed). Planned-only and fully canceled locations aren't shown. One entry
 * per location even when several distributors use it. Public: name, street, city, state only.
 */
export async function voteSourceOptions() {
  return (await db.execute(sql`select p.id, p.name, p.street, ci.name as city, coalesce(p.state, ci.state) as state
    from card_places p left join cities ci on ci.id = p.city_id
    where exists (select 1 from voucher_distributions d join nearest_card_batches b on b.id = d.batch_id
      where d.place_id = p.id and b.shared_number is not null and not b.draft and (d.status in ('assigned', 'delivered', 'completed') or ${DELIVERED} > 0))
    order by p.name, ci.name`)).rows as { id: string; name: string; street: string | null; city: string | null; state: string | null }[];
}

export const locationKey = (name: string, street: string, zip: string) =>
  [name, street, zip].map((x) => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()).join("|");

export const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
export type SqlFrag = SQL;
