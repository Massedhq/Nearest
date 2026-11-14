"use server";
import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { db, onlineCampaigns, nearestCardBatches, adSpend, platformSettings } from "@/db";
import { requireAdmin, isMainOwner } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { chicagoToUtc } from "@/lib/time";
import { CARD_LIMITS } from "@/lib/nearest-cards";
import { ONLINE_FREE_MAX, rewardLabel } from "@/lib/reward-wheel";

/**
 * Nearest LIVE & Digital Rewards (main owner only — every action re-checks). Online campaigns, wheel segments
 * (digital batches: type, $ off, how many, odds), ad spend, and showing the live map publicly. All logged.
 */
type FormState = { error?: string; ok?: string };
const s = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const refresh = () => { revalidatePath("/admin/live"); revalidatePath("/vote"); revalidatePath("/live"); };
const ID = /^[0-9a-f-]{36}$/;

async function main() {
  const { user } = await requireAdmin();
  if (!(await isMainOwner(user.id))) throw new Error("Only the main owner can do this.");
  return user;
}
const endOfMonth = (ym: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return null;
  const last = new Date(Date.UTC(+m[1], +m[2], 0)).getUTCDate();
  return chicagoToUtc(`${m[1]}-${m[2]}-${String(last).padStart(2, "0")}`, "23:59");
};
const dt = (v: string) => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? chicagoToUtc(v.slice(0, 10), v.slice(11, 16)) : null);

/** Create or change an online campaign (dates, where, holds, spin limit, card Valid thru, official rules). */
export async function saveOnlineCampaign(_: FormState, form: FormData): Promise<FormState> {
  const user = await main();
  const id = s(form, "id", 40);
  const name = s(form, "name", 80);
  const startsAt = dt(s(form, "startsAt", 20)), endsAt = dt(s(form, "endsAt", 20));
  const states = s(form, "states", 100).toUpperCase().split(/[\s,]+/).filter((x) => /^[A-Z]{2}$/.test(x));
  const holdHours = Math.round(Number(s(form, "holdHours", 4)));
  const quickHoldMinutes = Math.round(Number(s(form, "quickHoldMinutes", 4)));
  const spinsPerHourPerNetwork = Math.round(Number(s(form, "spinsPerHour", 4)));
  const validThru = endOfMonth(s(form, "validThru", 7));
  const rulesText = s(form, "rulesText", 8000);
  if (!name) return { error: "Name the campaign." };
  if (startsAt && endsAt && endsAt <= startsAt) return { error: "The end has to be after the start." };
  if (!(holdHours >= 1 && holdHours <= 720)) return { error: "Hold time with an email: 1 to 720 hours (3 days = 72)." };
  if (!(quickHoldMinutes >= 5 && quickHoldMinutes <= 1440)) return { error: "Hold time without an email: 5 to 1,440 minutes." };
  if (!(spinsPerHourPerNetwork >= 1 && spinsPerHourPerNetwork <= 1000)) return { error: "Spins per hour from one network: 1 to 1,000." };
  if (!validThru) return { error: "Enter the cards' Valid thru month." };
  const values = { name, startsAt, endsAt, states: states.length ? states : ["TX"], holdHours, quickHoldMinutes, spinsPerHourPerNetwork, validThru, rulesText, updatedAt: new Date() };
  if (id) {
    if (!ID.test(id)) return { error: "Campaign not found." };
    const before = (await db.select().from(onlineCampaigns).where(eq(onlineCampaigns.id, id)))[0];
    if (!before) return { error: "Campaign not found." };
    await db.update(onlineCampaigns).set(values).where(eq(onlineCampaigns.id, id));
    await db.update(nearestCardBatches).set({ validThru }).where(eq(nearestCardBatches.onlineCampaignId, id));
    await logActivity({ actorUserId: user.id, action: "live.campaign_changed", targetType: "online_campaign", targetId: id, before, after: values });
    refresh();
    return { ok: "Saved." };
  }
  const [c] = await db.insert(onlineCampaigns).values({ ...values, createdBy: user.id }).returning();
  await logActivity({ actorUserId: user.id, action: "live.campaign_added", targetType: "online_campaign", targetId: c.id, after: values });
  refresh();
  return { ok: `${name} saved as a draft. Add the wheel's rewards, then Go live.` };
}

/** Go live / pause / end. Going live needs rewards with odds, official rules and a future Valid thru; one live at a time. */
export async function setOnlineCampaignStatus(form: FormData) {
  const user = await main();
  const id = s(form, "id", 40), to = s(form, "to", 10);
  if (!ID.test(id) || !["live", "paused", "ended", "draft"].includes(to)) return;
  const c = (await db.select().from(onlineCampaigns).where(eq(onlineCampaigns.id, id)))[0];
  if (!c) return;
  if (to === "live") {
    const segs = await db.select().from(nearestCardBatches).where(and(eq(nearestCardBatches.onlineCampaignId, id), sql`${nearestCardBatches.weight} > 0 and ${nearestCardBatches.count} > 0`));
    if (!segs.length || !c.rulesText.trim() || c.validThru.getTime() < Date.now()) return;
    await db.update(onlineCampaigns).set({ status: "paused", updatedAt: new Date() }).where(and(eq(onlineCampaigns.status, "live"), ne(onlineCampaigns.id, id)));
  }
  await db.update(onlineCampaigns).set({ status: to, updatedAt: new Date() }).where(eq(onlineCampaigns.id, id));
  await logActivity({ actorUserId: user.id, action: "live.campaign_status", targetType: "online_campaign", targetId: id, before: { status: c.status }, after: { status: to } });
  refresh();
}

