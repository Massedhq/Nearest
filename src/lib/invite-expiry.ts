import { chicagoToUtc } from "./time";

/** Every invitation's expiration is set by the owner (date + time, Central). Must be at least 15 minutes out, at most 90 days. */
export function parseExpiry(form: FormData): { at: Date } | { error: string } {
  const raw = String(form.get("expiresAt") ?? "").trim(); // "YYYY-MM-DDTHH:MM" from the date-and-time box
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(raw);
  if (!m) return { error: "Choose the date and time this invitation expires." };
  const at = chicagoToUtc(m[1], m[2]);
  if (at.getTime() < Date.now() + 15 * 60000) return { error: "The expiration has to be at least 15 minutes from now." };
  if (at.getTime() > Date.now() + 90 * 86400000) return { error: "The expiration can be up to 90 days from now." };
  return { at };
}

/** "Oct 3, 2026 at 6:00 PM (Central)" — used in invitation emails and screens. */
export function expiryLabel(d: Date) {
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
  return `${date} at ${time} (Central)`;
}
