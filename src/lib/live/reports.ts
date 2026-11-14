import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Admin → Nearest LIVE & Digital Rewards: counts only (main owner). Votes ≠ registrations ≠ activations. */
export async function liveReports() {
  const [channels, platforms, daily, ads, segments, spinsRecent, campaigns] = await Promise.all([
    db.execute(sql`select channel, count(*)::int as votes, count(*) filter (where user_id is not null)::int as registered from student_votes group by channel`),
    db.execute(sql`select coalesce(platform, 'physical') as platform, count(*)::int as votes from student_votes group by 1 order by votes desc`),
    db.execute(sql`select to_char(d, 'YYYY-MM-DD') as day, coalesce(x.physical, 0)::int as physical, coalesce(x.online, 0)::int as online
      from generate_series((now() at time zone 'America/Chicago')::date - 29, (now() at time zone 'America/Chicago')::date, interval '1 day') d
      left join (select (created_at at time zone 'America/Chicago')::date as day, count(*) filter (where channel <> 'online') as physical, count(*) filter (where channel = 'online') as online
        from student_votes group by 1) x on x.day = d::date order by d`),
    db.execute(sql`with v as (select a.platform, coalesce(a.utm_campaign, a.campaign, '(no campaign tag)') as campaign, a.session_id from ad_visits a),
      g as (select platform, campaign, count(distinct session_id)::int as visits from v group by 1, 2),
      votes as (select a.platform, coalesce(a.utm_campaign, a.campaign, '(no campaign tag)') as campaign, count(*)::int as votes,
          count(*) filter (where sv.user_id is not null)::int as registered,
          count(rs.id)::int as spins, count(rs.id) filter (where rs.status = 'assigned')::int as cards
        from student_votes sv join ad_visits a on a.id = sv.ad_visit_id left join reward_spins rs on rs.vote_id = sv.id group by 1, 2),
      spend as (select platform, campaign, sum(amount_cents)::int as cents from ad_spend group by 1, 2)
      select g.platform, g.campaign, g.visits, coalesce(votes.votes, 0) as votes, coalesce(votes.registered, 0) as registered, coalesce(votes.spins, 0) as spins,
        coalesce(votes.cards, 0) as cards, spend.cents as spend
      from g left join votes using (platform, campaign) left join spend using (platform, campaign) order by g.visits desc limit 100`),
    db.execute(sql`select b.id, b.online_campaign_id as "campaignId", b.kind, b.amount_cents as "amountCents", b.count, b.weight, b.claimed,
        count(rs.id) filter (where rs.status = 'held')::int as held, count(rs.id) filter (where rs.status = 'assigned')::int as assigned,
        count(rs.id) filter (where rs.status = 'expired')::int as expired, count(rs.id) filter (where rs.status = 'declined')::int as declined,
        (select count(*)::int from nearest_cards c where c.batch_id = b.id and c.credit_id is not null) as used
      from nearest_card_batches b left join reward_spins rs on rs.batch_id = b.id where b.channel = 'digital'
      group by b.id order by (b.kind = 'free'), b.amount_cents`),
    db.execute(sql`select rs.kind, rs.amount_cents as "amountCents", rs.status, rs.created_at as at, c.name as city, coalesce(sv.platform, 'direct') as platform
      from reward_spins rs join student_votes sv on sv.id = rs.vote_id left join cities c on c.id = sv.city_id order by rs.created_at desc limit 25`),
    db.execute(sql`select * from online_campaigns order by created_at desc`),
  ]);
  return {
    channels: channels.rows as { channel: string; votes: number; registered: number }[],
    platforms: platforms.rows as { platform: string; votes: number }[],
    daily: daily.rows as { day: string; physical: number; online: number }[],
    ads: ads.rows as { platform: string; campaign: string; visits: number; votes: number; registered: number; spins: number; cards: number; spend: number | null }[],
    segments: segments.rows as { id: string; campaignId: string; kind: string; amountCents: number; count: number; weight: number; claimed: number; held: number; assigned: number; expired: number; declined: number; used: number }[],
    spinsRecent: spinsRecent.rows as { kind: string; amountCents: number; status: string; at: string; city: string | null; platform: string }[],
    campaigns: campaigns.rows as { id: string; name: string; status: string; starts_at: string | null; ends_at: string | null; states: string[]; hold_hours: number; quick_hold_minutes: number; spins_per_hour: number; valid_thru: string; rules_text: string }[],
  };
}
