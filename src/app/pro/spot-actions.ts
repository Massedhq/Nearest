"use server";
import { revalidatePath } from "next/cache";
import { requirePro } from "@/lib/pro";
import type { FormState } from "@/components/ActionForm";

/** A released professional takes their city + category spot back (only if their city still has room). */
export async function reclaimMySpot(_: FormState): Promise<FormState> {
  const { user } = await requirePro({ self: true });
  const r = await (await import("@/lib/no-membership")).reclaimSpot(user.id);
  revalidatePath("/pro", "layout");
  return "error" in r ? { error: r.error } : { ok: r.ok };
}
