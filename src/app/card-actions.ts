"use server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, bookings } from "@/db";
import { requireBrowsingStudent } from "@/lib/student";
import { addCardToAccount, planWithCard, setBookingCard } from "@/lib/nearest-cards";
import { creditBalances } from "@/lib/credits";

type FormState = { error?: string; ok?: string };

/** Save a Nearest Card on the signed-in student's account (Cards & activations, checkout, or a booking waiting for payment). Never applies it. */
export async function addNearestCard(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireBrowsingStudent();
  const r = await addCardToAccount(user.id, String(form.get("number") ?? ""), String(form.get("code") ?? ""));
  if (!r.ok) return { error: r.error };
  const back = String(form.get("back") ?? "");
  if (back.startsWith("/") && !back.startsWith("//")) revalidatePath(back.split("?")[0]);
  revalidatePath("/cards");
  return { ok: "Your card was successfully saved to your account. You may use it anytime during checkout." };
}

/** The student picks a card for a booking that's a request or waiting for payment — or takes it off ("none"). */
export async function chooseBookingCard(form: FormData) {
  const { user } = await requireBrowsingStudent();
  const bookingId = String(form.get("bookingId") ?? "");
  const cardId = String(form.get("cardId") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(bookingId)) return;
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, bookingId), eq(bookings.studentId, user.id), inArray(bookings.status, ["requested", "pending_payment"])) });
  if (!b || b.bundleId) return;
  const valid = /^[0-9a-f-]{36}$/.test(cardId) ? cardId : null;
  // Cards are honored by the professional: only pros who accepted those Terms, and a Free Card only on their free service.
  const { cardProblem, promoCap } = await import("@/lib/promo");
  if (valid && (await cardProblem(valid, b.proId, b.serviceId, { modelCall: Boolean(b.modelCallId), bookingId: b.id }))) { revalidatePath(`/bookings/${b.id}`); return; }
  const r = await setBookingCard(user.id, b.id, valid);
  const amount = r.ok ? r.amountCents : 0;
  const use = planWithCard(b.priceCents - b.inviteDiscountCents, await creditBalances(user.id, b.proId), amount, promoCap(b));
  await db.update(bookings).set({ cardId: use.card > 0 && r.ok && cardId ? cardId : null, cardCents: use.card, promoCents: use.promoCents, creditProCents: use.pro, creditGeneralCents: use.general, chargedCents: use.charge }).where(eq(bookings.id, b.id));
  revalidatePath(`/bookings/${b.id}`);
  revalidatePath("/cards");
}
