"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { db, users, invitations, professionalProfiles } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { deleteAccount } from "@/lib/accounts";
import type { FormState } from "@/components/ActionForm";

export async function deleteAccountAction(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const id = String(form.get("userId"));
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") return { error: 'Type DELETE to confirm.' };
  if (id === user.id) {
    // Your own professional business can go (e.g. a test business); your owner login never can.
    const ownBusiness = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, id) });
    if (!ownBusiness) return { error: "Your owner login can't be deleted." };
  }
  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  const res = await deleteAccount(id);
  if (res.ok) {
    await logActivity({ actorUserId: user.id, action: "account.deleted", targetType: target?.accountType ?? "user", targetId: `${target?.firstName ?? ""} ${target?.lastName ?? ""} (${target?.email ?? id})`.trim() });
    revalidatePath("/admin", "layout");
  }
  return res;
}

export async function deleteInvite(form: FormData) {
  const { user } = await requireAdmin();
  const [row] = await db.delete(invitations).where(and(eq(invitations.id, String(form.get("id"))), ne(invitations.status, "registered"))).returning();
  if (row) await logActivity({ actorUserId: user.id, action: "invite.deleted", targetType: "invitation", targetId: row.code, before: row.status });
  revalidatePath("/admin/founding");
  redirect("/admin/founding");
}
