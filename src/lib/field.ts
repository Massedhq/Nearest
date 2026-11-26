import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { liveCoverage } from "./demand";

/**
 * Field work (2026-11-22): organizations (card_places) and pop-ups worked by an owner and their assistant. An
 * organization belongs to the owner whose area it's in (ZIP first, then city); outside every area it belongs to whoever
 * added it (an assistant's organizations belong to their owner). `scope` null = every owner (main owner).
 */
export const PLACE_OWNER = sql.raw(`coalesce(
  (select z.owner_id from area_zips z where z.zip = left(coalesce(p.zip, ''), 5)),
  (select ac.owner_id from area_cities ac where ac.city_id = p.city_id),
  (select t.owner_id from team_assistants t where t.user_id = p.created_by order by t.created_at desc limit 1),
  p.created_by)`);

export const TOUCH_KINDS: Record<string, string> = { call: "Call", email: "Email", text: "Text", visit: "Visit", note: "Note" };
export const STEP_KINDS: Record<string, string> = { meeting: "In-person meeting", virtual: "Virtual meeting", dropoff: "Card drop-off" };
export const POPUP_STATUS: Record<string, string> = { planned: "Planned", confirmed: "Confirmed", done: "Done", cancelled: "Canceled" };
export const AD_STATUS: Record<string, string> = { draft: "Draft", submitted: "Waiting for approval", approved: "Approved", changes: "Changes asked", launched: "Launched" };
export const DEFAULT_CARDS_PER_ORG = 10;

const scoped = (scope: string | null, col: ReturnType<typeof sql.raw> | string) => (scope ? sql`and ${typeof col === "string" ? sql.raw(col) : col} = ${scope}` : sql``);

export type FieldPlace = { id: string; name: string; kind: string; street: string | null; city: string | null; state: string | null; zip: string | null;
  ownerId: string | null; owner: string | null; touches: number; lastTouch: string | null; nextStep: string | null; cardsAsked: number; cardsAssigned: number;
  worker: string | null; workerId: string | null; open: boolean; shared: boolean };

/** Who works an organization: the assignee (or whoever added it, for older rows); null = open for anyone to claim. */
export const PLACE_WORKER = sql.raw(`case when p.open_to_claim then null else coalesce(p.assigned_to, p.created_by) end`);

/**
 * `viewer` = an assistant's user id: they see organizations shared with the team plus the ones they added or work.
 * Owners (viewer null) see everything in their area.
 */
export async function fieldPlaces(scope: string | null, q = "", viewer: string | null = null): Promise<FieldPlace[]> {
  const like = q ? sql`and (p.name ilike ${"%" + q + "%"} or p.street ilike ${"%" + q + "%"} or c.name ilike ${"%" + q + "%"} or p.zip ilike ${q + "%"})` : sql``;
  return (await db.execute(sql`select * from (
      select p.id, p.name, p.kind, p.street, c.name as city, p.state, p.zip, ${PLACE_OWNER} as "ownerId",
        ${PLACE_WORKER} as "workerId", p.open_to_claim as open, p.shared, p.created_by as "createdBy",
        (select count(*)::int from field_touches t where t.place_id = p.id) as touches,
        (select max(t.at) from field_touches t where t.place_id = p.id) as "lastTouch",
        (select min(s.starts_at) from field_steps s where s.place_id = p.id and s.status = 'planned' and s.starts_at > now() - interval '12 hours') as "nextStep",
        coalesce((select sum(d.quantity) from voucher_distributions d where d.place_id = p.id and d.status = 'planned' and d.requested_by is not null), 0)::int as "cardsAsked",
        coalesce((select sum(d.quantity) from voucher_distributions d where d.place_id = p.id and d.status in ('assigned','delivered','completed')), 0)::int as "cardsAssigned"
      from card_places p left join cities c on c.id = p.city_id where p.active ${like}) x
    left join lateral (select u.first_name as owner from users u where u.id = x."ownerId") o on true
    left join lateral (select w.first_name as worker from users w where w.id = x."workerId") wk on true
    where true ${scope ? sql`and x."ownerId" = ${scope}` : sql``}
      ${viewer ? sql`and (x.shared or x."createdBy" = ${viewer} or x."workerId" = ${viewer})` : sql``}
    order by coalesce(x."lastTouch", '1970-01-01') desc, x.name limit 400`)).rows as FieldPlace[];
}

