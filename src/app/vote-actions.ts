"use server";
import { and, asc, eq, ne, lte, sql } from "drizzle-orm";
import { db, cities, schools, categories, studentVotes, professionalProfiles, proServices, cityCounties, counties, users, nearestCardBatches } from "@/db";
import { liveProWhere } from "@/lib/search";
import { MAX_PRICE_CENTS } from "@/lib/pricing";
import { getViewer } from "@/lib/viewer";
import { checkCampaign, voteSession, activateVoucher, benefitLine, VOUCHER } from "@/lib/vouchers";

const FREE_REDEEM = "Redeem for one eligible free service selected by a participating professional.";
import { digits } from "@/lib/nearest-cards";
import { voteSourceOptions } from "@/lib/distribution";
import { adVisits } from "@/db";
import { readAttribution, sendAdEvent } from "@/lib/ad-tags";
import { currentTap } from "@/lib/tap-links";
import { spin, scratch, holdWithEmail, mySpin, liveOnlineCampaign, wheelSegments } from "@/lib/reward-wheel";

/**
 * "YOUR CITY. YOUR CHOICE." — the public /card voucher flow (2026-11-11). No account needed to vote: state → city they
 * live in → school → services → thank you → enter the voucher number + code → finish creating the account. The vote is
 * saved (anonymous session cookie) before the thank-you screen and linked on sign-up/sign-in (claimVote in src/lib/vouchers.ts).
 */
const HIDDEN = new Set(["Other", "Photography"]);

/** Cities in a state (city of residence). */
export async function voteCities(state: string) {
  const st = String(state ?? "").toUpperCase().slice(0, 2);
  if (!/^[A-Z]{2}$/.test(st)) return [];
  return db.select({ id: cities.id, name: cities.name }).from(cities).where(and(eq(cities.state, st), eq(cities.active, true))).orderBy(asc(cities.name)).limit(3000);
}

/** Schools in the chosen city (the student can also type one that isn't listed). */
export async function voteSchools(cityId: number) {
  if (!Number.isInteger(cityId)) return [];
  return db.select({ id: schools.id, name: schools.name, type: schools.type }).from(schools)
    .where(and(eq(schools.cityId, cityId), eq(schools.active, true))).orderBy(asc(schools.name)).limit(500);
}

/**
 * Service categories with a REAL example price: the lowest listed student price of a live professional in that category,
 * in the student's city — or their market when their city has none yet. No price = nobody lists it there yet.
 */
export async function voteServices(cityId: number) {
  const cats = (await db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort))).filter((c) => !HIDDEN.has(c.name));
  if (!Number.isInteger(cityId)) return cats.map((c) => ({ name: c.name, fromCents: null as number | null, near: false }));
  const market = (await db.select({ market: counties.market }).from(cityCounties).innerJoin(counties, eq(counties.id, cityCounties.countyId)).where(eq(cityCounties.cityId, cityId)).limit(1))[0]?.market ?? null;
  const rows = await db.select({
    category: proServices.categoryId,
    city: sql<number>`min(${proServices.priceCents}) filter (where ${professionalProfiles.cityId} = ${cityId})`,
    area: sql<number>`min(${proServices.priceCents})`,
  }).from(proServices)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, proServices.userId))
    .where(and(eq(proServices.active, true), lte(proServices.priceCents, MAX_PRICE_CENTS), ne(proServices.showOn, "partner"), ...liveProWhere(null, "place"),
      market ? sql`exists (select 1 from city_counties cc join counties co on co.id = cc.county_id where cc.city_id = ${professionalProfiles.cityId} and co.market = ${market})` : sql`${professionalProfiles.cityId} = ${cityId}`))
    .groupBy(proServices.categoryId);
  const by = new Map(rows.map((r) => [r.category, r]));
  return cats.map((c) => {
    const r = by.get(c.id);
    return { name: c.name, fromCents: r ? Number(r.city ?? r.area) : null, near: !!r && r.city == null };
  });
}

