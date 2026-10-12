import "server-only";
import { and, asc, eq, gte } from "drizzle-orm";
import { db, campaignOffers, professionalProfiles, proServices } from "@/db";
import { CAMPAIGN_KEY } from "./campaign";

/** The free campaign service must be one of the professional's services listed at $25 or more. */
export const MIN_REWARD_CENTS = 2500;
export const DEFAULT_FREE_APPOINTMENTS = 5;
export const MAX_FREE_APPOINTMENTS = 50;

export const PRO_CAMPAIGN_AGREEMENT =
  "I agree to honor the Nearest launch campaign reward: a student approved by Nearest can book one free appointment for the service I choose below (listed at $25 or more), at no charge to the student, and I receive no payout for that appointment. I choose how many free appointments I give.";

export type ProProfile = typeof professionalProfiles.$inferSelect;

/** Services this professional can offer as the free service (active, listed at $25+). */
export async function rewardEligibleServices(proId: string) {
  return db.select({ id: proServices.id, name: proServices.name, priceCents: proServices.priceCents, durationMin: proServices.durationMin })
    .from(proServices)
    .where(and(eq(proServices.userId, proId), eq(proServices.active, true), gte(proServices.priceCents, MIN_REWARD_CENTS)))
    .orderBy(asc(proServices.sort));
}

export async function proOffer(proId: string) {
  return db.query.campaignOffers.findFirst({ where: and(eq(campaignOffers.campaignKey, CAMPAIGN_KEY), eq(campaignOffers.proId, proId)) });
}

/** Pros who joined before the free-service checkbox existed haven't answered yet → they get the home-screen card. */
export function needsCampaignChoice(p: ProProfile) {
  return Boolean(p.entryPaidAt) && !p.campaignChoice;
}

/** Read and validate the service + number of free appointments from a form. serviceId may be empty (choose later). */
export async function readChoice(proId: string, form: FormData): Promise<{ serviceId: string | null; slots: number } | { error: string }> {
  const serviceId = String(form.get("campaignServiceId") ?? "").trim() || null;
  const slots = Number(String(form.get("campaignSlots") ?? DEFAULT_FREE_APPOINTMENTS).trim());
  if (!Number.isInteger(slots) || slots < 1 || slots > MAX_FREE_APPOINTMENTS) return { error: `Free appointments must be a whole number from 1 to ${MAX_FREE_APPOINTMENTS}.` };
  if (serviceId && !(await rewardEligibleServices(proId)).some((s) => s.id === serviceId)) return { error: "Choose one of your services listed at $25 or more." };
  return { serviceId, slots };
}

/**
 * Record "agreed" and save the professional's free service. Their one campaign_offers row is created or updated
 * (payout $0). Lowering the number never goes below appointments already used.
 */
export async function saveAgreement(proId: string, choice: { serviceId: string | null; slots: number }) {
  await db.update(professionalProfiles).set({ campaignChoice: "agreed", campaignChoiceAt: new Date() }).where(eq(professionalProfiles.userId, proId));
  if (!choice.serviceId) return;
  const existing = await proOffer(proId);
  if (existing) {
    await db.update(campaignOffers).set({
      serviceId: choice.serviceId, slotsTotal: Math.max(choice.slots, existing.slotsUsed), payoutCents: 0, active: true,
      confirmedAt: existing.confirmedAt ?? new Date(), confirmedBy: proId,
    }).where(eq(campaignOffers.id, existing.id));
  } else {
    await db.insert(campaignOffers).values({
      campaignKey: CAMPAIGN_KEY, proId, serviceId: choice.serviceId, payoutCents: 0, slotsTotal: choice.slots,
      agreementNote: "Agreed in the app", confirmedBy: proId, confirmedAt: new Date(),
    });
  }
}