export async function placeOwnerId(placeId: string) {
  const r = (await db.execute(sql`select ${PLACE_OWNER} as "ownerId" from card_places p where p.id = ${placeId}`)).rows[0] as { ownerId: string | null } | undefined;
  return r?.ownerId ?? null;
}

export async function placeTimeline(placeId: string) {
  const [contacts, touches, steps, cards] = await Promise.all([
    db.execute(sql`select * from field_contacts where place_id = ${placeId} order by created_at`),
    db.execute(sql`select t.*, u.first_name as by, fc.name as contact from field_touches t left join users u on u.id = t.created_by left join field_contacts fc on fc.id = t.contact_id
      where t.place_id = ${placeId} order by t.at desc limit 200`),
    db.execute(sql`select s.*, u.first_name as by, o.first_name as owner, fc.name as contact from field_steps s left join users u on u.id = s.created_by left join users o on o.id = s.owner_id
      left join field_contacts fc on fc.id = s.contact_id where s.place_id = ${placeId} order by s.starts_at desc`),
    db.execute(sql`select d.id, d.quantity, d.delivered, d.status, d.distributed_at as at, d.notes, d.requested_by as "requestedBy", d.approved_at as "approvedAt", u.first_name as by
      from voucher_distributions d left join users u on u.id = d.created_by where d.place_id = ${placeId} order by d.created_at desc`),
  ]);
  return {
    contacts: contacts.rows as { id: string; name: string; title: string | null; phone: string | null; email: string | null; notes: string | null }[],
    touches: touches.rows as { id: string; kind: string; summary: string; at: string; by: string | null; contact: string | null }[],
    steps: steps.rows as { id: string; kind: string; starts_at: string; meet_with: string | null; link: string | null; notes: string | null; status: string; by: string | null; owner: string | null; contact: string | null }[],
    cards: cards.rows as { id: string; quantity: number; delivered: number | null; status: string; at: string; notes: string | null; requestedBy: string | null; approvedAt: string | null; by: string | null }[],
  };
}

export type Upcoming = { kind: string; id: string; at: string; title: string; where: string | null; who: string | null; owner: string | null; placeId: string | null; link: string | null };

