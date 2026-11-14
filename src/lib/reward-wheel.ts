import "server-only";
import { createHash, randomBytes, randomInt } from "crypto";
import { cookies, headers } from "next/headers";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, onlineCampaigns, nearestCardBatches, nearestCards, rewardSpins, studentVotes, users } from "@/db";
import { voteSession } from "./vouchers";

/**
 * Online GRANTED reward wheel (2026-11-13). Students who vote on /vote (from an ad or directly) spin once:
 *  - the SERVER picks the reward from the live online campaign's segments (nearest_card_batches with channel "digital",
 *    weight = odds, count = inventory) and reserves it in ONE statement before the wheel animates — the animation only
 *    shows what was recorded; nothing the browser sends can change it;
 *  - one spin per vote (unique vote_id); a short hold without an email, campaign.holdHours (3 days) with an email;
 *    expired holds go back to the inventory (expireSpins, cron sweep);
 *  - the reward becomes the student's own digital GRANTED card (16-digit number, 3-digit code discount / 4-digit free)
 *    only when their account exists (claimSpin) — no number or code is shown before that;
 *  - one online reward per student, and never together with a physical GRANTED voucher (either way round);
 *  - free service is capped at ONLINE_FREE_MAX across every online campaign, ever — separate from the physical vouchers.
 * Student verification is still only required to BOOK (requireVerifiedStudent), never to spin or add the card.
 */
export const ONLINE_FREE_MAX = 100;
export const SPIN_COOKIE = "nearest_spin";

export const hashIp = (ip: string) => createHash("sha256").update(`${ip}|${process.env.CRON_SECRET ?? "nearest"}`).digest("hex").slice(0, 32);
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const rewardLabel = (kind: string, amountCents: number) => (kind === "free" ? "Free service" : `$${Math.round(amountCents / 100)} off`);

export async function requestIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

/** The online campaign running right now (live and inside its dates), or null. */
export async function liveOnlineCampaign() {
  const rows = await db.select().from(onlineCampaigns).where(eq(onlineCampaigns.status, "live")).orderBy(asc(onlineCampaigns.createdAt));
  const now = Date.now();
  return rows.find((c) => (!c.startsAt || c.startsAt.getTime() <= now) && (!c.endsAt || c.endsAt.getTime() > now)) ?? null;
}

/** The wheel's segments: digital batches with odds > 0 (remaining = inventory left). */
export async function wheelSegments(campaignId: string) {
  const rows = await db.select().from(nearestCardBatches)
    .where(and(eq(nearestCardBatches.onlineCampaignId, campaignId), eq(nearestCardBatches.channel, "digital"), sql`${nearestCardBatches.weight} > 0`, eq(nearestCardBatches.status, "active")))
    .orderBy(sql`(${nearestCardBatches.kind} = 'free')`, asc(nearestCardBatches.amountCents));
  return rows.map((b) => ({ id: b.id, kind: b.kind, amountCents: b.amountCents, weight: b.weight, remaining: Math.max(0, b.count - b.claimed), label: rewardLabel(b.kind, b.amountCents) }));
}

/** Does this student already hold any GRANTED card — a physical voucher activation or an online reward? */
export async function grantedCardsOf(userId: string) {
  return (await db.execute(sql`select c.id, b.channel, b.kind from nearest_cards c join nearest_card_batches b on b.id = c.batch_id
    where c.shared and c.student_id = ${userId} and c.status = 'activated' and (b.shared_number is not null or b.channel = 'digital')`)).rows as { id: string; channel: string; kind: string }[];
}

export type SpinView = { id: string; kind: string; amountCents: number; label: string; status: string; holdUntil: Date; email: string | null; batchId: string };
const view = (s: typeof rewardSpins.$inferSelect): SpinView => ({ id: s.id, kind: s.kind, amountCents: s.amountCents, label: rewardLabel(s.kind, s.amountCents), status: s.status, holdUntil: s.holdUntil, email: s.email, batchId: s.batchId });

/** The spin of this browser's vote, if any (expired holds are released first). */
export async function mySpin(): Promise<SpinView | null> {
  await expireSpins();
  const sid = await voteSession(false);
  if (sid) {
    const s = (await db.select().from(rewardSpins).where(eq(rewardSpins.sessionId, sid)).limit(1))[0];
    if (s) return view(s);
  }
  const tok = (await cookies()).get(SPIN_COOKIE)?.value;
  if (tok && /^[a-f0-9]{48}$/.test(tok)) {
    const s = (await db.select().from(rewardSpins).where(eq(rewardSpins.claimTokenHash, hashToken(tok))).limit(1))[0];
    if (s) return view(s);
  }
  return null;
}

type SpinResult = { ok: true; spin: SpinView } | { ok: false; error: string };

