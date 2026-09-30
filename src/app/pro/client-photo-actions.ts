"use server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, bookings, portfolioItems, reviews } from "@/db";
import { requirePro } from "@/lib/pro";
import type { FormState } from "@/components/ActionForm";

const MAX_PORTFOLIO = 10;

/** A client photo from one of this pro's own appointments. */
async function mine(form: FormData) {
  const { user } = await requirePro();
  const id = String(form.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, id), eq(bookings.proId, user.id)) });
  return b?.photoUrl ? { user, b } : null;
}

function refresh(proId: string) {
  revalidatePath("/pro/client-photos");
  revalidatePath("/pro", "layout");
  revalidatePath(`/p/${proId}`);
}

/** Show the photo under that client's review — only if the client allowed sharing and left a review. */
export async function showWithReview(_: FormState, form: FormData): Promise<FormState> {
  const m = await mine(form);
  if (!m) return { error: "That photo isn't available." };
  if (!m.b.photoForPortfolio) return { error: "This client didn't allow their photo to be shared, so it stays private." };
  const rev = await db.query.reviews.findFirst({ where: eq(reviews.bookingId, m.b.id) });
  if (!rev) return { error: "This client didn't leave a review, so there's no review to show it with. You can add it to your portfolio instead." };
  await db.update(bookings).set({ photoStatus: "shown" }).where(eq(bookings.id, m.b.id));
  refresh(m.user.id);
  return { ok: "Showing with their review." };
}

/** Take it off the review — back to private. */
export async function hideFromReview(_: FormState, form: FormData): Promise<FormState> {
  const m = await mine(form);
  if (!m) return { error: "That photo isn't available." };
  await db.update(bookings).set({ photoStatus: null }).where(eq(bookings.id, m.b.id));
  refresh(m.user.id);
  return { ok: "Hidden from the review. It's private again." };
}

/** Copy it into the pro's public portfolio — their choice, and only if the client allowed sharing. */
export async function addClientPhotoToPortfolio(_: FormState, form: FormData): Promise<FormState> {
  const m = await mine(form);
  if (!m) return { error: "That photo isn't available." };
  if (!m.b.photoForPortfolio) return { error: "This client didn't allow their photo to be shared, so it can't go in your portfolio." };
  const already = await db.query.portfolioItems.findFirst({ where: and(eq(portfolioItems.userId, m.user.id), eq(portfolioItems.fromBookingId, m.b.id)) });
  if (already) return { ok: "It's already in your portfolio." };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(portfolioItems).where(and(eq(portfolioItems.userId, m.user.id), eq(portfolioItems.kind, "image")));
  if (n >= MAX_PORTFOLIO) return { error: `Your portfolio already has ${MAX_PORTFOLIO} photos. Remove one first, then add this.` };
  await db.insert(portfolioItems).values({ userId: m.user.id, url: m.b.photoUrl!, source: "nearest", fromBookingId: m.b.id, serviceId: m.b.serviceId, sort: Date.now() % 1_000_000 });
  refresh(m.user.id);
  return { ok: "Added to your portfolio." };
}

/** Remove it from Client photos (and from the review). A copy already in the portfolio stays until removed there. */
export async function removeClientPhoto(_: FormState, form: FormData): Promise<FormState> {
  const m = await mine(form);
  if (!m) return { error: "That photo isn't available." };
  await db.update(bookings).set({ photoStatus: "removed" }).where(eq(bookings.id, m.b.id));
  refresh(m.user.id);
  return { ok: "Removed." };
}