/**
 * Add or change one wheel reward: discount ($5–$40 off) or free service (covers the whole eligible service), how many,
 * and its odds. Free service across EVERY online campaign can never pass ONLINE_FREE_MAX (100).
 */
export async function saveSegment(_: FormState, form: FormData): Promise<FormState> {
  const user = await main();
  const id = s(form, "id", 40), campaignId = s(form, "campaignId", 40);
  const camp = ID.test(campaignId) ? (await db.select().from(onlineCampaigns).where(eq(onlineCampaigns.id, campaignId)))[0] : undefined;
  if (!camp) return { error: "Campaign not found." };
  const kind = s(form, "kind", 10) === "free" ? "free" : "discount";
  const amountCents = kind === "free" ? CARD_LIMITS.freeMax : Math.round(Number(s(form, "amount", 10)) * 100);
  const count = Math.round(Number(s(form, "count", 7)));
  const weight = Math.round(Number(s(form, "weight", 6)));
  if (kind === "discount" && !(amountCents >= CARD_LIMITS.discountMin && amountCents <= CARD_LIMITS.discountMax)) return { error: `A discount is $${CARD_LIMITS.discountMin / 100} to $${CARD_LIMITS.discountMax / 100} off.` };
  if (!(count >= 1 && count <= 100000)) return { error: "Enter how many of this reward." };
  if (!(weight >= 0 && weight <= 100000)) return { error: "Odds: a whole number, 0 or more (0 takes it off the wheel)." };
  const before = id && ID.test(id) ? (await db.select().from(nearestCardBatches).where(and(eq(nearestCardBatches.id, id), eq(nearestCardBatches.channel, "digital"))))[0] : undefined;
  if (id && !before) return { error: "Reward not found." };
  if (before && count < before.claimed) return { error: `${before.claimed} of these are already won — the number can't be lower than that.` };
  if (kind === "free") {
    const other = (await db.execute(sql`select coalesce(sum(count), 0)::int as n from nearest_card_batches where channel = 'digital' and kind = 'free' ${before ? sql`and id <> ${before.id}` : sql``}`)).rows[0] as { n: number };
    if (other.n + count > ONLINE_FREE_MAX) return { error: `Online free-service rewards are capped at ${ONLINE_FREE_MAX} in total. ${Math.max(0, ONLINE_FREE_MAX - other.n)} left to give.` };
  }
  const name = `${camp.name} — ${rewardLabel(kind, amountCents)}`;
  if (before) {
    if (before.claimed > 0 && (before.kind !== kind || before.amountCents !== amountCents)) return { error: "Students already won this reward, so its type and amount can't change. Set its odds to 0 and add a new one." };
    await db.update(nearestCardBatches).set({ name, kind, amountCents, count, weight }).where(eq(nearestCardBatches.id, before.id));
    await logActivity({ actorUserId: user.id, action: "live.reward_changed", targetType: "wheel_reward", targetId: before.id, before: { kind: before.kind, amountCents: before.amountCents, count: before.count, weight: before.weight }, after: { kind, amountCents, count, weight } });
    refresh();
    return { ok: "Saved." };
  }
  const [b] = await db.insert(nearestCardBatches).values({ name, kind, amountCents, count, weight, validThru: camp.validThru, channel: "digital", onlineCampaignId: camp.id, createdBy: user.id }).returning();
  await logActivity({ actorUserId: user.id, action: "live.reward_added", targetType: "wheel_reward", targetId: b.id, after: { campaign: camp.name, kind, amountCents, count, weight } });
  refresh();
  return { ok: `${rewardLabel(kind, amountCents)} added to the wheel.` };
}

/** Record ad spend from Meta / Google for cost per vote. */
export async function addAdSpend(_: FormState, form: FormData): Promise<FormState> {
  const user = await main();
  const platform = ["facebook", "instagram", "google", "other"].includes(s(form, "platform", 20)) ? s(form, "platform", 20) : "";
  const campaign = s(form, "campaign", 120);
  const amountCents = Math.round(Number(s(form, "amount", 12)) * 100);
  const fromDay = s(form, "fromDay", 10), toDay = s(form, "toDay", 10);
  if (!platform) return { error: "Choose the platform." };
  if (!campaign) return { error: "Enter the campaign name exactly as in the ad link's utm_campaign." };
  if (!(amountCents > 0)) return { error: "Enter what was spent." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDay) || !/^\d{4}-\d{2}-\d{2}$/.test(toDay) || toDay < fromDay) return { error: "Enter the dates the spend covers." };
  const [r] = await db.insert(adSpend).values({ platform, campaign, amountCents, fromDay, toDay, createdBy: user.id }).returning();
  await logActivity({ actorUserId: user.id, action: "live.spend_added", targetType: "ad_spend", targetId: r.id, after: { platform, campaign, amountCents, fromDay, toDay } });
  refresh();
  return { ok: "Spend saved." };
}

/** Show Nearest LIVE to everyone, or owners only. */
export async function setLivePublic(form: FormData) {
  const user = await main();
  const on = s(form, "on", 5) === "1";
  await db.insert(platformSettings).values({ key: "live.public", value: on, updatedBy: user.id }).onConflictDoUpdate({ target: platformSettings.key, set: { value: on, updatedBy: user.id, updatedAt: new Date() } });
  await logActivity({ actorUserId: user.id, action: "live.public", targetType: "setting", targetId: "live.public", after: { on } });
  refresh();
}
