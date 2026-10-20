/**
 * Student Pricing Intelligence — internal, read-only analysis of real listing and booking records.
 *
 * Nothing here changes prices, rules, rankings or what students see. It reads:
 *   - pro_services (current listed menu: student price incl. Nearest's booking fee, the pro's own price, add-ons)
 *   - bookings (snapshot prices at booking time, add-ons, travel fee, booking fee, invite discounts, status timeline)
 *   - model_calls (category of Model Call bookings — Model Calls and free launch-campaign rewards are excluded from
 *     price analysis because they're discounted/free by design; they're counted separately)
 *   - activity_log "service.price_changed" (listed-price history — recorded from this release on)
 *
 * What the platform does NOT track, and so this never reports: profile or service page views, searches per service.
 * Wherever a sample is too small to say anything, the result is `null` and the page shows "Insufficient data".
 */
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, bookings, categories, cities, modelCalls, proServices, professionalProfiles, users, activityLog } from "@/db";

export const MIN_SAMPLE = 5; // averages/medians need at least this many records
export const MIN_FUNNEL = 10; // conversion rates need at least this many requests

export const BANDS = [
  { key: "lt50", label: "Under $50", test: (c: number) => c < 5000 },
  { key: "50to85", label: "$50–$84.99", test: (c: number) => c >= 5000 && c < 8500 },
  { key: "85to100", label: "$85–$99.99", test: (c: number) => c >= 8500 && c < 10000 },
  { key: "100to150", label: "$100–$149.99", test: (c: number) => c >= 10000 && c < 15000 },
  { key: "eq150", label: "Exactly $150", test: (c: number) => c === 15000 },
  { key: "gt150", label: "Over $150 (should be none)", test: (c: number) => c > 15000 },
] as const;
export type BandKey = (typeof BANDS)[number]["key"];
export const bandOf = (c: number): BandKey => BANDS.find((b) => b.test(c))!.key;

export type Filters = { from?: string; to?: string; state?: string; cityId?: number; categoryId?: number; proId?: string; liveOnly?: boolean };

export type Stats = { n: number; avg: number; median: number; min: number; max: number } | null;
export function stats(values: number[], min = MIN_SAMPLE): Stats {
  if (values.length < min || values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return { n: s.length, avg: Math.round(s.reduce((t, v) => t + v, 0) / s.length), median: s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2), min: s[0], max: s[s.length - 1] };
}
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

type ServiceRow = { id: string; proId: string; proName: string; categoryId: number; category: string; cityId: number | null; city: string | null; state: string | null; priceCents: number; proPriceCents: number | null; feeCents: number; addonCount: number; createdAt: Date; live: boolean };
type BookingRow = {
  id: string; proId: string; serviceId: string | null; serviceName: string; modelCallId: string | null; campaign: boolean; bundleId: string | null;
  categoryId: number | null; category: string | null; cityId: number | null; city: string | null; state: string | null;
  priceCents: number; feeCents: number; travelCents: number; addonsCents: number; discountCents: number;
  isRequest: boolean; respondedAt: Date | null; paidAt: Date | null; status: string; createdAt: Date; startsAt: Date;
};

/** The service price a booking was made at: what the student saw for the service itself (booking fee included), before add-ons and travel. */
export const bookedServiceCents = (b: Pick<BookingRow, "priceCents" | "addonsCents" | "travelCents">) => b.priceCents - b.addonsCents - b.travelCents;
/** Accepted = a booked-directly booking, or a request the professional accepted (a decline is cancelled_pro with no payment). */
export const wasAccepted = (b: Pick<BookingRow, "isRequest" | "respondedAt" | "status" | "paidAt">) =>
  !b.isRequest ? b.status !== "requested" : Boolean(b.respondedAt) && !(b.status === "cancelled_pro" && !b.paidAt);

