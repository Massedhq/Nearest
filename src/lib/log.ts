import "server-only";
import { db, activityLog } from "@/db";

export async function logActivity(entry: {
  actorUserId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
}) {
  await db.insert(activityLog).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    before: entry.before === undefined ? null : entry.before,
    after: entry.after === undefined ? null : entry.after,
  });
  // Field team time (2026-11-26): a saved change turns the open time before it into worked time.
  try { const { bankWork } = await import("./field-goals"); await bankWork(entry.actorUserId); } catch { /* never block the action */ }
}
