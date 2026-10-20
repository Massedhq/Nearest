"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import type { FormState } from "@/components/ActionForm";

/** Owners only: authorize the one additional opening (5 more spots, 10 max) for a city + category. */
export async function authorizeOpening(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const cityId = Number(form.get("cityId")), categoryId = Number(form.get("categoryId"));
  if (!Number.isInteger(cityId) || !Number.isInteger(categoryId)) return { error: "Choose a city and category." };
  if (form.get("confirm") !== "on") return { error: "Tick the box to confirm. This can't be undone, and it's the only additional opening for this city and category." };
  const { authorizeSecondOpening, slotCount, slotLimits } = await import("@/lib/slots");
  const { firstIn } = await slotLimits();
  if ((await slotCount(cityId, categoryId)) < firstIn) return { error: `The first ${firstIn} spots aren't all taken yet — the additional opening is only for a closed category.` };
  const r = await authorizeSecondOpening(cityId, categoryId, user.id, String(form.get("note") ?? "").slice(0, 300));
  if ("error" in r) return { error: r.error };
  revalidatePath("/admin/outreach/markets");
  revalidatePath("/admin/service-coverage");
  return { ok: `Additional opening authorized — this category is now open to 10 in total. ${r.notified} professional${r.notified === 1 ? "" : "s"} on the waitlist were told.` };
}
