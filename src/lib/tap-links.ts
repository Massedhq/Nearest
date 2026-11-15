import "server-only";
import { cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { db, tapLinks, users, adminMembers } from "@/db";

/**
 * GRANTED tap links (2026-11-14, owner). Each owner (Avy, Kisses, Lakeesha) has one personal link —
 * usenearest.com/t/<slug> — to write on an NFC tap card or show as a QR. It opens the normal vote (/card) with the
 * tap remembered in a short cookie; after the vote the student scratches straight away (no number or code to type),
 * and the reward comes from THAT owner's own GRANTED cards (same pool as their printed cards). Votes are saved with
 * channel "tap" + tap_user_id. A link can be paused on its own (Pause on the owner's tap card) — pausing the owner's
 * GRANTED cards pauses taps too.
 */
export const TAP_COOKIE = "nearest_tap";
export const TAP_COOKIE_HOURS = 2;

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "").slice(0, 20);

/** The owner's tap link (made the first time: their first name, then a number if it's taken). */
export async function tapLinkFor(userId: string) {
  const have = (await db.select().from(tapLinks).where(eq(tapLinks.userId, userId)))[0];
  if (have) return have;
  const u = (await db.select({ first: users.firstName, email: users.email }).from(users).where(eq(users.id, userId)))[0];
  const base = slugify(u?.first ?? "") || slugify((u?.email ?? "").split("@")[0]) || "nearest";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}${i + 1}`;
    const r = await db.insert(tapLinks).values({ userId, slug }).onConflictDoNothing().returning();
    if (r[0]) return r[0];
    const again = (await db.select().from(tapLinks).where(eq(tapLinks.userId, userId)))[0];
    if (again) return again;
  }
  throw new Error("Couldn't make a tap link.");
}

/** The owner's published, active GRANTED scratch-off pool with rewards left (its first row), or null. */
export async function tapPoolBatch(userId: string) {
  const r = (await db.execute(sql`select id from nearest_card_batches
    where scratch and not draft and status = 'active' and distributor_id = ${userId} and valid_thru >= now()
      and exists (select 1 from nearest_card_batches o where o.shared_number = nearest_card_batches.shared_number and o.shared_code = nearest_card_batches.shared_code
        and o.scratch and not o.draft and o.status = 'active' and o.claimed < o.count)
    order by kind, amount_cents, id limit 1`)).rows[0] as { id: string } | undefined;
  return r?.id ?? null;
}

/** A tap link by its slug, if it belongs to a current owner. */
export async function tapBySlug(slug: string) {
  const clean = slugify(slug);
  if (!clean) return null;
  const r = (await db.select({ userId: tapLinks.userId, slug: tapLinks.slug, active: tapLinks.active, first: users.firstName })
    .from(tapLinks).innerJoin(users, eq(users.id, tapLinks.userId))
    .innerJoin(adminMembers, and(eq(adminMembers.userId, tapLinks.userId), eq(adminMembers.role, "OWNER")))
    .where(eq(tapLinks.slug, clean)))[0];
  return r ?? null;
}

/** The tap this browser came from (cookie), when it's still active and the owner has rewards left. */
export async function currentTap() {
  const slug = (await cookies()).get(TAP_COOKIE)?.value ?? "";
  if (!slug) return null;
  const t = await tapBySlug(slug);
  if (!t?.active) return null;
  const batchId = await tapPoolBatch(t.userId);
  if (!batchId) return null;
  return { userId: t.userId, slug: t.slug, name: t.first ?? "Nearest", batchId };
}

/** Tap numbers for one owner: opens, votes, registered, rewards revealed, rewards added to accounts. */
export async function tapStats(userId: string) {
  const r = (await db.execute(sql`select
      coalesce((select opens from tap_links where user_id = ${userId}), 0)::int as opens,
      (select count(*) from student_votes where tap_user_id = ${userId})::int as votes,
      (select count(*) from student_votes where tap_user_id = ${userId} and user_id is not null)::int as registered,
      (select count(*) from reward_spins rs join student_votes v on v.id = rs.vote_id where v.tap_user_id = ${userId} and rs.channel = 'physical')::int as revealed,
      (select count(*) from reward_spins rs join student_votes v on v.id = rs.vote_id where v.tap_user_id = ${userId} and rs.status = 'assigned')::int as added`)).rows[0];
  return r as { opens: number; votes: number; registered: number; revealed: number; added: number };
}
