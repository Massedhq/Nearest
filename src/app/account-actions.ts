"use server";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { deleteAccount, selfDeleteBlocker } from "@/lib/accounts";
import { logActivity } from "@/lib/log";
import type { FormState } from "@/components/ActionForm";

/** Students and professionals delete their own account (owners: removes only their pro business). */
export async function deleteMyAccount(_: FormState, form: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer?.user) redirect("/sign-in");
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") return { error: "Type DELETE to confirm." };
  const blocked = await selfDeleteBlocker(viewer.user.id);
  if (blocked) return { error: blocked };
  const who = `${viewer.user.firstName ?? ""} ${viewer.user.lastName ?? ""}`.trim() || viewer.user.email || viewer.user.id;
  const r = await deleteAccount(viewer.user.id);
  if (r.error) return { error: r.error };
  await logActivity({ actorUserId: null, action: "account.self_deleted", targetType: viewer.user.accountType, targetId: who });
  redirect(viewer.admin ? "/workspace" : "/?deleted=1");
}
