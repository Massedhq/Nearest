"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, professionalProfiles, studentIdDocs } from "@/db";
import { requirePro } from "@/lib/pro";
import type { FormState } from "@/components/ActionForm";

const DATA_URL = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/;

/** Professionals: photo of a driver's license or state ID + live selfie, reviewed by Nearest (no third-party screens). */
export async function submitProIdDocs(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requirePro();
  if (profile.identityStatus === "verified") return { ok: "Your ID is already verified." };
  const docs: { kind: string; b64: string }[] = [];
  for (const kind of ["gov_id", "selfie"]) {
    const m = DATA_URL.exec(String(form.get(kind) ?? ""));
    if (!m) return { error: kind === "gov_id" ? "Take a photo of your driver's license or state ID." : "Take a selfie." };
    if (m[1].length > 1_400_000) return { error: "That photo is too large. Try again." };
    docs.push({ kind, b64: m[1] });
  }
  for (const d of docs) {
    await db.insert(studentIdDocs).values({ userId: user.id, kind: d.kind, mime: "image/jpeg", dataB64: d.b64 })
      .onConflictDoUpdate({ target: [studentIdDocs.userId, studentIdDocs.kind], set: { dataB64: d.b64, createdAt: new Date() } });
  }
  await db.update(professionalProfiles).set({ identityStatus: "pending" }).where(eq(professionalProfiles.userId, user.id));
  revalidatePath("/pro", "layout");
  revalidatePath("/admin", "layout");
  return { ok: "Sent. Nearest is checking your ID — usually within a day." };
}
