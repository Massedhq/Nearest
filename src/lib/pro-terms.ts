/**
 * The Professional Terms shown (scrollable) on the Join page. Bump PRO_TERMS_VERSION whenever the text changes —
 * every professional's accepted version is stored, so Nearest can prove which terms they agreed to.
 */
export const PRO_TERMS_VERSION = "2026-10-05";

export function proTermsSections(rate: { cents: number; label: string }) {
  const price = `$${(rate.cents / 100).toFixed(rate.cents % 100 ? 2 : 0)}`;
  return [
    { h: "1. Your membership (please read)", p: [
      `Your Nearest membership rate is ${price} per month for your first 12 months (${rate.label}). After your first 12 months, the standard rate applies, and Nearest will tell you before it changes.`,
      "You are not charged for creating your account or building your profile.",
      `By accepting these terms, you agree to the ${price}/month membership. Your membership is activated — and your card is charged ${price} — when you accept your first booking through Nearest. You must activate your membership before you can accept a booking.`,
      "Your membership then renews monthly until you cancel. It's a monthly membership, not a per-booking fee: once it's active, you can accept as many bookings as you like. Nearest takes no commission on your bookings; card-processing fees come out of each payment.",
    ] },
    { h: "2. Your profile and services", p: [
      "Everything on your profile must be accurate and your own work — your name, services, prices, photos and videos.",
      "You may only offer services you are legally permitted to provide. If a service requires a license, you must hold a current license (or have submitted a diploma while your license is pending, where the law allows you to provide that service).",
      "Each service is capped at $150. Services marked 18+ can't be booked by students under 18.",
    ] },
    { h: "3. Bookings", p: [
      "Every booking starts as a request. You'll be notified and have 24 hours (or until 2 hours before the appointment, if sooner) to accept or decline; requests you don't answer expire. If your membership isn't active yet, accepting your first request activates it first.",
      "If you receive a booking request and don't activate your membership within 7 days, your city and category spot may be released to another professional.",
      "Once you accept, the student pays to confirm. The appointment is confirmed when their payment goes through; Nearest holds the payment until the service is finished. If they don't pay in time, the time is released.",
      "You must show up on time at the confirmed place, check in through Nearest, and provide the service as described. Nearest's cancellation, deposit, no-show and fine rules apply to you.",
    ] },
    { h: "4. Safety and conduct", p: [
      "Many Nearest clients are students, some under 18. You must keep every interaction professional, communicate only through Nearest, never ask for personal contact information, and never be alone with a minor in a private setting outside a professional service.",
      "You agree to Nearest's identity check and to keep your account secure.",
    ] },
    { h: "5. City and category spots", p: [
      "Each city has a limited number of spots per service category. Your spot is held while your account is in good standing. Moving to a city that's full in your category requires Nearest's approval.",
    ] },
    { h: "6. The full Terms", p: [
      "These Professional Terms are part of the Nearest Terms of Service and Privacy Policy (usenearest.com/terms and /privacy), which also apply to you. If they conflict, these Professional Terms control for your membership and bookings.",
    ] },
  ];
}
