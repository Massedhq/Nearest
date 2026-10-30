"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, bookings } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import type { FormState } from "@/components/ActionForm";

/** Student: allow or stop the pro's photos/videos from showing with their review. Changeable anytime. */
export async function setReviewMediaConsent(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireVerifiedStudent();
  const id = String(form.get("id") ?? "");
  const choice = String(form.get("choice") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id) || !["approved", "declined"].includes(choice)) return { error: "Not found." };
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, id), eq(bookings.studentId, user.id)) });
  if (!b || !(b.reviewMedia ?? []).length) return { error: "Not found." };
  await db.update(bookings).set({ reviewMediaConsent: choice }).where(eq(bookings.id, b.id));
  try {
    const { inbox } = await import("@/lib/inbox");
    await inbox(b.proId, { kind: "review_media", title: choice === "approved" ? "Your client approved your photos" : "Your client chose not to share your photos", body: `${b.serviceName} — ${choice === "approved" ? "they show with their review." : "they stay private."}`, href: `/pro/appointments/${b.id}` });
  } catch (e) { console.error(e); }
  revalidatePath(`/bookings/${b.id}`);
  revalidatePath(`/p/${b.proId}`);
  return { ok: choice === "approved" ? "Thanks — they'll show with your review." : "Got it — they won't be shown." };
}
