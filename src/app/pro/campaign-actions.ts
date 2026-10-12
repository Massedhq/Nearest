"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, professionalProfiles } from "@/db";
import { requirePro } from "@/lib/pro";
import type { FormState } from "@/components/ActionForm";
import { needsCampaignChoice, proOffer, readChoice, saveAgreement } from "@/lib/campaign-pro";
import { logActivity } from "@/lib/log";

/** Earlier pros (home card) opt in, or any agreed pro changes their free service / number of free appointments. */
export async function optInCampaign(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requirePro();
  if (!profile.entryPaidAt) return { error: "Submit your profile first — the free-service agreement is on the last setup page." };
  if (profile.campaignChoice !== "agreed" && form.get("campaignAgree") !== "on") return { error: "Tick the box to agree to the launch campaign free service." };
  const choice = await readChoice(user.id, form);
  if ("error" in choice) return { error: choice.error };
  if (!choice.serviceId) return { error: "Choose the service you'll give for free (one listed at $25 or more)." };
  const first = profile.campaignChoice !== "agreed";
  await saveAgreement(user.id, choice);
  await logActivity({ actorUserId: user.id, action: first ? "pro.campaign_opt_in" : "pro.campaign_updated", targetType: "professional", targetId: user.id, after: choice });
  revalidatePath("/pro", "layout");
  return { ok: first ? "You're in. Approved campaign students can now request your free service." : "Saved." };
}

/** Earlier pros only: "Decline" on the home card. Normal bookings are not affected. */
export async function declineCampaign() {
  const { user, profile } = await requirePro();
  if (!needsCampaignChoice(profile)) return;
  await db.update(professionalProfiles).set({ campaignChoice: "declined", campaignChoiceAt: new Date() }).where(eq(professionalProfiles.userId, user.id));
  await logActivity({ actorUserId: user.id, action: "pro.campaign_declined", targetType: "professional", targetId: user.id });
  revalidatePath("/pro", "layout");
}

/** An agreed pro pauses or resumes their free appointments (e.g. fully booked). */
export async function toggleCampaignOffer() {
  const { user } = await requirePro();
  const o = await proOffer(user.id);
  if (!o) return;
  const { campaignOffers } = await import("@/db");
  await db.update(campaignOffers).set({ active: !o.active }).where(eq(campaignOffers.id, o.id));
  revalidatePath("/pro", "layout");
}
