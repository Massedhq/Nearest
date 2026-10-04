import "server-only";
import { and, eq, or, sql } from "drizzle-orm";
import { db, prospects, prospectEvents, outreachSuppression, adminNotifications, adminMembers, users, cities, categories, professionalProfiles } from "@/db";

/** "Jas@Gmail.com " → "jas@gmail.com" */
export const normEmail = (e: string | null | undefined) => {
  const v = (e ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(v) ? v : null;
};
/** "(214) 555-1234", "+1 214.555.1234" → "2145551234" */
export const normPhone = (p: string | null | undefined) => {
  let d = (p ?? "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 ? d : null;
};

export type ProspectInput = { name: string; business?: string | null; city?: string | null; state?: string | null; category?: string | null; email?: string | null; phone?: string | null; source?: string | null; notes?: string | null };
export type CheckResult =
  | { kind: "ready" }
  | { kind: "duplicate"; prospectId: string; recruiter: string | null; status: string }
  | { kind: "possible"; prospectId: string; recruiter: string | null }
  | { kind: "registered" }
  | { kind: "suppressed" }
  | { kind: "no_contact" }
  | { kind: "no_city" };

/** Checks against ALL of Nearest: other prospects (any recruiter), registered accounts, and the do-not-contact list. */
export async function checkProspect(p: ProspectInput): Promise<CheckResult> {
  const em = normEmail(p.email), ph = normPhone(p.phone);
  if (!em && !ph) return { kind: "no_contact" };
  const sup = await db.select({ id: outreachSuppression.id }).from(outreachSuppression)
    .where(or(...(em ? [eq(outreachSuppression.emailNorm, em)] : []), ...(ph ? [eq(outreachSuppression.phoneNorm, ph)] : []))).limit(1);
  if (sup.length) return { kind: "suppressed" };
  if (em && (await db.query.users.findFirst({ where: sql`lower(${users.email}) = ${em}` }))) return { kind: "registered" };
  const dup = await db.select({ p: prospects, r: users.firstName }).from(prospects).leftJoin(users, eq(users.id, prospects.recruiterId))
    .where(or(...(em ? [eq(prospects.emailNorm, em)] : []), ...(ph ? [eq(prospects.phoneNorm, ph)] : []))).limit(1);
  if (dup.length) return { kind: "duplicate", prospectId: dup[0].p.id, recruiter: dup[0].r, status: dup[0].p.status };
  if (p.name && p.city) {
    const maybe = await db.select({ p: prospects, r: users.firstName }).from(prospects).leftJoin(users, eq(users.id, prospects.recruiterId))
      .where(and(sql`lower(${prospects.city}) = lower(${p.city})`, or(sql`lower(${prospects.name}) = lower(${p.name})`, ...(p.business ? [sql`lower(${prospects.business}) = lower(${p.business})`] : [])))).limit(1);
    if (maybe.length) return { kind: "possible", prospectId: maybe[0].p.id, recruiter: maybe[0].r };
  }
  if (!p.city) return { kind: "no_city" };
  return { kind: "ready" };
}

/** City and category names → Nearest ids (when they match a city / category Nearest has). */
export async function resolvePlace(city?: string | null, state?: string | null) {
  if (!city) return null;
  const c = await db.query.cities.findFirst({ where: and(sql`lower(${cities.name}) = lower(${city.trim()})`, ...(state ? [eq(cities.state, state.trim().toUpperCase().slice(0, 2))] : [])) });
  return c?.id ?? null;
}
const CAT_WORDS: [RegExp, string][] = [
  [/nail|manicur|pedicur|acrylic|gel/i, "Nails"], [/lash/i, "Lashes"], [/brow|microblad/i, "Brows"], [/braid/i, "Braids"], [/\blocs?\b|loctician/i, "Locs"],
  [/barber|fade|shave/i, "Barber"], [/makeup|mua\b|glam/i, "Makeup"], [/esthetic|facial|skin/i, "Skincare"], [/wax|sugar|laser hair/i, "Hair Removal"],
  [/massage/i, "Massage"], [/tattoo|pierc/i, "Tattoos & Piercings"], [/trainer|fitness|pilates|yoga/i, "Fitness"], [/stylist|hair|silk press|wig/i, "Hair"], [/photo/i, "Photography"],
];
export async function resolveCategory(text?: string | null) {
  if (!text) return null;
  const all = await db.select({ id: categories.id, name: categories.name }).from(categories);
  const exact = all.find((c) => c.name.toLowerCase() === text.trim().toLowerCase());
  if (exact) return exact;
  const word = CAT_WORDS.find(([re]) => re.test(text))?.[1];
  return word ? all.find((c) => c.name === word) ?? null : null;
}

export async function logProspect(prospectId: string, kind: string, detail: string | null, actorId: string | null) {
  await db.insert(prospectEvents).values({ prospectId, kind, detail, actorId });
}

/** Admin bell. Default recipients: every active owner. */
export async function notifyAdmins(n: { kind: string; title: string; body?: string; href?: string }, to?: string[]) {
  const ids = to?.length ? to : (await db.select({ id: adminMembers.userId }).from(adminMembers).where(and(eq(adminMembers.role, "OWNER"), eq(adminMembers.active, true)))).map((r) => r.id);
  if (ids.length) await db.insert(adminNotifications).values(ids.map((userId) => ({ userId, ...n })));
}

/** A professional account was just created: mark their prospect registered (stops recruiting) and tell the owners. */
export async function onProRegistered(userId: string) {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!u) return;
  const em = normEmail(u.email);
  const hit = em ? await db.query.prospects.findFirst({ where: eq(prospects.emailNorm, em) }) : null;
  if (hit) {
    await db.update(prospects).set({ status: "registered", registeredUserId: userId, updatedAt: new Date() }).where(eq(prospects.id, hit.id));
    await logProspect(hit.id, "registered", "Created a Nearest professional account — recruiting stopped.", null);
  }
  const p = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, userId) });
  const recruiterId = p?.referredBy ?? hit?.recruiterId ?? null;
  const recruiter = recruiterId ? await db.query.users.findFirst({ where: eq(users.id, recruiterId) }) : null;
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "A professional";
  // Joined through a partner's link without ever being a prospect (Facebook group, QR code…): record them under that partner.
  if (!hit && p?.referredBy) {
    const [row] = await db.insert(prospects).values({
      recruiterId: p.referredBy, name, email: u.email, emailNorm: em, phone: u.phone ?? null, phoneNorm: normPhone(u.phone),
      source: "Recruiter link", status: "registered", registeredUserId: userId,
    }).returning();
    await logProspect(row.id, "registered", "Joined through their recruiter link.", null);
  }
  // Owners + the recruiter (if they aren't an owner already) get the bell notification.
  const owners = (await db.select({ id: adminMembers.userId }).from(adminMembers).where(and(eq(adminMembers.role, "OWNER"), eq(adminMembers.active, true)))).map((r) => r.id);
  const to = [...new Set([...owners, ...(recruiterId ? [recruiterId] : [])])];
  await notifyAdmins({ kind: "registration", title: "New professional registration", body: `${name}${recruiter ? ` • Recruiter: ${recruiter.firstName ?? "partner"}` : ""}${hit ? " • from Outreach" : p?.referredBy ? " • recruiter link" : ""}`, href: `/admin/professionals/${userId}` }, to);
}