/** Save (or update) this browser's vote. Saved BEFORE the thank-you screen. */
export async function submitVote(input: { state: string; cityId: number; schoolId: number | null; schoolOther: string; categories: string[]; online?: boolean; tap?: boolean }): Promise<{ ok: true; eventId?: string } | { error: string }> {
  const state = String(input.state ?? "").toUpperCase().slice(0, 2);
  const city = Number.isInteger(input.cityId) ? await db.query.cities.findFirst({ where: and(eq(cities.id, input.cityId), eq(cities.state, state)) }) : null;
  if (!city) return { error: "Choose your state and the city you live in." };
  const school = input.schoolId ? await db.query.schools.findFirst({ where: eq(schools.id, input.schoolId) }) : null;
  const other = String(input.schoolOther ?? "").trim().slice(0, 120);
  if (!school && !other) return { error: "Choose your school, or type it if it isn't listed." };
  const online = !!input.online;
  // Tap link (/t/<slug> → /card?tap=1): checked again here from the cookie — never trusted from the browser.
  const tap = !online && input.tap ? await currentTap() : null;
  if (!online && input.tap && !tap) return { error: "This tap link has ended. Ask the Nearest team member to tap again, or use a printed GRANTED card." };
  // Where a printed card came from is asked AFTER the card is entered (saveVoucherSource) — the card names the distributor.
  const kind = tap ? "tap" : "";
  const sourceText = tap ? `Tap — ${tap.name}` : null;
  const valid = new Set((await db.select({ name: categories.name }).from(categories)).map((c) => c.name));
  const picks = [...new Set((input.categories ?? []).map(String).filter((c) => valid.has(c) && !HIDDEN.has(c)))].slice(0, 20);
  if (!picks.length) return { error: "Pick at least one service you'd like in your city." };
  const sid = (await voteSession(true))!;
  const viewer = await getViewer();
  const userId = viewer?.user?.accountType === "student" ? viewer.user.id : null;
  const visit = online ? (await db.select().from(adVisits).where(eq(adVisits.sessionId, sid)).orderBy(sql`${adVisits.createdAt} desc`).limit(1))[0] : undefined;
  const values = { state, cityId: city.id, schoolId: school?.id ?? null, schoolOther: school ? null : other, categories: picks, ...(online || tap ? { sourceKind: kind || null, sourcePlaceId: null, sourceText } : {}),
    channel: online ? "online" : tap ? "tap" : "physical", platform: online ? (visit?.platform ?? "direct") : null, adVisitId: visit?.id ?? null,
    tapUserId: tap?.userId ?? null, ...(tap ? { pendingBatchId: tap.batchId } : {}), updatedAt: new Date() };
  await db.insert(studentVotes).values({ sessionId: sid, ...values, ...(userId ? { userId, linkedAt: new Date() } : {}) })
    .onConflictDoUpdate({ target: studentVotes.sessionId, set: values });
  if (online) { await sendAdEvent("Vote", `vote-${sid}`); return { ok: true, eventId: `vote-${sid}` }; }
  return { ok: true };
}

/**
 * Thank-you screen: the student types the 16-digit number + code. Signed-in students get it activated right away;
 * everyone else has it held on their vote and activated the moment their account is created (claimVote).
 */