/**
 * Spin once. Checks the vote (online, in an eligible state), the campaign, the network rate limit and the signed-in
 * student's existing GRANTED cards, then picks a segment by its odds among those with inventory and reserves it with
 * `update … set claimed = claimed + 1 where claimed < count` + the spin insert in ONE statement (unique vote_id).
 */
export async function spin(viewer: { userId: string | null }): Promise<SpinResult> {
  await expireSpins();
  const sid = await voteSession(false);
  const vote = sid ? (await db.select().from(studentVotes).where(eq(studentVotes.sessionId, sid)).limit(1))[0] : undefined;
  if (!vote) return { ok: false, error: "Please vote first — then spin." };
  if (vote.channel !== "online") return { ok: false, error: "The reward wheel is for online votes." };
  const existing = (await db.select().from(rewardSpins).where(eq(rewardSpins.voteId, vote.id)).limit(1))[0];
  if (existing) return { ok: true, spin: view(existing) };
  const camp = await liveOnlineCampaign();
  if (!camp) return { ok: false, error: "The reward wheel isn't running right now. Your vote still counts." };
  if (camp.states.length && !camp.states.includes(vote.state)) return { ok: false, error: "The reward wheel is only open where this campaign runs. Your vote still counts." };
  if (viewer.userId) {
    if ((await grantedCardsOf(viewer.userId)).length) return { ok: false, error: "You already have a GRANTED card on your account — it's one per student. Your vote still counts." };
    const had = (await db.execute(sql`select 1 from reward_spins where user_id = ${viewer.userId} and status in ('held', 'assigned') limit 1`)).rows.length;
    if (had) return { ok: false, error: "You've already spun the wheel. Your vote still counts." };
  }
  const ipHash = hashIp(await requestIp());
  const recent = (await db.execute(sql`select count(*)::int as n from reward_spins where ip_hash = ${ipHash} and created_at > now() - interval '1 hour'`)).rows[0] as { n: number };
  if (recent.n >= camp.spinsPerHourPerNetwork) return { ok: false, error: "Too many spins from this network. Please try again later — your vote still counts." };

  let segs = (await wheelSegments(camp.id)).filter((x) => x.remaining > 0);
  while (segs.length) {
    const total = segs.reduce((n, x) => n + x.weight, 0);
    let roll = randomInt(total), pick = segs[0];
    for (const x of segs) { if (roll < x.weight) { pick = x; break; } roll -= x.weight; }
    const r = (await db.execute(sql`with slot as (
        update nearest_card_batches set claimed = claimed + 1 where id = ${pick.id} and claimed < count returning id, kind, amount_cents),
      ins as (insert into reward_spins (campaign_id, vote_id, session_id, batch_id, kind, amount_cents, hold_until, ip_hash, user_id)
        select ${camp.id}, ${vote.id}, ${vote.sessionId}, id, kind, amount_cents, now() + make_interval(mins => ${camp.quickHoldMinutes}), ${ipHash}, null from slot
        on conflict (vote_id) do nothing returning id)
      select (select count(*) from slot)::int as took, (select id from ins) as spin_id`)).rows[0] as { took: number; spin_id: string | null };
    if (r.spin_id) {
      const s = (await db.select().from(rewardSpins).where(eq(rewardSpins.id, r.spin_id)))[0];
      return { ok: true, spin: view(s) };
    }
    if (r.took) {
      // Spun twice at the same moment: give the place back and show the spin that won.
      await db.execute(sql`update nearest_card_batches set claimed = greatest(claimed - 1, 0) where id = ${pick.id}`);
      const s = (await db.select().from(rewardSpins).where(eq(rewardSpins.voteId, vote.id)))[0];
      if (s) return { ok: true, spin: view(s) };
    }
    segs = segs.filter((x) => x.id !== pick.id); // that segment just ran out — try the others
  }
  return { ok: false, error: "All rewards have been given out. Thank you — your vote still counts." };
}

