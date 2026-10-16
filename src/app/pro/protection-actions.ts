"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, professionalProfiles } from "@/db";
import { requirePro } from "@/lib/pro";
import type { FormState } from "@/components/ActionForm";
import { readProtection } from "@/lib/insurance";

/** Saves (or changes) a professional's self-reported Professional Protection preference. Nothing is charged. */
export async function saveProtection(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePro();
  const v = readProtection(form);
  if (!v) return { error: "Choose one of the three options." };
  if ("error" in v) return { error: v.error };
  await db.update(professionalProfiles).set({ insuranceChoice: v.choice, insuranceInterest: v.interest, insuranceChoiceAt: new Date() }).where(eq(professionalProfiles.userId, user.id));
  revalidatePath("/pro", "layout");
  return { ok: v.choice === "interested" ? "Thanks — we'll keep you posted as Nearest's insurance partner options come together." : "Saved. You can change this anytime." };
}
