"use server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, bookings } from "@/db";
import { requireBrowsingStudent } from "@/lib/student";
import { addCardToAccount, cardLabel } from "@/lib/nearest-cards";
import { applyCredits, creditBalances } from "@/lib/credits";
import { money } from "@/lib/time";

type FormState = { error?: string; ok?: string };

/** Add a Nearest Card to the signed-in student's account (Cards & activations, checkout, or a booking waiting for payment). */
export async function addNearestCard(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireBrowsingStudent();
  const r = await addCardToAccount(user.id, String(form.get("number") ?? ""), String(form.get("code") ?? ""));
  if (!r.ok) return { error: r.error };
  // On a booking that's waiting for payment, use the new credit on it right away so the amount shown is current.
  const bookingId = String(form.get("bookingId") ?? "");
  if (/^[0-9a-f-]{36}$/.test(bookingId)) {
    const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, bookingId), eq(bookings.studentId, user.id), inArray(bookings.status, ["requested", "pending_payment"])) });
    if (b && !b.bundleId) {
      const use = applyCredits(b.priceCents - b.inviteDiscountCents, await creditBalances(user.id, b.proId));
      await db.update(bookings).set({ creditProCents: use.pro, creditGeneralCents: use.general, chargedCents: use.charge }).where(eq(bookings.id, b.id));
    }
    revalidatePath(`/bookings/${bookingId}`);
  }
  const back = String(form.get("back") ?? "");
  if (back.startsWith("/") && !back.startsWith("//")) revalidatePath(back.split("?")[0]);
  revalidatePath("/cards");
  revalidatePath("/credits");
  const what = r.kind === "free" ? `${cardLabel(r.kind)} added — it covers a service up to ${money(r.amountCents)}` : `${cardLabel(r.kind)} added — ${money(r.amountCents)} off`;
  return { ok: `${what}. It's saved on your account (•••• ${r.last4}) and applies automatically at checkout.` };
}
