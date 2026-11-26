"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, adminMembers } from "@/db";
import { requireMainOwner } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { extraMenu, saveExtraMenu } from "@/lib/owner-menu";

type FormState = { error?: string; ok?: string };

/** Main owner: choose which extra pages another owner sees (their simple menu always stays). */
export async function saveOwnerMenu(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireMainOwner();
  const id = String(form.get("userId") ?? "");
  const m = /^[0-9a-f-]{36}$/.test(id) ? await db.query.adminMembers.findFirst({ where: eq(adminMembers.userId, id) }) : null;
  if (!m || m.role !== "OWNER" || id === user.id) return { error: "Pick another owner." };
  const before = await extraMenu(id);
  const after = await saveExtraMenu(id, form.getAll("href").map(String), user.id);
  await logActivity({ actorUserId: user.id, action: "team.owner_menu", targetType: "user", targetId: id, before, after });
  revalidatePath("/admin", "layout");
  return { ok: after.length ? `Saved — ${after.length} extra page${after.length > 1 ? "s" : ""} on their menu.` : "Saved — they have the simple menu only." };
}
