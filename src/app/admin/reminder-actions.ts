"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { sendSetupReminderNow, unfinishedSetupIds } from "@/lib/setup-reminders";

type FormState = { error?: string; ok?: string };

/** Send one pro a "finish setting up" reminder now. */
export async function remindProSetup(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const id = String(form.get("userId") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return { error: "Not found." };
  const r = await sendSetupReminderNow(id);
  if (r === "not_needed") return { error: "This professional has already submitted their profile." };
  if (r === "recent") return { error: "They were reminded in the last 12 hours — try again later." };
  await logActivity({ actorUserId: user.id, action: "pro.setup_reminded", targetType: "professional", targetId: id });
  revalidatePath(`/admin/professionals/${id}`);
  return { ok: "Reminder sent (email + notification)." };
}

/** Remind every professional who paid but hasn't submitted their profile. */
export async function remindAllProSetup(_: FormState): Promise<FormState> {
  const { user } = await requireAdmin();
  const ids = await unfinishedSetupIds();
  let sent = 0, recent = 0;
  for (const id of ids) {
    const r = await sendSetupReminderNow(id);
    if (r === "sent") sent++;
    else if (r === "recent") recent++;
  }
  await logActivity({ actorUserId: user.id, action: "pro.setup_reminded_all", targetType: "professional", targetId: "all", after: { sent, recent } });
  revalidatePath("/admin/professionals");
  if (!ids.length) return { ok: "Everyone who paid has finished setup." };
  return { ok: `Sent ${sent} reminder${sent === 1 ? "" : "s"}.${recent ? ` Skipped ${recent} reminded in the last 12 hours.` : ""}` };
}