/** Meetings, drop-offs and pop-ups coming up (from 12 hours ago), soonest first. */
export async function upcoming(scope: string | null): Promise<Upcoming[]> {
  const steps = (await db.execute(sql`select s.kind, s.id, s.starts_at as at, p.name as title,
      concat_ws(', ', p.street, c.name, p.state || ' ' || coalesce(p.zip, '')) as where, coalesce(fc.name, s.meet_with) as who, o.first_name as owner, p.id as "placeId", s.link
    from field_steps s join card_places p on p.id = s.place_id left join cities c on c.id = p.city_id left join field_contacts fc on fc.id = s.contact_id left join users o on o.id = s.owner_id
    where s.status = 'planned' and s.starts_at > now() - interval '12 hours' ${scoped(scope, "s.owner_id")} order by s.starts_at limit 100`)).rows as Upcoming[];
  const pops = (await db.execute(sql`select 'popup' as kind, f.id, f.starts_at as at, f.name as title, concat_ws(', ', f.street, f.city_name, f.state || ' ' || f.zip) as where,
      f.contact_name as who, o.first_name as owner, null as "placeId", null as link
    from field_popups f left join users o on o.id = f.owner_id
    where f.status in ('planned','confirmed') and f.ends_at > now() - interval '12 hours' ${scoped(scope, "f.owner_id")} order by f.starts_at limit 100`)).rows as Upcoming[];
  return [...steps, ...pops].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

/** Card requests from assistants waiting for the owner. */
export async function cardRequests(scope: string | null) {
  return (await db.execute(sql`select d.id, d.quantity, d.distributed_at as at, d.notes, p.id as "placeId", p.name as place, c.name as city, u.first_name as by, b.distributor_id as "ownerId",
      o.first_name as owner
    from voucher_distributions d join nearest_card_batches b on b.id = d.batch_id join card_places p on p.id = d.place_id left join cities c on c.id = p.city_id
    left join users u on u.id = d.requested_by left join users o on o.id = b.distributor_id
    where d.status = 'planned' and d.requested_by is not null ${scoped(scope, "b.distributor_id")} order by d.created_at`)).rows as
    { id: string; quantity: number; at: string; notes: string | null; placeId: string; place: string; city: string | null; by: string | null; ownerId: string; owner: string | null }[];
}

/** A distributor's card supply WITHOUT numbers or codes (safe for assistants). */
export async function cardSupply(ownerId: string) {
  const { distributorCampaigns } = await import("./distribution");
  return (await distributorCampaigns(ownerId)).filter((c) => c.status === "active").map((c) => ({
    id: c.id, label: c.kind === "cards" ? "GRANTED cards" : c.kind === "free" ? "Free-service vouchers" : "Discount vouchers", count: c.count, left: Math.max(0, c.count - c.assigned),
  }));
}

/** Votes by city and service in an area, with how many live professionals there — "Recruit next". */
export async function recruitNext(scope: string | null, limit = 40) {
  const areaCut = scope ? sql`and (v.city_id in (select city_id from area_cities where owner_id = ${scope}) or v.city_id in (select city_id from area_zips where owner_id = ${scope}))` : sql``;
  const rows = (await db.execute(sql`select v.city_id as "cityId", c.name as city, cat as category, count(*)::int as votes, count(*) filter (where v.created_at > now() - interval '7 days')::int as week
    from student_votes v join cities c on c.id = v.city_id cross join lateral unnest(v.categories) as cat
    where v.city_id is not null ${areaCut} group by v.city_id, c.name, cat order by votes desc limit 400`)).rows as { cityId: number; city: string; category: string; votes: number; week: number }[];
  const live = new Set((await liveCoverage()).map((x) => `${x.cityId}|${x.category}`));
  return rows.map((r) => ({ ...r, covered: live.has(`${r.cityId}|${r.category}`) }))
    .sort((a, b) => Number(a.covered) - Number(b.covered) || b.votes - a.votes).slice(0, limit);
}

export async function popups(scope: string | null) {
  return (await db.execute(sql`select f.*, o.first_name as owner, u.first_name as by from field_popups f left join users o on o.id = f.owner_id left join users u on u.id = f.created_by
    where true ${scoped(scope, "f.owner_id")} order by (f.status in ('done','cancelled')), f.starts_at desc limit 200`)).rows as PopupRow[];
}
export type PopupRow = { id: string; owner_id: string; name: string; kind: string; host_name: string | null; street: string; city_name: string; state: string; zip: string;
  starts_at: string; ends_at: string; details: string | null; source_url: string | null; contact_name: string | null; contact: string | null; notes: string | null; status: string;
  signups: number | null; owner: string | null; by: string | null; space_cost: string | null; vendor_fee: string | null; our_fee: string | null; bring: string | null };

export async function adDraftsFor(scope: string | null) {
  return (await db.execute(sql`select a.*, o.first_name as owner, u.first_name as by from ad_drafts a left join users o on o.id = a.owner_id left join users u on u.id = a.created_by
    where true ${scoped(scope, "a.owner_id")} order by (a.status = 'launched'), a.updated_at desc nulls last, a.created_at desc limit 200`)).rows as AdDraftRow[];
}
export type AdDraftRow = { id: string; owner_id: string; platform: string; name: string; goal: string | null; audience: string | null; budget_cents: number | null; budget_kind: string;
  starts_on: string | null; ends_on: string | null; headline: string | null; primary_text: string | null; link: string | null; creative: string | null; notes: string | null;
  status: string; review_note: string | null; owner: string | null; by: string | null; created_at: string };