export async function enterVoucher(rawNumber: string, rawCode: string): Promise<VoucherResult | SourceAsk> {
  const number = digits(rawNumber), code = digits(rawCode);
  const sid = await voteSession(true);
  const v = sid ? await db.query.studentVotes.findFirst({ where: eq(studentVotes.sessionId, sid) }) : null;
  if (!v) return { error: "Please vote first — then add your voucher." };
  const hourAgo = Date.now() - 3600000;
  const tries = v.voucherTriedAt && v.voucherTriedAt.getTime() > hourAgo ? v.voucherTries : 0;
  if (tries >= VOUCHER.triesPerHour) return { error: "Too many tries. For your security, try again in an hour." };
  const fail = async (error: string) => {
    await db.update(studentVotes).set({ voucherTries: tries + 1, voucherTriedAt: new Date() }).where(eq(studentVotes.id, v.id));
    return { error };
  };
  if (number.length !== 16) return fail("Enter all 16 digits of the number on your voucher.");
  if (code.length !== 3 && code.length !== 4) return fail("Enter the security code on your voucher — 3 digits (discount) or 4 digits (free service).");
  const camp = await checkCampaign(number, code);
  if (!camp) return fail("We couldn't find that voucher number. Check the 16 digits and try again.");
  if (!camp.ok) return fail(camp.error);
  await db.update(studentVotes).set({ pendingBatchId: camp.batch.id }).where(eq(studentVotes.id, v.id));
  // Next: "Where did you get it?" — only this distributor's places + "<Name> gave it to me directly".
  const who = await distributorFor(camp.batch.distributorId);
  if (who) return { source: { name: who.name, places: await voteSourceOptions(who.id) } };
  return finishVoucher(camp.batch);
}

type VoucherResult = { ok: string; signedIn: boolean; scratch?: boolean } | { error: string };
type SourceAsk = { source: { name: string; places: Awaited<ReturnType<typeof voteSourceOptions>> } };

/** The distributor named by a card (first name shown to the student). */
async function distributorFor(id: string | null) {
  if (!id) return null;
  const u = await db.query.users.findFirst({ where: eq(users.id, id), columns: { id: true, firstName: true } });
  return u ? { id: u.id, name: u.firstName?.trim() || "A Nearest team member" } : null;
}

/** After the card (and where it came from): scratch-off, or activate / hold the voucher. */
async function finishVoucher(batch: typeof nearestCardBatches.$inferSelect): Promise<VoucherResult> {
  const viewer = await getViewer();
  const student = viewer?.user?.accountType === "student";
  // Universal GRANTED card: the distributor's pool is on the vote — the reward is revealed by the scratch-off.
  if (batch.scratch) return { ok: "Card accepted. Scratch to reveal your reward.", signedIn: student, scratch: true };
  if (student) {
    const r = await activateVoucher(viewer!.user!.id, batch);
    return "ok" in r && r.ok ? { ok: `Voucher accepted: ${benefitLine(batch.kind, batch.amountCents)}.${batch.kind === "free" ? ` ${FREE_REDEEM}` : ""} It's now linked to your student account.`, signedIn: true } : { error: (r as { error: string }).error };
  }
  return { ok: batch.kind === "free"
    ? `Voucher accepted: ${benefitLine("free", 0)}. ${FREE_REDEEM} Your voucher will be linked to your student account after registration and verification.`
    : `Voucher accepted: ${benefitLine(batch.kind, batch.amountCents)}. It will be linked to your student account after you register and verify.`, signedIn: false };
}

/**
 * "Where did you get your card?" — asked right after the card is entered. place = one of THAT distributor's
 * organizations, "direct" = "<Name> gave it to me directly", "other" = typed name. Saved on the vote, then the
 * voucher continues (scratch-off or activation), so attributeActivation sees the answer.
 */
export async function saveVoucherSource(choice: string, text: string): Promise<VoucherResult> {
  const sid = await voteSession(false);
  const v = sid ? await db.query.studentVotes.findFirst({ where: eq(studentVotes.sessionId, sid) }) : null;
  const batch = v?.pendingBatchId ? await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.id, v.pendingBatchId) }) : null;
  if (!v || !batch) return { error: "Please enter your card number and code first." };
  const who = await distributorFor(batch.distributorId);
  const c = String(choice ?? "");
  let set: { sourceKind: string; sourcePlaceId: string | null; sourceText: string | null };
  if (c === "direct" && who) set = { sourceKind: "distributor", sourcePlaceId: null, sourceText: `${who.name} (directly)` };
  else if (c === "other") set = { sourceKind: "other", sourcePlaceId: null, sourceText: String(text ?? "").trim().slice(0, 120) || null };
  else {
    const place = who ? (await voteSourceOptions(who.id)).find((o) => o.id === c) : undefined;
    if (!place) return { error: "Choose where you got your card." };
    set = { sourceKind: "org", sourcePlaceId: place.id, sourceText: null };
  }
  await db.update(studentVotes).set({ ...set, updatedAt: new Date() }).where(eq(studentVotes.id, v.id));
  return finishVoucher(batch);
}