async function liveIds(): Promise<Set<string>> {
  const { liveProWhere } = await import("@/lib/search");
  const rows = await db.select({ id: professionalProfiles.userId }).from(professionalProfiles).where(and(...liveProWhere(null, "place")));
  return new Set(rows.map((r) => r.id));
}

export async function loadServices(f: Filters): Promise<ServiceRow[]> {
  const where = [eq(proServices.active, true)];
  if (f.categoryId) where.push(eq(proServices.categoryId, f.categoryId));
  if (f.proId) where.push(eq(proServices.userId, f.proId));
  if (f.cityId) where.push(eq(professionalProfiles.cityId, f.cityId));
  if (f.state) where.push(eq(cities.state, f.state));
  const rows = await db.select({
    id: proServices.id, proId: proServices.userId, first: users.firstName, last: users.lastName, biz: professionalProfiles.businessName,
    categoryId: proServices.categoryId, category: categories.name, cityId: professionalProfiles.cityId, city: cities.name, state: cities.state,
    priceCents: proServices.priceCents, proPriceCents: proServices.proPriceCents, feeCents: proServices.serviceFeeCents, addons: proServices.addons, createdAt: proServices.createdAt,
  }).from(proServices)
    .innerJoin(users, eq(users.id, proServices.userId))
    .innerJoin(categories, eq(categories.id, proServices.categoryId))
    .leftJoin(professionalProfiles, eq(professionalProfiles.userId, proServices.userId))
    .leftJoin(cities, eq(cities.id, professionalProfiles.cityId))
    .where(and(...where));
  const live = await liveIds();
  return rows
    .map((r) => ({ id: r.id, proId: r.proId, proName: r.biz || [r.first, r.last].filter(Boolean).join(" ") || "Professional", categoryId: r.categoryId, category: r.category, cityId: r.cityId, city: r.city, state: r.state, priceCents: r.priceCents, proPriceCents: r.proPriceCents, feeCents: r.feeCents, addonCount: Array.isArray(r.addons) ? r.addons.length : 0, createdAt: r.createdAt, live: live.has(r.proId) }))
    .filter((r) => !f.liveOnly || r.live);
}

