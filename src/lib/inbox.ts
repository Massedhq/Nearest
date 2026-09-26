import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, notifications } from "@/db";

/** Adds a notification to someone's bell. Never throws. */
export async function inbox(userId: string | null | undefined, n: { kind: string; title: string; body?: string; href?: string; refId?: string }) {
  if (!userId) return;
  try {
    await db.insert(notifications).values({ userId, kind: n.kind, title: n.title, body: n.body ?? null, href: n.href ?? null, refId: n.refId ?? null });
  } catch (e) {
    console.error("Inbox insert failed", e);
  }
}

/** For chat: one unread "new message" per conversation, so the bell doesn't fill up. */
export async function inboxOnce(userId: string, refId: string, n: { kind: string; title: string; body?: string; href?: string }) {
  const existing = await db.query.notifications.findFirst({ where: and(eq(notifications.userId, userId), eq(notifications.refId, refId), eq(notifications.kind, n.kind), isNull(notifications.readAt)) });
  if (!existing) await inbox(userId, { ...n, refId });
}

export async function unreadCount(userId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return r?.n ?? 0;
}