/** /vote landing: remember where this visitor came from (first-party), once per session + source. */
export async function recordAdVisit(params: Record<string, string>, landing: string, referrer: string) {
  const sid = (await voteSession(true))!;
  const a = readAttribution(Object.fromEntries(Object.entries(params ?? {}).map(([k, v]) => [String(k).slice(0, 40), String(v)])), String(referrer ?? ""));
  const last = (await db.select().from(adVisits).where(eq(adVisits.sessionId, sid)).orderBy(sql`${adVisits.createdAt} desc`).limit(1))[0];
  // A direct reload never replaces a real ad source; the same ad within 30 minutes isn't counted twice.
  if (last && (a.platform === "direct" || (last.platform === a.platform && last.campaign === a.campaign && Date.now() - last.createdAt.getTime() < 30 * 60000))) return;
  await db.insert(adVisits).values({ sessionId: sid, ...a, landing: String(landing ?? "").slice(0, 300) || null });
}

/** The wheel as the student sees it: segments (labels only) and their own spin if they already spun. */
export async function wheelInfo() {
  const camp = await liveOnlineCampaign();
  const segments = camp ? (await wheelSegments(camp.id)).filter((x) => x.remaining > 0).map((x) => ({ id: x.id, label: x.label, kind: x.kind })) : [];
  const s = await mySpin();
  return { open: !!camp && segments.length > 0, rules: camp?.rulesText ?? "", segments, spin: s ? { batchId: s.batchId, label: s.label, kind: s.kind, status: s.status, holdUntil: s.holdUntil.toISOString(), email: s.email } : null };
}

/** Spin once — the server picks and saves the result; the wheel only animates to it. */
export async function spinWheel() {
  const viewer = await getViewer();
  const r = await spin({ userId: viewer?.user?.accountType === "student" ? viewer.user.id : null });
  if (!r.ok) return { error: r.error };
  await sendAdEvent("Spin", `spin-${r.spin.id}`);
  return { batchId: r.spin.batchId, label: r.spin.label, kind: r.spin.kind, holdUntil: r.spin.holdUntil.toISOString(), eventId: `spin-${r.spin.id}` };
}

/** Hold the reward for 3 days with an email. */
export async function holdReward(email: string) {
  const r = await holdWithEmail(email);
  return r.ok ? { ok: true as const, holdUntil: r.holdUntil.toISOString() } : { error: r.error };
}

/** The confirmation shown once a scratch-off reward is revealed (same wording as the printed vouchers). */
const revealLine = (kind: string, amountCents: number) => kind === "free"
  ? `Voucher accepted: ${benefitLine("free", 0)}. ${FREE_REDEEM} Your voucher will be linked to your student account after registration and verification.`
  : `Voucher accepted: ${benefitLine(kind, amountCents)}. It will be linked to your student account after you register and verify.`;

/** This browser's scratch-off result, if it already scratched (coming back shows the same reward). */
export async function scratchInfo() {
  const s = await mySpin();
  return s ? { label: s.label, kind: s.kind, status: s.status, holdUntil: s.holdUntil.toISOString(), email: s.email, line: revealLine(s.kind, s.amountCents) } : null;
}

/** Scratch once — the server picks and saves the reward first; the card only uncovers what was saved. */
export async function scratchCard() {
  const viewer = await getViewer();
  const r = await scratch({ userId: viewer?.user?.accountType === "student" ? viewer.user.id : null });
  if (!r.ok) return { error: r.error };
  return { label: r.spin.label, kind: r.spin.kind, holdUntil: r.spin.holdUntil.toISOString(), line: revealLine(r.spin.kind, r.spin.amountCents) };
}
