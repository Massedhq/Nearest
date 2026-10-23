import "server-only";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db, enrollmentHolds, enrollmentHoldAttempts, invitations, users } from "@/db";

/**
 * Enrollment holds — professionals who never finished registering.
 *
 * After `growth.unfinished_registration_days` (30) days, these are put on hold (nothing is deleted):
 *   - "account": a professional account that has NOT accepted the Professional Terms, has NOT sent an ID check and
 *     has never submitted its profile (an unclaimed profile Nearest built counts too). Anyone who accepted the Terms
 *     or sent their ID is never held.
 *   - "invitation": an invitation code that was never used.
 *   - "outreach": an outreach registration link that was sent and never used.
 * A held professional who signs in, opens setup, registers again with the same email or uses the invitation sees the
 * enrollment-closed message, and the attempt is recorded for the owners. Owners release a hold from
 * Admin → People → Enrollment holds; the professional is told they can finish registering, and gets another
 * 30 days before the check runs again.
 */

export const CLOSED_TITLE = "Enrollment is closed for now";
export const CLOSED_MESSAGE =
  "Sorry — enrollment in your area has reached capacity, so registration is closed right now. You've been placed on the waiting list. Please check back when enrollment opens again — we'll let you know.";

export type Hold = typeof enrollmentHolds.$inferSelect;
export const KIND_LABEL: Record<string, string> = { account: "Account never finished", invitation: "Invitation never used", outreach: "Registration link never used" };
export const ACTION_LABEL: Record<string, string> = { signed_in: "Signed in / opened the app", registration: "Tried to register again", invitation: "Opened the invitation", claim_link: "Opened their claim link" };

const norm = (e: string | null | undefined) => (e ?? "").trim().toLowerCase() || null;

export async function holdDays() {
  const { getSettings } = await import("./settings");
  return Math.max(1, Math.round(Number((await getSettings())["growth.unfinished_registration_days"] ?? 30)));
}

/** The active hold for this person, by account, email, invitation or outreach record. */
export async function activeHold(who: { userId?: string | null; email?: string | null; invitationId?: string | null; prospectId?: string | null }) {
  const conds = [];
  if (who.userId) conds.push(eq(enrollmentHolds.userId, who.userId));
  const email = norm(who.email);
  if (email) conds.push(eq(enrollmentHolds.email, email));
  if (who.invitationId) conds.push(and(eq(enrollmentHolds.kind, "invitation"), eq(enrollmentHolds.subjectId, who.invitationId))!);
  if (who.prospectId) conds.push(and(eq(enrollmentHolds.kind, "outreach"), eq(enrollmentHolds.subjectId, who.prospectId))!);
  if (!conds.length) return null;
  const [h] = await db.select().from(enrollmentHolds).where(and(eq(enrollmentHolds.status, "held"), or(...conds))).orderBy(desc(enrollmentHolds.heldAt)).limit(1);
  return h ?? null;
}

/**
 * Record that a held professional tried to come back. Repeats of the same action within 10 minutes count once.
 * Owners get one bell notification per hold per day.
 */
export async function recordAttempt(hold: Hold, action: keyof typeof ACTION_LABEL | string, detail?: string | null) {
  try {
    const recent = await db.select({ id: enrollmentHoldAttempts.id }).from(enrollmentHoldAttempts)
      .where(and(eq(enrollmentHoldAttempts.holdId, hold.id), eq(enrollmentHoldAttempts.action, action), sql`${enrollmentHoldAttempts.at} > now() - interval '10 minutes'`)).limit(1);
    if (recent.length) return;
    await db.insert(enrollmentHoldAttempts).values({ holdId: hold.id, action, detail: detail?.slice(0, 300) ?? null });
    const notifyToday = !hold.lastAttemptAt || Date.now() - hold.lastAttemptAt.getTime() > 24 * 3600 * 1000;
    await db.update(enrollmentHolds).set({ attempts: sql`${enrollmentHolds.attempts} + 1`, lastAttemptAt: new Date() }).where(eq(enrollmentHolds.id, hold.id));
    if (notifyToday) {
      const { notifyAdmins } = await import("./outreach");
      await notifyAdmins({ kind: "enrollment_attempt", title: `${hold.name || hold.email || "A held professional"} is trying to register`, body: `${ACTION_LABEL[action] ?? action}. They're on enrollment hold — release them to let them finish.`, href: `/admin/enrollment-holds#h-${hold.id}` });
    }
  } catch (e) { console.error("hold attempt", e); }
}

