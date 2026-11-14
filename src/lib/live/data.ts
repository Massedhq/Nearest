import "server-only";
import { createHash } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { MAPS } from "./maps";

/**
 * Nearest LIVE (2026-11-13): real votes only (student_votes — physical /card and online /vote alike), never simulated.
 * City-level only: no names, schools, exact locations or account details. Votes are interest, not bookings.
 */
export type LiveSnapshot = {
  state: string; total: number; today: number; online: number; physical: number; cities: number;
  byCity: { id: number; name: string; votes: number; last24: number; x: number | null; y: number | null; top: string[] }[];
  byService: { name: string; votes: number }[];
  recent: { key: string; city: string; services: string[]; at: string; x: number | null; y: number | null }[];
  daily: { day: string; votes: number }[];
  at: string;
};

export async function liveSnapshot(state = "TX"): Promise<LiveSnapshot> {
  const map = MAPS[state];
  const pt = (name: string) => map?.points[name.toLowerCase()] ?? null;
  const [tot, cities, svc, recent, daily] = await Promise.all([
    db.execute(sql`select count(*)::int as total,
        count(*) filter (where created_at >= (date_trunc('day', now() at time zone 'America/Chicago') at time zone 'America/Chicago'))::int as today,
        count(*) filter (where channel = 'online')::int as online, count(*) filter (where channel <> 'online')::int as physical,
        count(distinct city_id)::int as cities
      from student_votes where state = ${state}`),
    db.execute(sql`select v.city_id as id, c.name, count(*)::int as votes, count(*) filter (where v.created_at > now() - interval '24 hours')::int as last24,
        (select array_agg(x.cat order by x.n desc) from (select unnest(v2.categories) as cat, count(*) as n from student_votes v2 where v2.city_id = v.city_id group by 1 order by 2 desc limit 3) x) as top
      from student_votes v join cities c on c.id = v.city_id where v.state = ${state} group by v.city_id, c.name order by votes desc`),
    db.execute(sql`select cat as name, count(*)::int as votes from student_votes, unnest(categories) as cat where state = ${state} group by cat order by votes desc`),
    db.execute(sql`select v.id, c.name as city, v.categories, v.created_at from student_votes v join cities c on c.id = v.city_id where v.state = ${state} order by v.created_at desc limit 20`),
    db.execute(sql`select to_char(d, 'YYYY-MM-DD') as day, coalesce(n, 0)::int as votes
      from generate_series((now() at time zone 'America/Chicago')::date - 13, (now() at time zone 'America/Chicago')::date, interval '1 day') d
      left join (select (created_at at time zone 'America/Chicago')::date as day, count(*) as n from student_votes where state = ${state} group by 1) x on x.day = d::date order by d`),
  ]);
  const t = tot.rows[0] as { total: number; today: number; online: number; physical: number; cities: number };
  return {
    state, ...t,
    byCity: (cities.rows as { id: number; name: string; votes: number; last24: number; top: string[] | null }[]).map((r) => { const p = pt(r.name); return { ...r, top: r.top ?? [], x: p?.[0] ?? null, y: p?.[1] ?? null }; }),
    byService: svc.rows as { name: string; votes: number }[],
    // The key is a one-way hash so the page can tell new votes apart without seeing vote ids.
    recent: (recent.rows as { id: string; city: string; categories: string[]; created_at: string }[]).map((r) => { const p = pt(r.city); return { key: createHash("sha256").update(r.id).digest("hex").slice(0, 12), city: r.city, services: r.categories.slice(0, 3), at: new Date(r.created_at).toISOString(), x: p?.[0] ?? null, y: p?.[1] ?? null }; }),
    daily: daily.rows as { day: string; votes: number }[],
    at: new Date().toISOString(),
  };
}

/** Who can see Nearest LIVE: everyone once live.public is on, otherwise owners only. */
export async function canSeeLive() {
  const { getSettings } = await import("../settings");
  if ((await getSettings())["live.public"] === true) return true;
  const { getViewer } = await import("../viewer");
  const v = await getViewer();
  if (!v?.user) return false;
  const { db: d, adminMembers } = await import("@/db");
  const { eq } = await import("drizzle-orm");
  return !!(await d.query.adminMembers.findFirst({ where: eq(adminMembers.userId, v.user.id) }));
}
