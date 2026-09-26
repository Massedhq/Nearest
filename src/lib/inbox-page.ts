import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, notifications } from "@/db";

/** Loads someone's latest notifications, then marks them read. */
export async function openInbox(userId: string) {
  const items = await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(60);
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return items;
}