export async function loadBookings(f: Filters): Promise<{ rows: BookingRow[]; excludedModelCalls: number; excludedCampaign: number }> {
  const where = [];
  if (f.from) where.push(gte(bookings.createdAt, new Date(`${f.from}T00:00:00-06:00`)));
  if (f.to) where.push(lt(bookings.createdAt, new Date(new Date(`${f.to}T00:00:00-06:00`).getTime() + 86400000)));
  if (f.proId) where.push(eq(bookings.proId, f.proId));
  if (f.cityId) where.push(eq(professionalProfiles.cityId, f.cityId));
  if (f.state) where.push(eq(cities.state, f.state));
  const raw = await db.select({
    id: bookings.id, proId: bookings.proId, serviceId: bookings.serviceId, serviceName: bookings.serviceName, modelCallId: bookings.modelCallId, campaignEntryId: bookings.campaignEntryId, bundleId: bookings.bundleId,
    cityId: professionalProfiles.cityId, city: cities.name, state: cities.state,
    priceCents: bookings.priceCents, feeCents: bookings.serviceFeeCents, travelCents: bookings.travelFeeCents, addonsCents: bookings.addonsCents, discountCents: bookings.inviteDiscountCents,
    isRequest: bookings.isRequest, respondedAt: bookings.respondedAt, paidAt: bookings.paidAt, status: bookings.status, createdAt: bookings.createdAt, startsAt: bookings.startsAt,
  }).from(bookings)
    .leftJoin(professionalProfiles, eq(professionalProfiles.userId, bookings.proId))
    .leftJoin(cities, eq(cities.id, professionalProfiles.cityId))
    .where(where.length ? and(...where) : undefined);
  // Category: the booked service if it still exists; else the professional's current service with the same name
  // (menus are re-saved as new rows); Model Calls use their own category.
  const proIds = [...new Set(raw.map((r) => r.proId))];
  const byId = new Map<string, number>();
  const byName = new Map<string, number>();
  if (proIds.length) {
    const svc = await db.select({ id: proServices.id, userId: proServices.userId, name: proServices.name, categoryId: proServices.categoryId }).from(proServices).where(inArray(proServices.userId, proIds));
    for (const s of svc) { byId.set(s.id, s.categoryId); byName.set(`${s.userId}|${s.name.trim().toLowerCase()}`, s.categoryId); }
  }
  const mcIds = [...new Set(raw.map((r) => r.modelCallId).filter(Boolean))] as string[];
  const mcCat = new Map<string, number | null>();
  if (mcIds.length) for (const m of await db.select({ id: modelCalls.id, categoryId: modelCalls.categoryId }).from(modelCalls).where(inArray(modelCalls.id, mcIds))) mcCat.set(m.id, m.categoryId);
  const catNames = new Map((await db.select({ id: categories.id, name: categories.name }).from(categories)).map((c) => [c.id, c.name]));
  let excludedModelCalls = 0, excludedCampaign = 0;
  const rows: BookingRow[] = [];
  for (const r of raw) {
    const categoryId = r.modelCallId ? mcCat.get(r.modelCallId) ?? null : (r.serviceId && byId.get(r.serviceId)) || byName.get(`${r.proId}|${r.serviceName.trim().toLowerCase()}`) || null;
    if (f.categoryId && categoryId !== f.categoryId) continue;
    if (r.modelCallId) { excludedModelCalls++; continue; }
    if (r.campaignEntryId) { excludedCampaign++; continue; }
    rows.push({ id: r.id, proId: r.proId, serviceId: r.serviceId, serviceName: r.serviceName, modelCallId: r.modelCallId, campaign: Boolean(r.campaignEntryId), bundleId: r.bundleId,
      categoryId, category: categoryId ? catNames.get(categoryId) ?? null : null, cityId: r.cityId, city: r.city, state: r.state,
      priceCents: r.priceCents, feeCents: r.feeCents, travelCents: r.travelCents, addonsCents: r.addonsCents, discountCents: r.discountCents,
      isRequest: r.isRequest, respondedAt: r.respondedAt, paidAt: r.paidAt, status: r.status, createdAt: r.createdAt, startsAt: r.startsAt });
  }
  return { rows, excludedModelCalls, excludedCampaign };
}

type Group = { key: string; label: string; stats: Stats; count: number };
function groupStats<T>(rows: T[], key: (r: T) => string | null, label: (r: T) => string, value: (r: T) => number): Group[] {
  const m = new Map<string, { label: string; v: number[] }>();
  for (const r of rows) { const k = key(r); if (!k) continue; const g = m.get(k) ?? { label: label(r), v: [] }; g.v.push(value(r)); m.set(k, g); }
  return [...m.entries()].map(([k, g]) => ({ key: k, label: g.label, count: g.v.length, stats: stats(g.v) })).sort((a, b) => b.count - a.count);
}

export type Funnel = { requests: number; accepted: number; paid: number; completed: number; acceptRate: number | null; completeRate: number | null };
function funnel(rows: BookingRow[]): Funnel {
  const requests = rows.length, accepted = rows.filter(wasAccepted).length, paid = rows.filter((r) => r.paidAt).length, completed = rows.filter((r) => r.status === "completed").length;
  return { requests, accepted, paid, completed, acceptRate: requests >= MIN_FUNNEL ? pct(accepted, requests) : null, completeRate: requests >= MIN_FUNNEL ? pct(completed, requests) : null };
}

