import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, professionalProfiles, proServices } from "@/db";
import { liveProWhere } from "./search";
import { publicPartnerPage, partnerPagePath } from "./partners";
import { personName } from "./pro-name";
import type { Addon } from "./addons";

/**
 * Partner-side booking (2026-11-09). A Nearest Partner's own page (/link/<slug>) books them directly:
 * - open to anyone with a Nearest account (partner clients sign up with an email code; students and others can book too),
 * - no $150 cap (that's a student-app rule), services over $150 show only here,
 * - bookings carry channel "partner" and are kept separate from the professional's student-side bookings,
 * - "Bundle my booking" = several of THIS partner's own services in one visit. Never other professionals.
 * The calendar is shared with the student side (openSlots), so nobody is double-booked.
 */
export const BUNDLE_MAX = 5; // most services in one bundled visit (the first + up to 4 more)
export const NO_CAP = 100_000_000; // the partner side has no student price cap

/** The partner page + their live professional profile, or null if they can't take bookings right now. */
export async function partnerForBooking(slug: string) {
  const r = await publicPartnerPage(slug);
  if (!r) return null;
  const [pro] = await db.select().from(professionalProfiles)
    .where(and(eq(professionalProfiles.userId, r.p.userId), ...liveProWhere(null, "all", { partnerPage: true }))).limit(1);
  if (!pro) return null;
  return { r, pro, name: personName(r.p.displayName, r.u.firstName, r.u.lastName), base: partnerPagePath(r.p.slug!) };
}

/** Every active service the partner offers (no price cap on this side). */
export function partnerServices(userId: string) {
  return db.select().from(proServices).where(and(eq(proServices.userId, userId), eq(proServices.active, true))).orderBy(asc(proServices.sort), asc(proServices.name));
}

/** One of this partner's active services. */
export async function partnerService(userId: string, serviceId: string) {
  if (!/^[0-9a-f-]{36}$/.test(serviceId)) return null;
  return (await db.query.proServices.findFirst({ where: and(eq(proServices.id, serviceId), eq(proServices.userId, userId), eq(proServices.active, true)) })) ?? null;
}

/** "?with=id,id" → the partner's other services bundled into this visit, at the professional's own price (one booking fee per visit). */
export async function bundleExtras(userId: string, mainId: string, raw: string | string[] | undefined): Promise<Addon[]> {
  const ids = [...new Set((Array.isArray(raw) ? raw.join(",") : raw ?? "").split(",").map((x) => x.trim()).filter((x) => /^[0-9a-f-]{36}$/.test(x) && x !== mainId))].slice(0, BUNDLE_MAX - 1);
  if (!ids.length) return [];
  const rows = await db.select().from(proServices).where(and(eq(proServices.userId, userId), eq(proServices.active, true), inArray(proServices.id, ids)));
  return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => ({ id: r.id, name: r.name, priceCents: r.proPriceCents ?? r.priceCents, extraMin: r.durationMin }));
}

/** Query string that carries add-ons (a) and bundled services (with) between the partner booking pages. */
export function carry(addonIds: string[], withIds: string[]) {
  return (addonIds.length ? `&a=${addonIds.join(",")}` : "") + (withIds.length ? `&with=${withIds.join(",")}` : "");
}

/** Has a partner page (any state) — partners get no $150 cap on their own services. */
export async function isPartner(userId: string) {
  const { partnerPages } = await import("@/db");
  return Boolean(await db.query.partnerPages.findFirst({ where: eq(partnerPages.userId, userId), columns: { userId: true } }));
}
