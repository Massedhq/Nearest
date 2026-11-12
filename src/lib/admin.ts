import "server-only";
import { redirect } from "next/navigation";
import { getViewer, ensureOwner, destinationFor } from "./viewer";

/** Use at the top of every admin page and admin server action. */
export async function requireAdmin(opts: { owner?: boolean } = {}) {
  const viewer = await ensureOwner(await getViewer());
  if (!viewer) redirect("/admin/sign-in");
  if (!viewer.admin || !viewer.user) redirect(await destinationFor(viewer));
  if (opts.owner && viewer.admin.role !== "OWNER") throw new Error("Only an owner can do this.");
  return { user: viewer.user, role: viewer.admin.role, viewer };
}

/** True when this admin is the main owner (Avy). Partner pages and Nearest Cards are hers alone. */
export async function isMainOwner(userId: string) {
  const { mainOwnerId } = await import("./partner");
  return (await mainOwnerId()) === userId;
}

/** Main owner only — pages call this and get a 404 for anyone else; actions get an error. */
export async function requireMainOwner(opts: { page?: boolean } = {}) {
  const a = await requireAdmin();
  if (!(await isMainOwner(a.user.id))) {
    if (opts.page) { const { notFound } = await import("next/navigation"); notFound(); }
    throw new Error("Only the main owner can do this.");
  }
  return a;
}

/**
 * Activity log visibility (owner rule, 2026-11-07): the main owner sees everyone's activity; other owners and staff never
 * see the main owner's own activity (or the automatic Nearest Cards changes).
 */
export async function activityVisibleTo(userId: string) {
  const { sql } = await import("drizzle-orm");
  const { activityLog } = await import("@/db");
  const { mainOwnerId } = await import("./partner");
  const main = await mainOwnerId();
  if (!main || main === userId) return undefined;
  // GRANTED voucher records (vouchers.*) are private to each distributor: others see only their own.
  return sql`(${activityLog.actorUserId} is distinct from ${main} and not (${activityLog.actorUserId} is null and ${activityLog.action} like 'cards.%')
    and (${activityLog.action} not like 'vouchers.%' or ${activityLog.actorUserId} = ${userId}))`;
}
