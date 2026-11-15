"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, tapLinks } from "@/db";
import { requireAdmin, isMainOwner } from "@/lib/admin";
import { logActivity } from "@/lib/log";

/** Pause / resume a GRANTED tap link — main owner only (she manages every tap card). Logged. */
export async function setTapActive(form: FormData) {
  const { user } = await requireAdmin();
  const userId = String(form.get("userId") ?? "");
  const on = String(form.get("on") ?? "") === "1";
  if (!/^[0-9a-f-]{36}$/.test(userId)) return;
  if (!(await isMainOwner(user.id))) return;
  const before = (await db.select().from(tapLinks).where(eq(tapLinks.userId, userId)))[0];
  if (!before) return;
  await db.update(tapLinks).set({ active: on, updatedAt: new Date() }).where(eq(tapLinks.userId, userId));
  await logActivity({ actorUserId: user.id, action: on ? "vouchers.tap_resumed" : "vouchers.tap_paused", targetType: "tap_link", targetId: userId, before: { active: before.active }, after: { active: on } });
  revalidatePath("/admin/my-vouchers");
  revalidatePath(`/admin/vouchers/d/${userId}`);
  revalidatePath("/admin/cards");
}
