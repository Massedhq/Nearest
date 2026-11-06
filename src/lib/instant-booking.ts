import "server-only";
import { chicagoToUtc } from "./time";

/**
 * Instant booking (owner decision, 2026-11-05): from INSTANT_BOOKING_FROM (12:00 AM Central, November 19, 2026) a
 * student who books an open time pays right away and the appointment is confirmed when payment goes through — no
 * professional accept step. Requests sent before then finish the old way (pro accepts, then the student pays).
 */
export const INSTANT_BOOKING_FROM = chicagoToUtc("2026-11-19", "00:00");
export const INSTANT_BOOKING_LABEL = "November 19, 2026";

export function instantBooking(now = new Date()) {
  return now.getTime() >= INSTANT_BOOKING_FROM.getTime();
}