/** Hold the reward for the campaign's hold time (3 days) with an email; emails a link back to it. */
export async function holdWithEmail(rawEmail: string): Promise<{ ok: true; holdUntil: Date } | { ok: false; error: string }> {
  const email = String(rawEmail ?? "").trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "Enter your email address." };
  const s = await mySpin();
  if (!s || s.status !== "held") return { ok: false, error: "This reward isn't being held anymore." };
  const camp = (await db.select().from(rewardSpins).innerJoin(onlineCampaigns, eq(onlineCampaigns.id, rewardSpins.campaignId)).where(eq(rewardSpins.id, s.id)))[0];
  const token = randomBytes(24).toString("hex");
  const r = await db.execute(sql`update reward_spins set email = ${email}, claim_token_hash = ${hashToken(token)},
      hold_until = greatest(hold_until, created_at + make_interval(hours => ${camp.online_campaigns.holdHours}))
    where id = ${s.id} and status = 'held' and hold_until > now() returning hold_until`);
  const row = r.rows[0] as { hold_until: string } | undefined;
  if (!row) return { ok: false, error: "This reward isn't being held anymore." };
  const holdUntil = new Date(row.hold_until);
  (await cookies()).set(SPIN_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: camp.online_campaigns.holdHours * 3600 });
  try {
    const { sendEmail } = await import("./email");
    const { SITE_URL } = await import("./public/site");
    const until = holdUntil.toLocaleString("en-US", { timeZone: "America/Chicago", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
    await sendEmail({ to: email, subject: "Your Nearest GRANTED reward is on hold", eyebrow: "Nearest GRANTED", heading: `${s.label} — held for you`,
      lines: [`Create your free Nearest account by ${until} (Central) to add it to your account.`], button: { label: "Create my account", url: `${SITE_URL}/vote/claim/${token}` } });
  } catch (e) { console.error("hold email", e); }
  return { ok: true, holdUntil };
}

/** Random unused 16-digit number for a digital card (8877 + 12 digits). */
async function newCardNumber() {
  for (let i = 0; i < 20; i++) {
    const n = `8877${Array.from({ length: 12 }, () => randomInt(10)).join("")}`;
    if (!(await db.execute(sql`select 1 from nearest_cards where number = ${n} limit 1`)).rows.length) return n;
  }
  throw new Error("no card number");
}

/**
 * After sign-up / sign-in: turn this person's held spin (this browser's vote, the emailed claim link, or a held spin
 * under their account email) into their own activated digital GRANTED card. Refused — and the reward released — when
 * they already have a GRANTED card (physical or online). Returns what happened for the Cards page.
 */
export async function claimSpin(userId: string): Promise<{ ok: boolean; message: string } | null> {
  await expireSpins();
  let s = await mySpin();
  if (!s) {
    const u = (await db.select({ email: users.email }).from(users).where(eq(users.id, userId)))[0];
    const byEmail = u?.email ? (await db.select().from(rewardSpins).where(and(eq(rewardSpins.email, u.email.toLowerCase()), eq(rewardSpins.status, "held"))).limit(1))[0] : undefined;
    s = byEmail ? view(byEmail) : null;
  }
  if (!s || s.status !== "held") return null;
  const release = async (note: string) => {
    const r = await db.execute(sql`update reward_spins set status = 'declined', note = ${note}, user_id = ${userId} where id = ${s!.id} and status = 'held' returning batch_id`);
    if (r.rows.length) await db.execute(sql`update nearest_card_batches set claimed = greatest(claimed - 1, 0) where id = ${s!.batchId}`);
  };
  if ((await grantedCardsOf(userId)).length) {
    await release("already has a GRANTED card");
    return { ok: false, message: "You already have a GRANTED card on your account, so this online reward couldn't be added — it's one GRANTED card per student." };
  }
  // Take the hold for this account first (one assigned online reward per student — unique index), then make the card.
  let took;
  try {
    took = await db.execute(sql`update reward_spins set status = 'assigned', user_id = ${userId}, assigned_at = now()
      where id = ${s.id} and status = 'held' and hold_until > now() returning id`);
  } catch {
    await release("already has an online reward");
    return { ok: false, message: "You already have an online GRANTED reward on your account — it's one per student." };
  }
  if (!took.rows.length) return null;
  const batch = (await db.select().from(nearestCardBatches).where(eq(nearestCardBatches.id, s.batchId)))[0];
  const code = String(batch.kind === "free" ? randomInt(1000, 10000) : randomInt(100, 1000));
  const [card] = await db.insert(nearestCards).values({ batchId: batch.id, number: await newCardNumber(), code, status: "activated", studentId: userId, activatedAt: new Date(), shared: true }).returning();
  await db.update(rewardSpins).set({ cardId: card.id }).where(eq(rewardSpins.id, s.id));
  // (The spin cookie can stay — this spin is assigned now; pages can't change cookies.)
  try { const { sendAdEvent } = await import("./ad-tags"); await sendAdEvent("ActivateCard", `card-${card.id}`); } catch { /* never blocks */ }
  return { ok: true, message: `Your GRANTED card (${s.label === "Free service" ? "one eligible free service" : s.label}) is now on your account. Choose it at checkout once you're verified to book.` };
}

/** Holds that ran out go back to the inventory (cron sweep, and before every spin / claim). */
export async function expireSpins() {
  await db.execute(sql`with x as (update reward_spins set status = 'expired' where status = 'held' and hold_until < now() returning batch_id)
    update nearest_card_batches b set claimed = greatest(b.claimed - c.n, 0) from (select batch_id, count(*)::int as n from x group by batch_id) c where b.id = c.batch_id`);
}
