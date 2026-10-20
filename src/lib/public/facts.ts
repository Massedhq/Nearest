import "server-only";
import { SETTINGS } from "@/lib/settings-defaults";
import { MAX_PRICE_DOLLARS } from "@/lib/pricing";

/**
 * Product facts quoted on public pages, read from the live rules engine (platform_settings) so the public site never
 * goes stale when an owner changes a rule. Falls back to the coded defaults if the database can't be reached.
 */
export type PublicFacts = {
  feeDollars: number; capDollars: number; advanceHours: number; sameDayCutoff: string; sameDayNoticeHours: number;
  graceMinutes: number; checkinFeet: number; depositDollars: number; cancelHours: number; firstInPerCategory: number;
  capPerCategory: number; firstInTotal: number; requestHours: number; payHours: number; categories: string[];
};

const FALLBACK_CATEGORIES = ["Hair", "Braids", "Locs", "Barber", "Lashes", "Brows", "Nails", "Makeup", "Photography", "Esthetician/Skincare", "Hair Removal", "Massage", "Body & Wellness", "Tattoos & Piercings", "Fitness", "Personal Styling", "Grooming"];

const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export async function publicFacts(): Promise<PublicFacts> {
  let s: Record<string, unknown> = Object.fromEntries(Object.entries(SETTINGS).map(([k, d]) => [k, d.value]));
  let categories = FALLBACK_CATEGORIES;
  try {
    const { getSettings } = await import("@/lib/settings");
    s = await getSettings();
    const { db, categories: cats } = await import("@/db");
    const { asc, eq } = await import("drizzle-orm");
    const rows = await db.select({ name: cats.name }).from(cats).where(eq(cats.active, true)).orderBy(asc(cats.sort), asc(cats.name));
    const names = rows.map((r) => r.name).filter((n) => n !== "Other");
    if (names.length) categories = names;
  } catch (e) { console.warn("public facts: using coded defaults —", (e as Error).message?.split("\n")[0]); }
  const n = (k: string, d: number) => (Number.isFinite(Number(s[k])) ? Number(s[k]) : d);
  return {
    feeDollars: n("fees.service_fee_cents", 500) / 100,
    capDollars: MAX_PRICE_DOLLARS,
    advanceHours: n("booking.advance_hours", 24),
    sameDayCutoff: clock(String(s["booking.same_day_cutoff"] ?? "12:00")),
    sameDayNoticeHours: n("booking.same_day_min_notice_hours", 4),
    graceMinutes: n("appt.grace_minutes", 15),
    checkinFeet: n("appt.checkin_radius_ft", 100),
    depositDollars: n("appt.deposit_cents", 500) / 100,
    cancelHours: n("cancel.cutoff_hours", 24),
    firstInPerCategory: n("growth.target_per_category", 5),
    capPerCategory: n("growth.cap_per_category", 10),
    firstInTotal: n("growth.founding_capacity", 750),
    requestHours: 24, // requestDeadline() in src/lib/requests.ts: 24 h, or 2 h before the start
    payHours: 12, // paymentDeadline(): 12 h after acceptance, or 1 h before the start
    categories,
  };
}

/** "$5" / "$5.50" */
export const usd = (d: number) => `$${Number.isInteger(d) ? d : d.toFixed(2)}`;
