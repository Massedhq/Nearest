import "server-only";
import type Stripe from "stripe";
import { and, asc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db, adminMembers, users, professionalProfiles, membershipPayments, partnerPayouts } from "@/db";
import { getSettings } from "./settings";

/**
 * Partner Sales Track (agreed with the owners):
 * - Pool: pros #1–(pool − block) → their membership payments are split equally among the partners;
 *   pros in the last `block` of the pool (#3,001–3,500) → Nearest.
 * - After the pool (#3,501+): a pro brought in by a partner's code earns that partner $8 / $17 / $26 per
 *   $10 / $20 / $30 payment; Nearest keeps $2 / $3 / $4. Pros with no partner code → Nearest.
 * Pro numbers follow sign-up order.
 */
const CUT: Record<number, number> = { 1000: 800, 2000: 1700, 3000: 2600 };
export const partnerCut = (cents: number) => CUT[cents] ?? Math.round(cents * 0.85);

export async function partners() {
  const rows = await db
    .select({ userId: adminMembers.userId, code: adminMembers.partnerCode, first: users.firstName, last: users.lastName, email: users.email, createdAt: adminMembers.createdAt })
    .from(adminMembers).innerJoin(users, eq(users.id, adminMembers.userId))
    .where(and(eq(adminMembers.role, "OWNER"), eq(adminMembers.active, true)))
    .orderBy(asc(adminMembers.createdAt));
  // Give every partner a personal code the first time it's needed (AVY, KISSES, KEE…).
  const taken = new Set((await db.select({ c: adminMembers.partnerCode }).from(adminMembers)).map((x) => x.c).filter(Boolean) as string[]);
  for (const r of rows) {
    if (r.code) continue;
    const base = (r.first ?? r.email?.split("@")[0] ?? "PARTNER").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "PARTNER";
    let code = base;
    for (let i = 2; taken.has(code); i++) code = `${base}${i}`;
    await db.update(adminMembers).set({ partnerCode: code }).where(eq(adminMembers.userId, r.userId));
    taken.add(code);
    r.code = code;
  }
  return rows;
}

/** The main owner approves payouts and sees every partner. MAIN_OWNER_EMAIL, or the first owner. */
export async function mainOwnerId() {
  const list = await partners();
  const envEmail = (process.env.MAIN_OWNER_EMAIL ?? "").trim().toLowerCase();
  return (envEmail && list.find((p) => p.email?.toLowerCase() === envEmail)?.userId) || list[0]?.userId || null;
}

export async function partnerByCode(code: string | null | undefined) {
  if (!code) return null;
  const row = await db.query.adminMembers.findFirst({ where: and(eq(adminMembers.partnerCode, code.trim().toUpperCase()), eq(adminMembers.active, true)) });
  return row?.userId ?? null;
}

// ---------- Membership payments ----------
export async function recordInvoice(inv: Stripe.Invoice) {
  if (!inv.amount_paid || !inv.customer) return;
  const customer = typeof inv.customer === "string" ? inv.customer : inv.customer.id;
  const pro = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.stripeCustomerId, customer) });
  if (!pro) return;
  const paidAt = new Date((inv.status_transitions?.paid_at ?? inv.created) * 1000);
  await db.insert(membershipPayments).values({ stripeInvoiceId: inv.id!, proId: pro.userId, amountCents: inv.amount_paid, paidAt }).onConflictDoNothing();
}

/** Pulls paid membership invoices from Stripe (works without the webhook). */
export async function syncInvoices() {
  const { stripe } = await import("./stripe");
  const pros = await db.select({ customer: professionalProfiles.stripeCustomerId }).from(professionalProfiles).where(isNotNull(professionalProfiles.stripeCustomerId));
  let n = 0;
  for (const p of pros) {
    const list = await stripe().invoices.list({ customer: p.customer!, status: "paid", limit: 100 });
    for (const inv of list.data) { await recordInvoice(inv); n++; }
  }
  return n;
}

// ---------- Earnings ----------
export type MonthEarnings = {
  month: string; totalCents: number; poolCents: number; nearestCents: number;
  perPartner: { userId: string; name: string; code: string | null; poolShareCents: number; codeCents: number; totalCents: number; codePros: number }[];
};

const monthRange = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return [new Date(Date.UTC(y, m - 1, 1, 6)), new Date(Date.UTC(m === 12 ? y + 1 : y, m % 12, 1, 6))] as const; // Chicago-ish month boundaries
};

export async function proNumbers() {
  const rows = await db
    .select({ userId: professionalProfiles.userId, referredBy: professionalProfiles.referredBy, n: sql<number>`row_number() over (order by ${professionalProfiles.createdAt}, ${professionalProfiles.userId})::int` })
    .from(professionalProfiles);
  return new Map(rows.map((r) => [r.userId, r]));
}

export async function earningsFor(month: string): Promise<MonthEarnings> {
  const s = await getSettings();
  const pool = Number(s["partner.pool_size"]);
  const block = Number(s["partner.nearest_block"]);
  const [from, to] = monthRange(month);
  const [list, nums, pays] = await Promise.all([
    partners(), proNumbers(),
    db.select().from(membershipPayments).where(and(gte(membershipPayments.paidAt, from), lt(membershipPayments.paidAt, to))),
  ]);
  let poolCents = 0, nearestCents = 0;
  const code = new Map<string, { cents: number; pros: Set<string> }>();
  for (const pay of pays) {
    const info = nums.get(pay.proId);
    const n = info?.n ?? Number.MAX_SAFE_INTEGER;
    if (n <= pool - block) poolCents += pay.amountCents;
    else if (n <= pool) nearestCents += pay.amountCents;
    else if (info?.referredBy && list.some((p) => p.userId === info.referredBy)) {
      const cut = partnerCut(pay.amountCents);
      const c = code.get(info.referredBy) ?? { cents: 0, pros: new Set<string>() };
      c.cents += cut; c.pros.add(pay.proId); code.set(info.referredBy, c);
      nearestCents += pay.amountCents - cut;
    } else nearestCents += pay.amountCents;
  }
  const share = list.length ? Math.floor(poolCents / list.length) : 0;
  nearestCents += poolCents - share * list.length; // leftover cents from an uneven split
  return {
    month, totalCents: pays.reduce((a, p) => a + p.amountCents, 0), poolCents, nearestCents,
    perPartner: list.map((p) => {
      const c = code.get(p.userId);
      return { userId: p.userId, name: [p.first, p.last].filter(Boolean).join(" ") || p.email || "Partner", code: p.code, poolShareCents: share, codeCents: c?.cents ?? 0, totalCents: share + (c?.cents ?? 0), codePros: c?.pros.size ?? 0 };
    }),
  };
}

export async function payoutsFor(month: string) {
  return db.select().from(partnerPayouts).where(eq(partnerPayouts.month, month));
}
