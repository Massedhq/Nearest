"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, professionalProfiles } from "@/db";
import { requirePro } from "@/lib/pro";
import type { FormState } from "@/components/ActionForm";
import { PRO_TERMS_VERSION } from "@/lib/pro-terms";
import { logActivity } from "@/lib/log";

/** Already-enrolled pros accept an updated version of the Professional Terms (version, time and IP are stored). */
export async function acceptUpdatedProTerms(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requirePro();
  if (!profile.entryPaidAt) return { error: "You'll accept the Professional Terms when you submit your profile." };
  if (form.get("acceptTerms") !== "on" || String(form.get("termsVersion")) !== PRO_TERMS_VERSION) return { error: "Scroll through and accept the updated Professional Terms." };
  const { headers } = await import("next/headers");
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64) || null;
  await db.update(professionalProfiles).set({ proTermsVersion: PRO_TERMS_VERSION, proTermsAcceptedAt: new Date(), proTermsIp: ip }).where(eq(professionalProfiles.userId, user.id));
  await logActivity({ actorUserId: user.id, action: "pro.terms_updated", targetType: "professional", targetId: user.id, before: profile.proTermsVersion, after: { version: PRO_TERMS_VERSION, ip } });
  revalidatePath("/pro", "layout");
  return { ok: "Thanks — you've accepted the updated Professional Terms." };
}
