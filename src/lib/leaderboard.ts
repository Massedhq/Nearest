import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export type Range = "30" | "90" | "all";
const since = (r: Range) => (r === "all" ? null : new Date(Date.now() - Number(r) * 86400_000));

export type ProRow = {
  userId: string; business: string | null; city: string | null; photo: string | null;
  completed: number; earnedCents: number; reviews: number; avg: number | null; favorites: number; shares: number; proCancels: number; score: number;
};
export type StudentRow = {
  userId: string; name: string; school: string | null; completed: number; spentCents: number; reviews: number; avgGiven: number | null; sharesSent: number;
};

/**
 * Overall score for professionals (shown on the page so it's never a mystery):
 *   3 × completed bookings + 2 × reviews + favorites + 2 × times shared
 *   + 20 × (fair rating − 4)   ← fair rating pulls low-review pros toward 4.5 so one 5★ can't win
 *   − 5 × pro cancellations
 */
export async function proLeaderboard(range: Range): Promise<ProRow[]> {
  const s = since(range);
  const inRange = (col: string) => (s ? sql.raw(`and ${col} >= '${s.toISOString()}'`) : sql.raw(""));
  const rows = (await db.execute(sql`
    select p.user_id as "userId", p.business_name as business, c.name as city, p.photo_url as photo,
      coalesce(b.completed, 0)::int as completed, coalesce(b.earned, 0)::int as "earnedCents", coalesce(b.pro_cancels, 0)::int as "proCancels",
      coalesce(r.n, 0)::int as reviews, r.avg::float as avg,
      coalesce(f.n, 0)::int as favorites, coalesce(sh.n, 0)::int as shares
    from professional_profiles p
    left join cities c on c.id = p.city_id
    left join (select pro_id, count(*) filter (where status = 'completed') as completed,
                      sum(price_cents) filter (where status = 'completed') as earned,
                      count(*) filter (where status = 'cancelled_pro') as pro_cancels
               from bookings where true ${inRange("starts_at")} group by pro_id) b on b.pro_id = p.user_id
    left join (select pro_id, count(*) as n, avg(rating) as avg from reviews where hidden = false ${inRange("created_at")} group by pro_id) r on r.pro_id = p.user_id
    left join (select pro_id, count(*) as n from favorites where true ${inRange("created_at")} group by pro_id) f on f.pro_id = p.user_id
    left join (select pro_id, count(*) as n from pro_shares where true ${inRange("created_at")} group by pro_id) sh on sh.pro_id = p.user_id
    where p.review_status = 'approved'
  `)).rows as Omit<ProRow, "score">[];
  return rows.map((r) => {
    const fair = r.reviews ? (Number(r.avg) * r.reviews + 4.5 * 5) / (r.reviews + 5) : 4.5;
    const score = Math.round(3 * r.completed + 2 * r.reviews + r.favorites + 2 * r.shares + 20 * (fair - 4) - 5 * r.proCancels);
    return { ...r, avg: r.avg == null ? null : Number(r.avg), score };
  });
}

export async function studentLeaderboard(range: Range): Promise<StudentRow[]> {
  const s = since(range);
  const inRange = (col: string) => (s ? sql.raw(`and ${col} >= '${s.toISOString()}'`) : sql.raw(""));
  const rows = (await db.execute(sql`
    select u.id as "userId", coalesce(u.first_name, 'Student') || coalesce(' ' || left(u.last_name, 1) || '.', '') as name, sc.name as school,
      coalesce(b.completed, 0)::int as completed, coalesce(b.spent, 0)::int as "spentCents",
      coalesce(r.n, 0)::int as reviews, r.avg::float as "avgGiven", coalesce(sh.n, 0)::int as "sharesSent"
    from users u
    join student_profiles sp on sp.user_id = u.id
    left join schools sc on sc.id = sp.school_id
    left join (select student_id, count(*) filter (where status = 'completed') as completed,
                      sum(price_cents) filter (where status = 'completed') as spent
               from bookings where true ${inRange("starts_at")} group by student_id) b on b.student_id = u.id
    left join (select student_id, count(*) as n, avg(rating) as avg from reviews where true ${inRange("created_at")} group by student_id) r on r.student_id = u.id
    left join (select from_id, count(*) as n from pro_shares where true ${inRange("created_at")} group by from_id) sh on sh.from_id = u.id
    where u.account_type = 'student'
  `)).rows as StudentRow[];
  return rows.map((r) => ({ ...r, avgGiven: r.avgGiven == null ? null : Number(r.avgGiven) }));
}

export const top = <T,>(rows: T[], key: (r: T) => number, n = 10, min = 1) => rows.filter((r) => key(r) >= min).sort((a, b) => key(b) - key(a)).slice(0, n);
