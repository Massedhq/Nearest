import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { CAMPAIGN_KEY, fmtWhen, getCampaign, recordEvent } from "./campaign";
import { notifyOnce } from "./campaign-notify";

/**
 * Every 15 minutes: mark entries "Ready for final review" once 168 hours have passed (never approve), send daily and
 * final evidence reminders, add any missing reward credit for approved students, give back rewards whose booking fell through,
 * and fill released places from the waitlist. Every notice is keyed, so re-running never sends a duplicate.
 */
export async function runCampaign() {
  await getCampaign(); // creates the campaign row (and upgrades its wording) if needed
  const out = { ready: 0, daily: 0, finals: 0, bookingOpen: 0, restored: 0, placed: 0 };

  // 1) 168 hours passed → Ready for final review.
  const ready = await db.execute<{ id: string; student_id: string; completes_at: Date }>(sql`
    update campaign_entries set status = 'ready_for_review', version = version + 1
    where campaign_key = ${CAMPAIGN_KEY} and status = 'in_progress' and completes_at <= now()
    returning id, student_id, completes_at`);
  for (const r of ready.rows) { await recordEvent(r.id, null, "ready", "168 hours elapsed — ready for final review (not approved)."); out.ready++; }

  // 2) Daily reminders: a window (Day 2–7) is open and nothing has been sent for it yet.
  const due = await db.execute<{ id: string; student_id: string; w: number; closes: Date }>(sql`
    select e.id, e.student_id, (floor(extract(epoch from (now() - e.started_at)) / 86400)::int + 1) as w,
      e.started_at + ((floor(extract(epoch from (now() - e.started_at)) / 86400)::int + 1) * interval '24 hours') as closes
    from campaign_entries e
    where e.campaign_key = ${CAMPAIGN_KEY} and e.status in ('in_progress','needs_correction') and e.started_at is not null and e.completes_at > now()
      and not exists (select 1 from campaign_evidence x where x.entry_id = e.id
        and x.window_index = floor(extract(epoch from (now() - e.started_at)) / 86400)::int + 1)
    limit 500`);
  for (const r of due.rows) {
    if (r.w < 2 || r.w > 7) continue;
    if (await notifyOnce(`daily:${r.id}:${r.w}`, r.student_id, {
      title: `Day ${r.w} screenshot`, body: `Upload today's screenshot of your profile before ${fmtWhen(new Date(r.closes))}.`, href: "/campaign",
      email: { subject: `Day ${r.w}: upload your Nearest campaign screenshot`, heading: `Day ${r.w} of 7 is open.`, lines: [`Upload a screenshot of your profile showing the Nearest picture before ${fmtWhen(new Date(r.closes))}.`], button: "Upload screenshot" },
    })) out.daily++;
  }

  // 3) Final evidence reminder once 168 hours have passed and no final screenshot yet.
  const finals = await db.execute<{ id: string; student_id: string }>(sql`
    select e.id, e.student_id from campaign_entries e
    where e.campaign_key = ${CAMPAIGN_KEY} and e.status in ('ready_for_review','needs_correction','in_progress') and e.completes_at <= now() and e.final_proof_at is null
    limit 500`);
  for (const r of finals.rows) {
    if (await notifyOnce(`final:${r.id}`, r.student_id, {
      title: "Seven days complete — send your final screenshot", body: "Upload a final screenshot of your profile so Nearest can do your final review.", href: "/campaign",
      email: { subject: "Your seven days are complete — final screenshot needed", heading: "Your seven days are complete.", lines: ["Upload a final screenshot of your profile showing the Nearest picture. Nearest reviews everything by hand before adding your Nearest credit."], button: "Upload final screenshot" },
    })) out.finals++;
  }

  // 4) Approved participants without their Nearest credit yet (e.g. approved before the reward became credit) get it now — once.
  const approved = await db.execute<{ id: string; student_id: string }>(sql`select id, student_id from campaign_entries where campaign_key = ${CAMPAIGN_KEY} and status = 'approved' and reward_booking_id is null limit 1000`);
  const { issueRewardCredit, creditLabel } = await import("./campaign");
  for (const r of approved.rows) {
    const cents = await issueRewardCredit(r.id);
    if (cents && await notifyOnce(`credit-added:${r.id}`, r.student_id, {
      title: `${creditLabel(cents)} Nearest credit added`, body: "Your launch campaign reward is now Nearest credit — use it toward any service you book with a professional.", href: "/credits",
      email: { subject: `${creditLabel(cents)} Nearest credit added to your account`, heading: "Your launch reward is in your account.", lines: [`${creditLabel(cents)} in Nearest credit was added. It's taken off your total automatically when you pay for any service with any professional on Nearest.`], button: "See my credit" },
    })) out.bookingOpen++;
  }

  // 5) Rewards whose booking didn't go ahead; 6) released places → waitlist.
  out.restored = await (await import("./campaign-reward")).reconcileRewards();
  out.placed = await (await import("./campaign")).fillFromWaitlist();
  return out;
}
