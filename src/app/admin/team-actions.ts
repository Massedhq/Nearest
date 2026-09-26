"use server";
import { revalidatePath } from "next/cache";
import { and, eq, gt, lte } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { db, users, adminMembers, invitations } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { deleteAccount } from "@/lib/accounts";
import type { FormState } from "@/components/ActionForm";

/**
 * Repairs an owner login that had a professional sign-up written onto it (the old invite bug):
 * restores the owner's real name from their Clerk login, removes the attached professional business,
 * and reopens the invitation it used so the real professional can register with their own account.
 */
export async function restoreOwner(_: FormState, form: FormData): Promise<FormState> {
  const { user: me } = await requireAdmin();
  const id = String(form.get("userId"));
  const member = await db.query.adminMembers.findFirst({ where: eq(adminMembers.userId, id) });
  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!member || !target) return { error: "Owner not found." };

  let first = target.firstName, last = target.lastName;
  try {
    const cu = await (await clerkClient()).users.getUser(target.clerkUserId);
    first = cu.firstName ?? null;
    last = cu.lastName ?? null;
  } catch (e) {
    console.error("Couldn't read Clerk profile", e);
  }

  // Reopen the invitation(s) this account used by mistake.
  const now = new Date();
  await db.update(invitations).set({ status: "invited", registeredUserId: null }).where(and(eq(invitations.registeredUserId, id), gt(invitations.expiresAt, now)));
  await db.update(invitations).set({ status: "expired", registeredUserId: null }).where(and(eq(invitations.registeredUserId, id), lte(invitations.expiresAt, now)));

  // Remove the attached professional business (keeps the owner login) and restore the owner's details.
  const res = await deleteAccount(id);
  if (res.error && !res.error.startsWith("Owner accounts can't")) return res;
  await db.update(users).set({ accountType: "staff", firstName: first, lastName: last, dateOfBirth: null, updatedAt: new Date() }).where(eq(users.id, id));

  await logActivity({ actorUserId: me.id, action: "owner.restored", targetType: "owner", targetId: target.email ?? id, before: `${target.firstName} ${target.lastName}`, after: `${first ?? ""} ${last ?? ""}`.trim() });
  revalidatePath("/admin", "layout");
  return { ok: `Restored. This owner login is ${`${first ?? ""} ${last ?? ""}`.trim() || target.email} again, with no professional business attached. The invitation it used is open again.` };
}
