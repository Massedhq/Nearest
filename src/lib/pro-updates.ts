import "server-only";
import { PRO_TERMS_VERSION } from "./pro-terms";

/**
 * Business → Updates: changes a professional who joined earlier still needs to acknowledge. New registrations accept
 * the current Professional Terms when they submit, so they never have any. Today the only kind is a Professional
 * Terms update; opening one can't be closed until it's acknowledged (UpdateViewer).
 */
export type ProUpdate = { id: string; title: string; date: string; changes: string[] };

type P = { entryPaidAt: Date | null; proTermsVersion: string | null };

export function pendingUpdates(p: P, owner: boolean): ProUpdate[] {
  if (owner || !p.entryPaidAt || p.proTermsVersion === PRO_TERMS_VERSION) return [];
  const changes = [
    "The $5.00 Nearest service fee now also applies to Model Calls — it's added on top of your model price (a $15 model price shows models $20; you still receive $15). Model Calls you posted before October 17 keep no fee.",
    "Fees and payments are now all in section 2 (Bookings, payments & fees): no sign-up fee and no monthly fee; the $5.00 service fee on completed bookings; card processing comes out of your payout, including on bookings paid with Nearest credit and forfeited deposits.",
    "Section 4: spots are for professionals taking bookings — if your profile isn't live within 30 days of joining for reasons on your side, your spot may be released (Nearest reminds you a week before, and you can reclaim it if your city still has room).",
  ];
  if (!p.proTermsVersion || p.proTermsVersion < "2026-10-14") {
    changes.push("Section 6, Liability, insurance & indemnity: you're responsible for the services you provide, you agree to carry professional and general liability insurance, to tell Nearest within 48 hours if a license is suspended or expires, and to cover Nearest for claims arising from your services.");
  }
  return [{ id: `terms-${PRO_TERMS_VERSION}`, title: "Updated Professional Terms", date: "October 17, 2026", changes }];
}
