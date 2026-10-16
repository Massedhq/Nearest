/**
 * Service add-ons (e.g. rhinestones, charms, extra length). A pro lists them under a service; a student picks any when
 * booking. Rules:
 * - Each add-on has a name, a price ($1–$100) and extra time (0–180 min); up to 10 per service.
 * - The $150 student cap applies to the service price + the chosen add-ons together (a travel fee stays separate).
 * - Add-ons have no Nearest service fee — their full price goes to the professional (minus card processing).
 * - The chosen add-ons are snapshotted on the booking and included in its price and length.
 */
import { MAX_PRICE_CENTS } from "./pricing";

export type Addon = { id: string; name: string; priceCents: number; extraMin: number };
export const MAX_ADDONS = 10;
export const MAX_ADDON_CENTS = 10000;
export const MAX_ADDON_MIN = 180;

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/-/g, "").slice(0, 12);

/** Cleans what a pro typed for one service's add-ons. Returns the add-ons or an error message. */
export function cleanAddons(raw: unknown, serviceName: string, serviceCents: number): Addon[] | { error: string } {
  if (!Array.isArray(raw)) return [];
  const out: Addon[] = [];
  for (const a of raw as { id?: unknown; name?: unknown; price?: unknown; minutes?: unknown }[]) {
    const name = String(a?.name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
    const priceRaw = String(a?.price ?? "").replace(/[$,\s]/g, "");
    if (!name && !priceRaw) continue; // empty row
    if (!name) return { error: `Give every add-on on ${serviceName} a name.` };
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 1 || price > MAX_ADDON_CENTS / 100) return { error: `Enter a price between $1 and $${MAX_ADDON_CENTS / 100} for the "${name}" add-on.` };
    const cents = Math.round(price * 100);
    if (serviceCents + cents > MAX_PRICE_CENTS) return { error: `${serviceName} + "${name}" would be over the $${MAX_PRICE_CENTS / 100} student limit. Lower the add-on or the service price.` };
    const minRaw = String(a?.minutes ?? "0").trim() || "0";
    const minutes = Number(minRaw);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_ADDON_MIN) return { error: `Extra time for "${name}" must be 0–${MAX_ADDON_MIN} minutes.` };
    const id = typeof a?.id === "string" && /^[a-z0-9]{6,32}$/i.test(a.id) ? a.id : newId();
    out.push({ id, name, priceCents: cents, extraMin: minutes });
  }
  if (out.length > MAX_ADDONS) return { error: `Up to ${MAX_ADDONS} add-ons per service (${serviceName} has ${out.length}).` };
  return out;
}

/** The add-ons a student picked, checked against the service. Unknown ids are ignored; the total must stay under the cap. */
export function pickAddons(svc: { priceCents: number; addons: Addon[] | null }, ids: string[]): { list: Addon[]; cents: number; minutes: number; overCap: boolean } {
  const want = new Set(ids);
  const list = (svc.addons ?? []).filter((a) => want.has(a.id));
  const cents = list.reduce((t, a) => t + a.priceCents, 0);
  const minutes = list.reduce((t, a) => t + a.extraMin, 0);
  return { list, cents, minutes, overCap: svc.priceCents + cents > MAX_PRICE_CENTS };
}

/** "Short French Set + Rhinestones + Charms" — the name kept on the booking so every screen shows what was ordered. */
export const withAddons = (serviceName: string, list: Addon[]) => (list.length ? `${serviceName} + ${list.map((a) => a.name).join(" + ")}` : serviceName).slice(0, 300);

/** Reads add-on ids from a form or URL (?a=id&a=id). */
export const addonIds = (v: string[] | string | undefined | null) => (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => String(x).split(",")).filter((x) => /^[a-z0-9]{6,32}$/i.test(x)).slice(0, MAX_ADDONS);