type Candidate = { kind: string; subjectId: string; userId: string | null; email: string | null; name: string | null; reason: string };

/** Put on hold (or back on hold) — never twice, and not within the grace period after an owner released it. */
async function hold(c: Candidate, days: number) {
  const r = await db.execute<{ id: string }>(sql`
    insert into enrollment_holds (kind, subject_id, user_id, email, name, reason, status, held_at)
    values (${c.kind}, ${c.subjectId}, ${c.userId}::uuid, ${c.email}, ${c.name}, ${c.reason}, 'held', now())
    on conflict (kind, subject_id) do update set status = 'held', held_at = now(), reason = excluded.reason, email = coalesce(excluded.email, enrollment_holds.email)
      where enrollment_holds.status = 'released' and enrollment_holds.released_at < now() - (${days} * interval '1 day')
    returning id`);
  return r.rows.length > 0;
}

/** Daily (cron): find unfinished registrations older than the limit and put them on hold. */
export async function runEnrollmentHolds() {
  const days = await holdDays();
  const out = { accounts: 0, invitations: 0, outreach: 0 };

  // 1) Professional accounts that never accepted the Terms, never sent an ID and never submitted.
  const accounts = await db.execute<{ id: string; email: string | null; first: string | null; last: string | null; built: boolean; created: Date }>(sql`
    select u.id, lower(u.email) as email, u.first_name as first, u.last_name as last, (p.built_by is not null) as built, u.created_at as created
    from users u join professional_profiles p on p.user_id = u.id
    where u.account_type = 'professional'
      and p.entry_paid_at is null and p.pro_terms_accepted_at is null
      and p.identity_status = 'unverified' and p.review_status = 'draft'
      and u.created_at < now() - (${days} * interval '1 day')
      and not exists (select 1 from admin_members a where a.user_id = u.id and a.active)
      and not exists (select 1 from enrollment_holds h where h.kind = 'account' and h.subject_id = u.id::text and (h.status = 'held' or h.released_at >= now() - (${days} * interval '1 day')))
    limit 2000`);
  for (const a of accounts.rows) {
    const reason = a.built
      ? `Nearest built this profile, but it was never claimed and the Professional Terms were never accepted within ${days} days.`
      : `Account created ${new Date(a.created).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" })} — the Professional Terms weren't accepted, no ID was sent and the profile was never submitted within ${days} days.`;
    if (await hold({ kind: "account", subjectId: a.id, userId: a.id, email: a.email, name: [a.first, a.last].filter(Boolean).join(" ") || null, reason }, days)) out.accounts++;
  }

  // 2) Invitation codes never used.
  const invites = await db.execute<{ id: string; name: string; contact: string; created: Date }>(sql`
    select i.id, i.name, i.contact, i.created_at as created from invitations i
    where i.status in ('invited', 'expired') and i.registered_user_id is null and i.created_at < now() - (${days} * interval '1 day')
      and not exists (select 1 from enrollment_holds h where h.kind = 'invitation' and h.subject_id = i.id::text and (h.status = 'held' or h.released_at >= now() - (${days} * interval '1 day')))
    limit 2000`);
  for (const i of invites.rows) {
    const email = /@/.test(i.contact) ? norm(i.contact) : null;
    if (await hold({ kind: "invitation", subjectId: i.id, userId: null, email, name: i.name, reason: `Invited ${new Date(i.created).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" })} (${i.contact}) — the invitation was never used within ${days} days.` }, days)) out.invitations++;
  }

  // 3) Outreach registration links sent and never used.
  const links = await db.execute<{ id: string; name: string | null; biz: string | null; email: string | null; sent: Date }>(sql`
    select p.id, p.name, p.business as biz, p.email_norm as email, p.link_sent_at as sent from prospects p
    where p.status in ('link_sent', 'link_clicked') and p.registered_user_id is null and p.link_sent_at is not null and p.link_sent_at < now() - (${days} * interval '1 day')
      and p.email_norm is not null
      and not exists (select 1 from enrollment_holds h where h.kind = 'outreach' and h.subject_id = p.id::text and (h.status = 'held' or h.released_at >= now() - (${days} * interval '1 day')))
    limit 2000`).catch(() => ({ rows: [] as { id: string; name: string | null; biz: string | null; email: string | null; sent: Date }[] }));
  for (const l of links.rows) {
    if (await hold({ kind: "outreach", subjectId: l.id, userId: null, email: l.email, name: l.name || l.biz, reason: `Registration link sent ${new Date(l.sent).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" })} and never used within ${days} days.` }, days)) out.outreach++;
  }
  return out;
}

