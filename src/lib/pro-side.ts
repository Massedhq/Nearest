import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { bookings } from "@/db";
import { partnerSides } from "./partner-booking";

/**
 * Side switch (2026-11-09): one login, two sides for a professional who is also a Nearest Partner.
 * "student" = the Nearest student app (verified students, $150 limit); "partner" = their partner page (anyone, no limit).
 * The switch only changes what the pro is looking at (appointments, earnings, home) — the calendar, hours, ID check and
 * payouts stay shared, so the two sides can never double-book. Remembered per device in a cookie (a view setting, not login).
 * Partner-only partners are always on the partner side; regular professionals have no switch.
 */
export type Side = "student" | "partner";
export const SIDE_COOKIE = "nearest_side";

export async function currentSide(userId: string): Promise<{ side: Side | null; canSwitch: boolean }> {
  const s = await partnerSides(userId);
  if (!s.partner) return { side: null, canSwitch: false };
  if (s.partnerOnly) return { side: "partner", canSwitch: false };
  const c = (await cookies()).get(SIDE_COOKIE)?.value;
  return { side: c === "partner" ? "partner" : "student", canSwitch: true };
}

/** Booking filter for the side being viewed (undefined = regular professional, everything). */
export const onSide = (side: Side | null) => (side ? eq(bookings.channel, side) : undefined);
