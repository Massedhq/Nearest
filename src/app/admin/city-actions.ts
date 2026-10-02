"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { activateCity } from "@/lib/city-activation";

type FormState = { error?: string; ok?: string };

/** Owner: open a city for booking — starts the waiting pros' memberships and lets students book there. */
export async function openCityBooking(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const cityId = Number(form.get("cityId"));
  if (!Number.isInteger(cityId) || cityId <= 0) return { error: "Choose a city." };
  if (form.get("confirm") !== "on") return { error: "Check the box to confirm — this starts memberships on saved cards." };
  try {
    const r = await activateCity(cityId, user.id);
    revalidatePath("/admin/service-coverage");
    return { ok: `Booking is open. ${r.started} membership${r.started === 1 ? "" : "s"} started, ${r.extended} moved to 30 days from today, ${r.cardFailed} card${r.cardFailed === 1 ? "" : "s"} declined (7 days to fix), ${r.released} spot${r.released === 1 ? "" : "s"} released, ${r.students} student${r.students === 1 ? "" : "s"} notified.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