export async function priceHistory(f: Filters) {
  const rows = await db.select({ after: activityLog.after, before: activityLog.before, at: activityLog.createdAt, actor: activityLog.actorUserId }).from(activityLog)
    .where(and(eq(activityLog.action, "service.price_changed"), f.proId ? eq(activityLog.actorUserId, f.proId) : undefined, f.from ? gte(activityLog.createdAt, new Date(`${f.from}T00:00:00-06:00`)) : undefined))
    .orderBy(sql`${activityLog.createdAt} desc`).limit(500);
  return rows.map((r) => {
    const a = (r.after ?? {}) as { name?: string; priceCents?: number; categoryId?: number };
    const b = (r.before ?? {}) as { priceCents?: number };
    return { at: r.at, proId: r.actor, name: a.name ?? "", categoryId: a.categoryId ?? null, from: b.priceCents ?? null, to: a.priceCents ?? null };
  }).filter((r) => !f.categoryId || r.categoryId === f.categoryId);
}

export type Insight = { tone: "info" | "watch"; text: string };

export async function pricingIntel(f: Filters) {
  const services = await loadServices(f);
  const { rows: books, excludedModelCalls, excludedCampaign } = await loadBookings(f);
  const completed = books.filter((b) => b.status === "completed");
  const total = services.length;

  // 1 + 3. Distribution of listed prices
  const listedBands = BANDS.map((b) => { const n = services.filter((s) => b.test(s.priceCents)).length; return { key: b.key, label: b.label, n, pct: pct(n, total) }; }).filter((b) => b.key !== "gt150" || b.n > 0);
  const completedBands = BANDS.map((b) => { const n = completed.filter((c) => b.test(bookedServiceCents(c))).length; return { key: b.key, label: b.label, n, pct: pct(n, completed.length) }; }).filter((b) => b.key !== "gt150" || b.n > 0);
  const histogram: { from: number; n: number }[] = [];
  for (let from = 0; from <= 15000; from += 1000) histogram.push({ from, n: services.filter((s) => (from === 15000 ? s.priceCents >= 15000 : s.priceCents >= from && s.priceCents < from + 1000)).length });

  // 2. Listed prices by category / city / state
  const listed = {
    all: stats(services.map((s) => s.priceCents)),
    proAll: stats(services.filter((s) => s.proPriceCents != null).map((s) => s.proPriceCents!)),
    byCategory: groupStats(services, (s) => String(s.categoryId), (s) => s.category, (s) => s.priceCents),
    byCity: groupStats(services, (s) => (s.cityId ? String(s.cityId) : null), (s) => `${s.city}, ${s.state}`, (s) => s.priceCents),
    byState: groupStats(services, (s) => s.state, (s) => s.state ?? "", (s) => s.priceCents),
  };
  const completedPrices = {
    all: stats(completed.map(bookedServiceCents)),
    byCategory: groupStats(completed, (b) => (b.categoryId ? String(b.categoryId) : null), (b) => b.category ?? "Unknown", bookedServiceCents),
    byCity: groupStats(completed, (b) => (b.cityId ? String(b.cityId) : null), (b) => `${b.city}, ${b.state}`, bookedServiceCents),
    byState: groupStats(completed, (b) => b.state, (b) => b.state ?? "", bookedServiceCents),
  };

  // 4. Individual vs bundled
  const ind = books.filter((b) => !b.bundleId), bun = books.filter((b) => b.bundleId);
  const side = (rows: BookingRow[]) => { const c = rows.filter((r) => r.status === "completed"); return { funnel: funnel(rows), price: stats(c.map(bookedServiceCents)), spend: stats(c.map((r) => r.priceCents - r.discountCents)) }; };
  // Like-for-like: the same professional's same service, booked both ways and completed.
  const key = (b: BookingRow) => `${b.proId}|${b.serviceName.trim().toLowerCase()}`;
  const pairs = new Map<string, { i: number[]; b: number[]; name: string }>();
  for (const b of completed) { const p = pairs.get(key(b)) ?? { i: [], b: [], name: b.serviceName }; (b.bundleId ? p.b : p.i).push(bookedServiceCents(b)); pairs.set(key(b), p); }
  const matched = [...pairs.values()].filter((p) => p.i.length && p.b.length);
  const matchedDiff = matched.length >= 3 ? Math.round(matched.reduce((t, p) => t + (p.b.reduce((a, v) => a + v, 0) / p.b.length - p.i.reduce((a, v) => a + v, 0) / p.i.length), 0) / matched.length) : null;
  const bundles = { individual: side(ind), bundled: side(bun), matchedServices: matched.length, matchedAvgDiffCents: matchedDiff };

  // 5. Funnel by price range (views aren't tracked)
  const funnelByBand = BANDS.map((b) => ({ key: b.key, label: b.label, ...funnel(books.filter((r) => b.test(bookedServiceCents(r)))) })).filter((b) => b.key !== "gt150" || b.requests > 0);
  const funnelAll = funnel(books);

  // 6. Spend per completed booking
  const spend = {
    total: stats(completed.map((b) => b.priceCents - b.discountCents)),
    service: stats(completed.map((b) => bookedServiceCents(b) - b.feeCents)),
    fee: stats(completed.map((b) => b.feeCents), 1),
    addons: stats(completed.map((b) => b.addonsCents), 1),
    travel: stats(completed.map((b) => b.travelCents), 1),
    discount: stats(completed.map((b) => b.discountCents), 1),
    addonAttach: pct(completed.filter((b) => b.addonsCents > 0).length, completed.length),
    travelShare: pct(completed.filter((b) => b.travelCents > 0).length, completed.length),
  };

  // 7. What produces completed bookings
  const leaders = {
    categories: groupStats(completed, (b) => (b.categoryId ? String(b.categoryId) : "none"), (b) => b.category ?? "Unknown (service since removed)", bookedServiceCents).map((g) => ({ ...g, pct: pct(g.count, completed.length) })),
    bands: completedBands.slice().sort((a, b) => b.n - a.n),
    cells: (() => {
      const m = new Map<string, { category: string; band: string; n: number }>();
      for (const b of completed) { const bk = bandOf(bookedServiceCents(b)); const k = `${b.category ?? "Unknown"}|${bk}`; const c = m.get(k) ?? { category: b.category ?? "Unknown", band: BANDS.find((x) => x.key === bk)!.label, n: 0 }; c.n++; m.set(k, c); }
      return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 10).map((c) => ({ ...c, pct: pct(c.n, completed.length) }));
    })(),
  };

  // 8. Over time: booked prices by month (real snapshots) + listed-price change log
  const months = new Map<string, number[]>();
  for (const b of completed) { const k = b.startsAt.toISOString().slice(0, 7); months.set(k, [...(months.get(k) ?? []), bookedServiceCents(b)]); }
  const byMonth = [...months.entries()].sort().slice(-12).map(([m, v]) => ({ month: m, n: v.length, stats: stats(v) }));
  const history = await priceHistory(f);

  // 9. Comparisons with enough data
  const cityCompare = completedPrices.byCity.filter((g) => g.stats).length >= 2 || listed.byCity.filter((g) => g.stats).length >= 2;
  const stateCompare = completedPrices.byState.filter((g) => g.stats).length >= 2 || listed.byState.filter((g) => g.stats).length >= 2;

  // 10. Insights — descriptive only; never a judgment that a price is "too high".
  const insights: Insight[] = [];
  const topListed = listedBands.slice().sort((a, b) => b.n - a.n)[0];
  if (total >= MIN_SAMPLE && topListed) insights.push({ tone: "info", text: `${topListed.pct}% of listed services (${topListed.n} of ${total}) are priced ${topListed.label.toLowerCase()}.` });
  if (listed.all && completedPrices.all) {
    const d = completedPrices.all.median - listed.all.median;
    if (Math.abs(d) >= 500) insights.push({ tone: "info", text: `The median completed booking is ${money(Math.abs(d))} ${d < 0 ? "below" : "above"} the median listed price (${money(completedPrices.all.median)} vs ${money(listed.all.median)}). Listings and what students actually book differ — compare the two before drawing conclusions.` });
    else insights.push({ tone: "info", text: `Completed bookings are priced close to listings (median ${money(completedPrices.all.median)} booked vs ${money(listed.all.median)} listed).` });
  }
  const rated = funnelByBand.filter((b) => b.completeRate != null);
  if (rated.length >= 2) {
    const hi = rated.reduce((a, b) => (b.completeRate! > a.completeRate! ? b : a)), lo = rated.reduce((a, b) => (b.completeRate! < a.completeRate! ? b : a));
    if (hi.completeRate! - lo.completeRate! >= 15) insights.push({ tone: "watch", text: `Requests priced ${hi.label.toLowerCase()} completed at ${hi.completeRate}% vs ${lo.completeRate}% for ${lo.label.toLowerCase()}. This is a correlation — category, timing and the professional also affect completion.` });
  }
  const topCat = leaders.categories[0];
  if (completed.length >= MIN_SAMPLE && topCat) insights.push({ tone: "info", text: `${topCat.label} produces the most completed bookings: ${topCat.count} (${topCat.pct}%).` });
  if (leaders.cells[0] && completed.length >= MIN_SAMPLE) insights.push({ tone: "info", text: `Most common completed combination: ${leaders.cells[0].category} at ${leaders.cells[0].band.toLowerCase()} (${leaders.cells[0].n} bookings).` });
  if (spend.addonAttach != null && completed.length >= MIN_SAMPLE) insights.push({ tone: "info", text: `${spend.addonAttach}% of completed bookings included at least one add-on.` });
  if (bundles.matchedAvgDiffCents != null) insights.push({ tone: "info", text: `For ${bundles.matchedServices} services booked both individually and through Bundle Me, the bundled price averaged ${money(Math.abs(bundles.matchedAvgDiffCents))} ${bundles.matchedAvgDiffCents < 0 ? "less" : "more"}.` });
  const nearCap = listed.byCategory.filter((g) => g.stats && g.stats.median >= 14000);
  if (nearCap.length) insights.push({ tone: "watch", text: `Median listed price is within $10 of the $150 limit in ${nearCap.map((g) => g.label).join(", ")}. Not a problem by itself — worth watching completion there.` });
  const over = services.filter((s) => s.priceCents > 15000).length;
  if (over) insights.push({ tone: "watch", text: `${over} listed service${over === 1 ? "" : "s"} show a price above $150 — likely saved before the limit; check these listings.` });
  if (!insights.length) insights.push({ tone: "info", text: "Insufficient data for insights yet. They appear once there are enough listings and bookings." });

  return { filters: f, totals: { services: total, pros: new Set(services.map((s) => s.proId)).size, bookings: books.length, completed: completed.length, excludedModelCalls, excludedCampaign },
    listedBands, completedBands, histogram, listed, completedPrices, bundles, funnelByBand, funnelAll, spend, leaders, byMonth, history, cityCompare, stateCompare, insights };
}

export const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

/** Filter options for the page. */
export async function filterOptions() {
  const [cats, cs, pros] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(categories.sort),
    db.select({ id: cities.id, name: cities.name, state: cities.state }).from(cities).orderBy(cities.state, cities.name),
    db.selectDistinct({ id: users.id, first: users.firstName, last: users.lastName, biz: professionalProfiles.businessName }).from(proServices)
      .innerJoin(users, eq(users.id, proServices.userId)).leftJoin(professionalProfiles, eq(professionalProfiles.userId, users.id)),
  ]);
  return { categories: cats, cities: cs, states: [...new Set(cs.map((c) => c.state))].sort(), pros: pros.map((p) => ({ id: p.id, name: p.biz || [p.first, p.last].filter(Boolean).join(" ") || "Professional" })).sort((a, b) => a.name.localeCompare(b.name)) };
}
