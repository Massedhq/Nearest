import "server-only";
import { and, eq, inArray, or } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import {
  db, users, adminMembers, bookings, messages, reviews, fines, incidents, credits, modelCalls, proOpenings, proBlocks,
  portfolioItems, proServices, proHours, proCredentials, membershipPayments, favorites, notifications, appeals, searchLog,
  studentIdDocs, schoolRequests, studentProfiles, professionalProfiles, invitations, activityLog,
} from "@/db";

/** A stand-in that keeps a deleted student's past bookings and reviews on the professional's record. It can't sign in. */
async function deletedPlaceholder() {
  const key = "system_deleted_account";
  const found = await db.query.users.findFirst({ where: eq(users.clerkUserId, key) });
  if (found) return found.id;
  const [u] = await db.insert(users).values({ clerkUserId: key, accountType: "staff", firstName: "Deleted", lastName: "account" }).onConflictDoNothing().returning();
  return u?.id ?? (await db.query.users.findFirst({ where: eq(users.clerkUserId, key) }))!.id;
}

async function removeLogin(clerkUserId: string) {
  try {
    await (await clerkClient()).users.deleteUser(clerkUserId);
  } catch (e) {
    console.error("Clerk delete failed (the Nearest account is already removed)", e);
  }
}

/**
 * Deletes a student or professional account.
 * - Refuses while any booking is confirmed (payment is being held) — cancel or complete it first.
 * - Student: personal data, credits, favorites and login are removed. Past bookings, reviews and reports stay on
 *   the professional's record under "Deleted account" so ratings and incident history stay accurate.
 * - Professional: the business and its bookings are removed. Credit students held with that pro becomes general
 *   Nearest credit, so no one loses value.
 * - Owners/admins are never deleted here; for an owner who also runs a pro business, only the business is removed.
 */
export async function deleteAccount(userId: string): Promise<{ ok?: string; error?: string }> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user || user.clerkUserId === "system_deleted_account") return { error: "Account not found." };
  const isAdmin = Boolean(await db.query.adminMembers.findFirst({ where: eq(adminMembers.userId, userId) }));
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "This account";

  // ---------- Student ----------
  if (user.accountType === "student" && !isAdmin) {
    const active = await db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.studentId, userId), eq(bookings.status, "confirmed")));
    if (active.length) return { error: `${name} has ${active.length} active booking${active.length === 1 ? "" : "s"} with payment held. Cancel or complete ${active.length === 1 ? "it" : "them"} first.` };
    const ph = await deletedPlaceholder();
    await db.update(bookings).set({ studentId: ph, locationAddress: null }).where(eq(bookings.studentId, userId));
    await db.update(reviews).set({ studentId: ph }).where(eq(reviews.studentId, userId));
    await db.update(incidents).set({ reporterId: ph }).where(eq(incidents.reporterId, userId));
    await db.update(messages).set({ senderId: ph }).where(eq(messages.senderId, userId));
    await db.delete(credits).where(eq(credits.studentId, userId));
    await db.delete(favorites).where(eq(favorites.studentId, userId));
    await db.delete(notifications).where(eq(notifications.userId, userId));
    await db.delete(appeals).where(eq(appeals.userId, userId));
    await db.update(searchLog).set({ studentId: null }).where(eq(searchLog.studentId, userId));
    await db.delete(studentIdDocs).where(eq(studentIdDocs.userId, userId));
    await db.delete(schoolRequests).where(eq(schoolRequests.userId, userId));
    await db.delete(studentProfiles).where(eq(studentProfiles.userId, userId));
    await db.update(activityLog).set({ actorUserId: null }).where(eq(activityLog.actorUserId, userId));
    await db.delete(users).where(eq(users.id, userId));
    await removeLogin(user.clerkUserId);
    return { ok: `Deleted ${name}'s student account.` };
  }

  // ---------- Professional (or an owner's professional business) ----------
  const pro = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, userId) });
  if (!pro && isAdmin) return { error: "Owner accounts can't be deleted here." };
  const active = await db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.proId, userId), eq(bookings.status, "confirmed")));
  if (active.length) return { error: `${name} has ${active.length} active booking${active.length === 1 ? "" : "s"} with payment held. Cancel or complete ${active.length === 1 ? "it" : "them"} first.` };

  const ids = (await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.proId, userId))).map((b) => b.id);
  if (ids.length) {
    await db.delete(messages).where(inArray(messages.bookingId, ids));
    await db.delete(reviews).where(inArray(reviews.bookingId, ids));
  }
  await db.delete(fines).where(or(eq(fines.proId, userId), ids.length ? inArray(fines.bookingId, ids) : undefined));
  if (ids.length) await db.delete(incidents).where(inArray(incidents.bookingId, ids));
  await db.update(credits).set({ proId: null }).where(eq(credits.proId, userId)); // students keep the value as general credit
  if (ids.length) {
    await db.update(credits).set({ bookingId: null }).where(inArray(credits.bookingId, ids));
    await db.delete(bookings).where(inArray(bookings.id, ids));
  }
  await db.delete(reviews).where(eq(reviews.proId, userId));
  await db.delete(modelCalls).where(eq(modelCalls.userId, userId));
  await db.delete(proOpenings).where(eq(proOpenings.userId, userId));
  await db.delete(proBlocks).where(eq(proBlocks.userId, userId));
  await db.delete(portfolioItems).where(eq(portfolioItems.userId, userId));
  await db.delete(proServices).where(eq(proServices.userId, userId));
  await db.delete(proHours).where(eq(proHours.userId, userId));
  await db.delete(proCredentials).where(eq(proCredentials.userId, userId));
  await db.delete(membershipPayments).where(eq(membershipPayments.proId, userId));
  await db.delete(favorites).where(eq(favorites.proId, userId));
  await db.delete(professionalProfiles).where(eq(professionalProfiles.userId, userId));

  if (isAdmin) {
    await db.update(users).set({ accountType: "staff" }).where(eq(users.id, userId));
    return { ok: `Removed the professional business from ${name}. Their owner login is unchanged.` };
  }
  await db.delete(notifications).where(eq(notifications.userId, userId));
  await db.delete(appeals).where(eq(appeals.userId, userId));
  await db.update(invitations).set({ registeredUserId: null }).where(eq(invitations.registeredUserId, userId));
  await db.update(activityLog).set({ actorUserId: null }).where(eq(activityLog.actorUserId, userId));
  await db.delete(users).where(eq(users.id, userId));
  await removeLogin(user.clerkUserId);
  return { ok: `Deleted ${name}'s professional account.` };
}

/** Why someone can't delete their own account right now (null = they can). */
export async function selfDeleteBlocker(userId: string): Promise<string | null> {
  const { bookings, fines } = await import("@/db");
  const { and, or, eq, inArray, gt, sql } = await import("drizzle-orm");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(bookings)
    .where(and(or(eq(bookings.studentId, userId), eq(bookings.proId, userId)), inArray(bookings.status, ["pending_payment", "confirmed"]), gt(bookings.endsAt, new Date(Date.now() - 48 * 3600_000))));
  if (n) return `You have ${n} upcoming appointment${n === 1 ? "" : "s"} that must be completed or cancelled first.`;
  const [{ f }] = await db.select({ f: sql<number>`count(*)::int` }).from(fines).where(and(eq(fines.proId, userId), eq(fines.status, "outstanding")));
  if (f) return `You have ${f} unpaid fine${f === 1 ? "" : "s"} to settle first (see Account status).`;
  return null;
}
