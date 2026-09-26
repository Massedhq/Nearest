"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { db, users, adminMembers } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { validName } from "@/lib/validate";
import { logActivity } from "@/lib/log";
import type { FormState } from "@/components/ActionForm";
import { PAYOUT_METHODS } from "@/lib/payout-methods";


/** Your own name — saved in Nearest and on your sign-in (Clerk) so they always match. */
export async function saveMyName(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const first = String(form.get("firstName") ?? "").trim();
  const last = String(form.get("lastName") ?? "").trim();
  if (!validName(first) || !validName(last)) return { error: "Enter your first and last name." };
  await db.update(users).set({ firstName: first, lastName: last, updatedAt: new Date() }).where(eq(users.id, user.id));
  try {
    await (await clerkClient()).users.updateUser(user.clerkUserId, { firstName: first, lastName: last });
  } catch (e) {
    console.error("Clerk name update failed", e);
  }
  await logActivity({ actorUserId: user.id, action: "profile.name", targetType: "owner", targetId: user.email ?? user.id, before: `${user.firstName} ${user.lastName}`, after: `${first} ${last}` });
  revalidatePath("/admin", "layout");
  return { ok: "Saved." };
}

/** Where you want your Sales Track payouts sent. Only you and the main owner can see it. */
export async function saveMyPayout(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const method = String(form.get("method") ?? "");
  const handle = String(form.get("handle") ?? "").trim().slice(0, 120);
  const note = String(form.get("note") ?? "").trim().slice(0, 300);
  if (!PAYOUT_METHODS.includes(method)) return { error: "Choose how you want to be paid." };
  if (!handle) return { error: "Add where to send it (for example your Zelle email or phone, or $cashtag)." };
  if (/\b\d{9,17}\b/.test(handle.replace(/[\s-]/g, "")) && method === "Bank transfer") {
    return { error: "For your safety, don't enter full bank account numbers here. Put your bank name and last 4 digits, and share the full details privately." };
  }
  await db.update(adminMembers).set({ payoutMethod: method, payoutHandle: handle, payoutNote: note || null }).where(eq(adminMembers.userId, user.id));
  await logActivity({ actorUserId: user.id, action: "profile.payout_details", targetType: "owner", targetId: user.email ?? user.id, after: method });
  revalidatePath("/admin", "layout");
  return { ok: "Payout details saved." };
}
