"use server";
import { revalidatePath } from "next/cache";
import { requirePro } from "@/lib/pro";
import type { FormState } from "@/components/ActionForm";
import { readChoice, saveAgreement } from "@/lib/campaign-pro";
import { logActivity } from "@/lib/log";

/** Earlier pros (home card) agree and choose their free service (required — there is no decline), or an agreed pro changes the service until it is given. */
export async function optInCampaign(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requirePro({ self: true });
  if (!profile.entryPaidAt) return { error: "Submit your profile first — the free-service agreement is on the last setup page." };
  if (profile.campaignChoice !== "agreed" && form.get("campaignAgree") !== "on") return { error: "Tick the box to agree to give your one free service." };
  if (await (await import("@/lib/promo")).freeServiceGiven(user.id)) return { error: "You've already given your free service." };
  const choice = await readChoice(user.id, form);
  if ("error" in choice) return { error: choice.error };
  if (!choice.serviceId) return { error: "Choose the service you'll give for free (one listed at $25 or more)." };
  const first = profile.campaignChoice !== "agreed";
  await saveAgreement(user.id, choice);
  await logActivity({ actorUserId: user.id, action: first ? "pro.campaign_agreed" : "pro.campaign_updated", targetType: "professional", targetId: user.id, after: choice });
  revalidatePath("/pro", "layout");
  return { ok: first ? "Saved. Students with a Nearest Free Card can now request your free service." : "Saved." };
}
