/**
 * The Professional Terms shown (scrollable) on the final Review & submit step — the membership rate is the last section. Bump PRO_TERMS_VERSION whenever the text changes —
 * every professional's accepted version is stored, so Nearest can prove which terms they agreed to.
 */
export const PRO_TERMS_VERSION = "2026-10-14";

/** Label for a pro's locked rate (used when an already-enrolled pro accepts an updated version). */
export const rateLabel = (entryType: string | null | undefined) => (entryType === "FIRST_IN" ? "First In" : entryType === "DFW_NEXT" ? "DFW membership" : "Market rate");

export function proTermsSections(rate: { cents: number; label: string }) {
  const price = `$${(rate.cents / 100).toFixed(rate.cents % 100 ? 2 : 0)}`;
  return [
    { h: "1. Your profile and services", p: [
      "Everything on your profile must be accurate and your own work — your name, services, prices, photos and videos.",
      "You may only offer services you are legally permitted to provide. If a service requires a license, you must hold a current license — see section 5. Your responsibility for your services, insurance and indemnity is in section 6.",
      "Each service is capped at $150. Services marked 18+ can't be booked by students under 18.",
    ] },
    { h: "2. Bookings", p: [
      "Every booking starts as a request. You'll be notified and have 24 hours (or until 2 hours before the appointment, if sooner) to accept or decline; requests you don't answer expire. If your membership isn't active yet, accepting your first request activates it first.",
      "If you receive a booking request and don't activate your membership within 7 days, your city and category spot may be released to another professional.",
      "Once you accept, the student pays to confirm. The appointment is confirmed when their payment goes through; Nearest holds the payment until the service is finished. If they don't pay in time, the time is released.",
      "You must show up on time at the confirmed place, check in through Nearest, and provide the service as described. Nearest's cancellation, deposit, no-show and fine rules apply to you.",
    ] },
    { h: "3. Safety and conduct", p: [
      "Many Nearest clients are students, some under 18. You must keep every interaction professional, communicate only through Nearest, never ask for personal contact information, and never be alone with a minor in a private setting outside a professional service.",
      "You agree to Nearest's identity check and to keep your account secure.",
    ] },
    { h: "4. City and category spots", p: [
      "Each city has a limited number of spots per service category. Your spot is held while your account is in good standing. Moving to a city that's full in your category requires Nearest's approval.",
    ] },
    { h: "5. Professional qualifications & legal compliance", p: [
      "By listing, offering, accepting bookings for, or providing services through Nearest, you represent and warrant that you possess and will maintain any licenses, permits, registrations, certifications, training, insurance, or other qualifications required by applicable federal, state, and local law for the services you provide.",
      "You are solely responsible for determining whether you are legally authorized and appropriately qualified to provide each service you list through Nearest.",
      "Nearest does not independently verify your occupational licensing, education, diploma, certification, training, or other professional qualifications unless Nearest expressly states otherwise. The professional status you choose (licensed, graduated with license pending, currently enrolled, or self-taught) is self-reported.",
      "Nearest's acceptance of your account, profile, service listing, or booking activity does not constitute verification, certification, endorsement, or confirmation of your professional qualifications.",
      "You agree not to list, accept, or perform any service through Nearest that you are not legally authorized to provide.",
    ] },
    { h: "6. Liability, insurance & indemnity", p: [
      "Your services are your responsibility. You — not Nearest — are solely responsible for the services you provide, how you provide them, and their results, including any injury, allergic or skin reaction, infection, hair, nail, lash, brow or skin damage, property damage, or other harm to a client. Nearest is a booking platform and does not perform, supervise, control or direct your services.",
      "Safety and sanitation. You must follow all health, sanitation, sterilization and safety rules that apply to your services (including TDLR rules), use products as directed, ask clients about allergies and sensitivities, do patch tests where appropriate, and refuse any service you can't perform safely.",
      "Insurance. You agree to carry professional liability (malpractice) insurance and general liability insurance appropriate to your services, in amounts customary for your field, while you provide services through Nearest. If you don't currently have it, you understand you are personally responsible for any claim and you agree to obtain it as soon as reasonably possible. Nearest may ask for proof of insurance at any time.",
      "Keep your status current. You must tell Nearest within 48 hours if any license, permit or registration you rely on is suspended, revoked, expired, restricted or under investigation, and immediately stop offering any service you're no longer authorized to provide. Nearest may pause or remove your listing until it's resolved.",
      "Complaints and claims. If a client reports a problem with a service, you agree to respond through Nearest promptly and in good faith and to cooperate with Nearest's review. Nearest may share booking details needed to resolve a dispute or claim.",
      "Indemnity. To the fullest extent allowed by law, you agree to defend, indemnify and hold harmless Nearest and its owners, employees and agents from and against any claims, damages, losses, fines, penalties, costs and expenses (including reasonable attorneys' fees) arising out of or related to the services you provide, your conduct, your content, your violation of these Professional Terms or the Nearest Terms, or your violation of any law or anyone's rights.",
      "Limits on Nearest's liability. Nearest provides the platform \"as is.\" To the fullest extent allowed by law, Nearest is not liable for any injury, loss or damage arising from services you provide or from your interactions with clients, and Nearest's total liability to you for any claim is limited as described in the Nearest Terms (section 20).",
    ] },
    { h: "7. The full Terms", p: [
      "These Professional Terms are part of the Nearest Terms of Service and Privacy Policy (usenearest.com/terms and /privacy), which also apply to you. If they conflict, these Professional Terms control for your membership and bookings.",
    ] },
    { h: "8. Your membership", p: [
      `Your Nearest membership rate is ${price} per month for your first 12 months (${rate.label}). After your first 12 months, your membership becomes $30 per month (the standard rate) and renews at that price; Nearest will tell you before that change happens.`,
      "You are not charged for creating your account or building your profile.",
      `By accepting these terms, you agree to the ${price}/month membership. Your membership is activated — and your card is charged ${price} — when you accept your first booking through Nearest. You must activate your membership before you can accept a booking.`,
      "Your membership then renews monthly until you cancel. It's a monthly membership, not a per-booking fee: once it's active, you can accept as many bookings as you like. Nearest takes no commission on your bookings; card-processing fees come out of each payment.",
      "Nearest service fee: a flat $5.00 Nearest service fee applies to each service booked through Nearest. When you save a service, the fee is added to your price by default, so students see one total (for example, a $30 service shows as $35) and you receive your full price. You can instead choose, per service, to include the fee in your price — then students see your price and the $5.00 comes out of your payout for that booking. Nearest keeps the fee only when a booking is completed; when a booking is refunded, the fee is refunded too. Model Calls have no service fee.",
      "Nearest may add, change or remove platform and service fees to operate and improve the service. Nearest will tell you before any change takes effect, and changes apply only to bookings made after the change.",
    ] },
  ];
}
