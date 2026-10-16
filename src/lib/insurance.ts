/**
 * Professional Protection — gauging interest in affordable coverage for independent beauty & wellness professionals.
 *
 * What this is: a self-reported preference only (I already have insurance / I'm interested / Not interested right now).
 * What this is NOT: an insurance product. Nearest does not sell, quote, bind or verify insurance, and never collects an
 * insurer name, policy number, expiration date, document or proof of coverage here. The prices below are proposed
 * models for discussion with a licensed insurance partner — not available products or binding quotes.
 *
 * Future integration: an approved, licensed partner would handle quotes, premiums, policy issuance and coverage
 * confirmation (see InsurancePartner). Nothing charges or deducts insurance fees until a partner agreement and the
 * technical integration are approved — INSURANCE_PAYMENTS_ENABLED stays false until then.
 */

export const INSURANCE_PAYMENTS_ENABLED = false as const;

export const INSURANCE_CHOICES = {
  has: "I already have insurance",
  interested: "I'm interested in insurance through Nearest",
  not_now: "Not interested right now",
} as const;
export type InsuranceChoice = keyof typeof INSURANCE_CHOICES;

export const INSURANCE_INTERESTS = {
  per_booking: "Pay-per-booking coverage",
  annual: "Annual coverage",
  more_info: "I'd like more information first",
} as const;
export type InsuranceInterest = keyof typeof INSURANCE_INTERESTS;

/** The two models Nearest is exploring — approximate, unconfirmed, for explanation only. */
export const PROTECTION_MODELS = [
  {
    key: "per_booking" as const,
    title: "Pay per booking",
    price: "about $3 per eligible booking",
    how: [
      "You'd turn it on once, and each eligible booking you complete through Nearest would be covered for that appointment.",
      "You'd pay only when you work — no yearly bill. The amount would show on the booking before anything is charged.",
      "Coverage, limits and what counts as an eligible booking would be set by the licensed insurance partner.",
    ],
  },
  {
    key: "annual" as const,
    title: "Annual coverage",
    price: "about $49 a year",
    how: [
      "One yearly payment would cover the services you provide, on Nearest and off it, for 12 months.",
      "Best if you book often — the yearly price stays the same however many appointments you have.",
      "The licensed insurance partner would issue the policy and confirm your coverage directly with you.",
    ],
  },
];

export const PROTECTION_INTRO = "Nearest is exploring affordable insurance options for independent beauty and wellness professionals through a licensed insurance partner, including coverage that may be available per appointment or annually.";
export const PROTECTION_DISCLAIMER = "These are proposed models with approximate prices — they're not confirmed, not available yet, and not a quote or an offer of insurance. Telling us your preference doesn't sign you up for anything or cost anything. If coverage becomes available, the licensed insurance partner will provide the actual terms and price, and you'll decide then.";

const isChoice = (v: string): v is InsuranceChoice => v in INSURANCE_CHOICES;
const isInterest = (v: string): v is InsuranceInterest => v in INSURANCE_INTERESTS;

/** Reads the form. Returns null when nothing was picked (it's optional), or an error when "interested" has no option. */
export function readProtection(form: FormData): { choice: InsuranceChoice; interest: InsuranceInterest | null } | { error: string } | null {
  const choice = String(form.get("insuranceChoice") ?? "");
  if (!choice) return null;
  if (!isChoice(choice)) return { error: "Choose one of the Professional Protection options." };
  if (choice !== "interested") return { choice, interest: null };
  const interest = String(form.get("insuranceInterest") ?? "");
  if (!isInterest(interest)) return { error: "Choose which coverage option interests you (or more information first)." };
  return { choice, interest };
}

export const protectionLabel = (choice: string | null, interest: string | null) =>
  !choice ? "Not answered yet" : `${INSURANCE_CHOICES[choice as InsuranceChoice] ?? choice}${interest ? ` — ${INSURANCE_INTERESTS[interest as InsuranceInterest] ?? interest}` : ""}`;

/**
 * What an approved insurance partner integration will implement. Not wired to anything yet: no quotes, no premiums,
 * no payments and no deductions happen until a partner agreement and integration are approved.
 */
export interface InsurancePartner {
  name: string;
  quote(input: { userId: string; model: InsuranceInterest; categoryNames: string[]; state: string }): Promise<{ priceCents: number; termsUrl: string }>;
  issuePolicy(input: { userId: string; model: InsuranceInterest; bookingId?: string }): Promise<{ policyRef: string }>;
  confirmCoverage(input: { userId: string; bookingId?: string }): Promise<{ covered: boolean }>;
}