/** Owner releases a hold: the professional can finish registering (and is told), with another full period before the check runs again. */
export async function releaseHold(holdId: string, adminId: string, note: string | null) {
  const [h] = await db.update(enrollmentHolds).set({ status: "released", releasedAt: new Date(), releasedBy: adminId, releaseNote: note })
    .where(and(eq(enrollmentHolds.id, holdId), eq(enrollmentHolds.status, "held"))).returning();
  if (!h) return null;
  const days = await holdDays();
  if (h.kind === "invitation") {
    // Reopen the invitation for another period so the link works again.
    await db.update(invitations).set({ status: "invited", expiresAt: new Date(Date.now() + days * 24 * 3600 * 1000) })
      .where(and(eq(invitations.id, h.subjectId), inArray(invitations.status, ["invited", "expired"])));
  }
  const to = h.email ?? (h.userId ? (await db.query.users.findFirst({ where: eq(users.id, h.userId), columns: { email: true } }))?.email : null);
  const base = process.env.APP_URL || "https://www.usenearest.com";
  const href = h.kind === "invitation" ? `/pro/invite/${(await db.query.invitations.findFirst({ where: eq(invitations.id, h.subjectId), columns: { code: true } }))?.code ?? ""}` : h.userId ? "/pro/home" : "/pro/sign-up";
  try {
    const { sendEmail } = await import("./email");
    await sendEmail({
      to, subject: "You can finish registering on Nearest", eyebrow: "Nearest for professionals", heading: "Enrollment is open for you again.",
      lines: [`Good news${h.name ? `, ${h.name.split(" ")[0]}` : ""} — a spot has opened up and you can now finish registering on Nearest.`, `Complete your profile, accept the Professional Terms and send your ID within ${days} days to keep your place.`],
      button: { label: "Finish registering", url: `${base}${href}` },
    });
  } catch (e) { console.error("release email", e); }
  if (h.userId) {
    const { inbox } = await import("./inbox");
    await inbox(h.userId, { kind: "enrollment_open", title: "You can finish registering", body: `Enrollment is open for you again. Finish your profile, accept the Professional Terms and send your ID within ${days} days.`, href: "/pro/home" });
  }
  return h;
}

/** Owner puts a released professional back on hold by hand. */
export async function holdAgain(holdId: string) {
  const [h] = await db.update(enrollmentHolds).set({ status: "held", heldAt: new Date() }).where(and(eq(enrollmentHolds.id, holdId), eq(enrollmentHolds.status, "released"))).returning();
  return h ?? null;
}
