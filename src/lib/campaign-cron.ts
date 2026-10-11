import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { CAMPAIGN_KEY, fmtWhen, getCampaign, recordEvent, bookingOpensLabel } from "./campaign";
import { notifyOnce } from "./campaign-notify";

/**
 * Every 15 minutes: mark entries "Ready for final review" once 168 hours have passed (never approve), send daily and
 * final evidence reminders, tell approved students when booking opens, give back rewards whose booking fell through,
 * and fill released places from the waitlist. Every notice is keyed, so re-running never sends a duplicate.
 */
export async function runCampaign() {
  const c = await getCampaign();
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
      email: { subject: "Your seven days are complete — final screenshot needed", heading: "Your seven days are complete.", lines: ["Upload a final screenshot of your profile showing the Nearest picture. Nearest reviews everything by hand before approving your reward."], button: "Upload final screenshot" },
    })) out.finals++;
  }

  // 4) Booking is open → tell approved participants (once).
  if (c.bookingOpensAt && c.bookingOpensAt.getTime() <= Date.now()) {
    const approved = await db.execute<{ id: string; student_id: string }>(sql`select id, student_id from campaign_entries where campaign_key = ${CAMPAIGN_KEY} and status = 'approved' limit 1000`);
    for (const r of approved.rows) {
      if (await notifyOnce(`booking-open:${r.id}`, r.student_id, {
        title: "Booking is open — book your free service", body: "Your approved launch reward can be booked now, subject to available appointments.", href: "/campaign/reward",
        email: { subject: "Booking is open on Nearest — book your free service", heading: "Booking is open.", lines: [`Booking opened ${bookingOpensLabel(c)}. Book your free service from your campaign page — appointments depend on availability.`], button: "Book my free service" },
      })) out.bookingOpen++;
    }
  }

  // 5) Rewards whose booking didn't go ahead; 6) released places → waitlist.
  out.restored = await (await import("./campaign-reward")).reconcileRewards();
  out.placed = await (await import("./campaign")).fillFromWaitlist();
  return out;
}