/** Profile submitted for review: prospect becomes "profile complete". */
export async function onProProfileSubmitted(userId: string) {
  const hit = await db.query.prospects.findFirst({ where: eq(prospects.registeredUserId, userId) });
  if (hit && hit.status !== "profile_complete") {
    await db.update(prospects).set({ status: "profile_complete", updatedAt: new Date() }).where(eq(prospects.id, hit.id));
    await logProspect(hit.id, "profile_complete", "Submitted their profile for review.", null);
  }
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  await notifyAdmins({ kind: "profile_complete", title: "Profile completed", body: `${[u?.firstName, u?.lastName].filter(Boolean).join(" ") || "A professional"} submitted their profile for review.`, href: "/admin/verification" });
}

/** After a pro claims a spot: tell owners when a city + category is nearly full or full. */
export async function checkCapacity(cityId: number | null, categoryId: number | null) {
  if (!cityId || !categoryId) return;
  const { slotCount, slotLimits } = await import("./slots");
  const [n, { cap }, city, cat] = await Promise.all([slotCount(cityId, categoryId), slotLimits(), db.query.cities.findFirst({ where: eq(cities.id, cityId) }), db.query.categories.findFirst({ where: eq(categories.id, categoryId) })]);
  if (n === cap - 1) await notifyAdmins({ kind: "market_near", title: "Market near capacity", body: `${cat?.name} in ${city?.name} has ${n}/${cap} professionals.`, href: "/admin/outreach/markets" });
  if (n >= cap) await notifyAdmins({ kind: "market_full", title: "Market full", body: `${cat?.name} in ${city?.name} reached ${cap}/${cap}. New professionals there join the waitlist.`, href: "/admin/outreach/markets" });
}

export const PROSPECT_STATUSES: Record<string, string> = {
  new: "New", approved: "Ready", scheduled: "Scheduled", contacted: "Contacted", conversation: "Conversation", interested: "Interested",
  link_sent: "Link sent", link_clicked: "Link clicked", registered: "Registered", profile_complete: "Profile complete",
  declined: "Declined", no_response: "No response", opted_out: "Opted out", needs_review: "Needs review", ineligible: "Ineligible",
};
export const SOURCES = ["Instagram", "Facebook", "Google", "Website", "Event", "Referral", "Beauty Supply Store", "Salon", "Barber Shop", "Beauty School", "Trade School", "Other"];

/** Who an admin works for: their own prospects; the main owner can also see everyone's. */
export async function outreachScope(userId: string) {
  const { mainOwnerId } = await import("./partner");
  return { isMain: (await mainOwnerId()) === userId };
}
