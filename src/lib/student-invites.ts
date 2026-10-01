import "server-only";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, users, inviteRewards, bookings, studentProfiles } from "@/db";

export const INVITE_REWARD_CENTS = 500;
export const FRIEND_COOKIE = "nearest_friend";

/** The student's own invite code (created the first time they open Account). */
export async function ensureInviteCode(userId: string) {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (u?.inviteCode) return u.inviteCode;
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 6; i++) {
    const code = "F" + Array.from(randomBytes(6), (x) => abc[x % abc.length]).join("");
    const [row] = await db.update(users).set({ inviteCode: code }).where(and(eq(users.id, userId), sql`${users.inviteCode} is null`)).returning().catch(() => []);
    if (row?.inviteCode) return row.inviteCode;
    const again = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (again?.inviteCode) return again.inviteCode;
  }
  return null;
}

/** The student whose invite link this person came through (remembered 30 days). */
export async function invitedByFromCookie(): Promise<string | null> {
  const code = (await cookies()).get(FRIEND_COOKIE)?.value?.toUpperCase();
  if (!code || !/^[A-Z0-9]{3,12}$/.test(code)) return null;
  const u = await db.query.users.findFirst({ where: and(eq(users.inviteCode, code), eq(users.accountType, "student")) });
  return u?.id ?? null;
}

/** Called when a student is verified: if they joined through a friend's link, both get $5. Safe to call twice. */
export async function grantInviteRewards(newStudentId: string) {
  const u = await db.query.users.findFirst({ where: eq(users.id, newStudentId) });
  if (!u?.invitedBy || u.invitedBy === newStudentId) return;
  const inviter = await db.query.users.findFirst({ where: eq(users.id, u.invitedBy) });
  if (!inviter || inviter.accountType !== "student") return;
  const made = await db.insert(inviteRewards).values([
    { userId: inviter.id, fromUserId: u.id, reason: "inviter", amountCents: INVITE_REWARD_CENTS },
    { userId: u.id, fromUserId: inviter.id, reason: "invitee", amountCents: INVITE_REWARD_CENTS },
  ]).onConflictDoNothing().returning();
  if (!made.length) return;
  try {
    const { inbox } = await import("./inbox");
    if (made.some((m) => m.userId === inviter.id)) await inbox(inviter.id, { kind: "invite_reward", title: "You earned $5", body: `${u.firstName ?? "Your friend"} joined Nearest with your link. $5 off your next booking is waiting.`, href: "/account#invite" });
    if (made.some((m) => m.userId === u.id)) await inbox(u.id, { kind: "invite_reward", title: "Welcome gift: $5 off", body: "You joined with a friend's link, so $5 off a booking is waiting for you.", href: "/credits" });
  } catch (e) { console.error(e); }
}

/**
 * The $5 that applies to a booking, if any: one available reward, only on the student's first booking with this
 * professional (the pro funds it). Never more than one per booking.
 */
export async function inviteRewardFor(studentId: string, proId: string, priceCents: number) {
  const [prior] = await db.select({ n: sql<number>`count(*)::int` }).from(bookings)
    .where(and(eq(bookings.studentId, studentId), eq(bookings.proId, proId), inArray(bookings.status, ["confirmed", "completed", "no_show"])));
  if (prior.n > 0) return null;
  const r = await db.query.inviteRewards.findFirst({ where: and(eq(inviteRewards.userId, studentId), eq(inviteRewards.status, "available")), orderBy: asc(inviteRewards.createdAt) });
  if (!r) return null;
  return { id: r.id, cents: Math.min(r.amountCents, priceCents) };
}

export async function reserveInviteReward(rewardId: string, bookingId: string) {
  const [row] = await db.update(inviteRewards).set({ status: "reserved", bookingId })
    .where(and(eq(inviteRewards.id, rewardId), eq(inviteRewards.status, "available"))).returning();
  return Boolean(row);
}

/** The booking was paid: its $5 is spent (even if the hold had lapsed and the reward went back in the meantime). */
export async function useInviteReward(bookingId: string, rewardId: string | null) {
  if (!rewardId) return;
  await db.update(inviteRewards).set({ status: "used", bookingId })
    .where(and(eq(inviteRewards.id, rewardId), inArray(inviteRewards.status, ["available", "reserved"])));
}

/** Give rewards back for bookings that were cancelled, or never paid. */
export async function restoreInviteRewards() {
  await db.execute(sql`update invite_rewards set status = 'available', booking_id = null
    where status in ('reserved','used') and booking_id in (select id from bookings where status in ('expired','cancelled_student','cancelled_pro'))`);
}

/** For the student's Account page. */
export async function inviteSummary(userId: string) {
  const [friends] = await db.select({
    joined: sql<number>`count(*)::int`,
    verified: sql<number>`count(*) filter (where ${studentProfiles.verificationStatus} = 'verified')::int`,
  }).from(users).leftJoin(studentProfiles, eq(studentProfiles.userId, users.id)).where(eq(users.invitedBy, userId));
  const [rewards] = await db.select({
    available: sql<number>`count(*) filter (where ${inviteRewards.status} = 'available')::int`,
    earned: sql<number>`count(*)::int`,
  }).from(inviteRewards).where(eq(inviteRewards.userId, userId));
  return { joined: friends.joined, verified: friends.verified, available: rewards.available, earned: rewards.earned };
}
