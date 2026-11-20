import { sql, type SQL } from "drizzle-orm";
import { modelCalls } from "@/db";
import { MAX_PRICE_CENTS } from "./pricing";

/**
 * Model Calls (2026-11-20, owner):
 * - 1–3 inspiration photos are REQUIRED; a call without one never shows to anyone (older calls stay hidden until the pro
 *   adds a photo). Optional video ≤ 60 s.
 * - show_on: student (student side only) | partner (the public partner page only) | both.
 * - Two prices: student price (≤ $150 incl. fee) and public price (partner page, no cap). Each side shows only its own.
 * - pay_mode: full, or deposit — the model pays the pro's deposit + the booking fee online and the rest to the pro at the
 *   appointment (bookings.balance_due_cents, outside Nearest).
 */
export const MC_MIN_PHOTOS = 1;
export const MC_MAX_PHOTOS = 3;

type Call = typeof modelCalls.$inferSelect;
export type Side = "student" | "partner";

/** The call's inspiration photos (older calls kept their one photo in photo_url). */
export function callPhotos(c: Pick<Call, "photos" | "photoUrl">): string[] {
  const list = Array.isArray(c.photos) ? c.photos.filter((u) => typeof u === "string" && u) : [];
  return list.length ? list.slice(0, MC_MAX_PHOTOS) : c.photoUrl ? [c.photoUrl] : [];
}
export const callReady = (c: Pick<Call, "photos" | "photoUrl">) => callPhotos(c).length >= MC_MIN_PHOTOS;

/** SQL: has at least one inspiration photo. */
export const READY_SQL: SQL = sql`(coalesce(jsonb_array_length(${modelCalls.photos}), 0) >= ${MC_MIN_PHOTOS} or ${modelCalls.photoUrl} is not null)`;
/** SQL: shows on the student side (ready, student/both, student price within the cap). */
export const STUDENT_SIDE_SQL: SQL = sql`(${READY_SQL} and ${modelCalls.showOn} in ('student', 'both') and ${modelCalls.priceCents} <= ${MAX_PRICE_CENTS})`;
/** SQL: shows on the public partner page (ready, partner/both, has a public price). */
export const PARTNER_SIDE_SQL: SQL = sql`(${READY_SQL} and ${modelCalls.showOn} in ('partner', 'both') and ${modelCalls.publicPriceCents} is not null)`;

export const onSide = (c: Call, side: Side) => callReady(c) && (side === "student"
  ? (c.showOn === "student" || c.showOn === "both") && c.priceCents <= MAX_PRICE_CENTS
  : (c.showOn === "partner" || c.showOn === "both") && c.publicPriceCents != null);

/** Full price on a side (what the model's service costs, incl. Nearest's booking fee). */
export const sidePriceOf = (c: Call, side: Side) => (side === "partner" ? c.publicPriceCents ?? c.priceCents : c.priceCents);

/**
 * What the model pays online now and what's left for the appointment.
 * full → everything online. deposit → the pro's deposit + the booking fee online, the rest at the appointment.
 */
export function callCharge(c: Call, side: Side): { onlineCents: number; balanceDueCents: number; totalCents: number; deposit: boolean } {
  const total = sidePriceOf(c, side);
  if (c.payMode !== "deposit" || !c.depositProCents || total <= 0) return { onlineCents: total, balanceDueCents: 0, totalCents: total, deposit: false };
  const online = Math.min(total, c.depositProCents + c.serviceFeeCents);
  return { onlineCents: online, balanceDueCents: total - online, totalCents: total, deposit: online < total };
}

export const SHOW_ON_LABEL: Record<string, string> = { student: "Student side", partner: "Partner page (public)", both: "Student side + partner page" };
