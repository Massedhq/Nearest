import "server-only";
import { createHmac, randomBytes } from "crypto";
import { Resend } from "resend";
import { and, eq, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db, prospects, outreachTemplates, outreachBatches, outreachLinks, outreachSuppression, users, adminNotifications } from "@/db";
import { getSettings, getFlag } from "./settings";
import { logProspect, notifyAdmins, normEmail } from "./outreach";

// Where prospect replies go. Set OUTREACH_REPLY_TO in Vercel (e.g. info@reply.usenearest.com — a sub-address
// whose MX points to Resend, so replies reach Nearest without touching your Zoho mail).
export const REPLY_TO = process.env.OUTREACH_REPLY_TO || "info@usenearest.com";
const base = () => process.env.APP_URL || "https://www.usenearest.com";
const SENDER = (process.env.EMAIL_FROM || "Nearest <hello@usenearest.com>").match(/<([^>]+)>/)?.[1] ?? "hello@usenearest.com";

export type TemplateKey = "first" | "follow1" | "follow2";
export const TEMPLATE_LABELS: Record<TemplateKey, string> = { first: "First email", follow1: "Follow-up 1", follow2: "Follow-up 2 (last)" };

/** Starting copy — the owners edit these on Outreach → Templates. No guarantees, no claims beyond what's approved. */
export const DEFAULT_TEMPLATES: Record<TemplateKey, { subject: string; body: string }> = {
  first: {
    subject: "{first_name}, a spot for {category} in {city}",
    body: `Hi {first_name},

I came across your work and wanted to reach out personally. I'm {recruiter} with Nearest — a booking platform for beauty, wellness and self-care professionals.

Nearest is controlled by city, so you're never one of fifty: each city has a limited number of spots per service. Joining is free — build your full profile at no cost. Your membership only activates when you accept your first booking.

If you want to grow your bookings and get in early, here's your personal invite (it expires in 24 hours):
{link}

Questions? Just reply to this email.

{recruiter}
Nearest`,
  },
  follow1: {
    subject: "Re: a spot for {category} in {city}",
    body: `Hi {first_name},

Just following up — spots in {city} are limited by category, and once they fill, enrollment there closes until one opens up.

Here's a fresh invite link (good for 24 hours):
{link}

Happy to answer anything — just reply.

{recruiter}`,
  },
  follow2: {
    subject: "Last note from Nearest",
    body: `Hi {first_name},

I don't want to fill your inbox, so this is my last note. If you'd like to claim your spot in {city}, your invite is here for the next 24 hours:
{link}

If now isn't the right time, no worries at all.

{recruiter}`,
  },
};

export async function getTemplates() {
  const rows = await db.select().from(outreachTemplates);
  const t = { ...DEFAULT_TEMPLATES } as Record<TemplateKey, { subject: string; body: string; updatedAt?: Date }>;
  for (const r of rows) if (r.key in t) t[r.key as TemplateKey] = { subject: r.subject, body: r.body, updatedAt: r.updatedAt };
  const address = rows.find((r) => r.key === "address")?.body ?? "";
  return { templates: t, address };
}

export function render(text: string, v: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? v[k] : m));
}

/** A personal invite link for this prospect: credits their recruiter, expires 24 hours after it's sent. */
export async function makeInviteLink(prospectId: string) {
  const token = randomBytes(15).toString("base64url");
  await db.insert(outreachLinks).values({ token, prospectId, expiresAt: new Date(Date.now() + 24 * 3600000) });
  return `${base()}/go/${token}`;
}

const secret = () => process.env.OUTREACH_SECRET || process.env.CLERK_SECRET_KEY || "nearest-outreach";
export const unsubToken = (prospectId: string) => `${prospectId}.${createHmac("sha256", secret()).update(prospectId).digest("base64url").slice(0, 22)}`;
export function checkUnsubToken(token: string) {
  const [id, sig] = token.split(".");
  return id && sig && unsubToken(id) === token ? id : null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Everything that must be true before Nearest emails a prospect. Returns a reason when it can't. */
export async function cantEmail(p: typeof prospects.$inferSelect): Promise<string | null> {
  const em = normEmail(p.email);
  if (!em) return "no email";
  if (p.paused) return "paused";
  if (["registered", "profile_complete", "opted_out", "declined", "ineligible", "market_full"].includes(p.status)) return p.status;
  if ((await db.select({ id: outreachSuppression.id }).from(outreachSuppression).where(eq(outreachSuppression.emailNorm, em)).limit(1)).length) return "do not contact";
  if (await db.query.users.findFirst({ where: sql`lower(${users.email}) = ${em}` })) return "already has an account";
  if (p.cityId && p.categoryId) {
    const { slotCount, slotLimits } = await import("./slots");
    if ((await slotCount(p.cityId, p.categoryId)) >= (await slotLimits()).cap) return "market_full";
  }
  return null;
}

/** Send one outreach email (first or follow-up) to a prospect. */
export async function sendOutreach(p: typeof prospects.$inferSelect, key: TemplateKey, testTo?: string): Promise<{ sent: boolean; reason?: string }> {
  if (!process.env.RESEND_API_KEY) return { sent: false, reason: "Email isn't set up (no RESEND_API_KEY)." };
  const { templates, address } = await getTemplates();
  if (!address.trim()) return { sent: false, reason: "Add your mailing address on Outreach → Templates first (required by law)." };
  const recruiter = p.recruiterId ? await db.query.users.findFirst({ where: eq(users.id, p.recruiterId) }) : null;
  const recruiterName = [recruiter?.firstName, recruiter?.lastName].filter(Boolean).join(" ") || "The Nearest team";
  const link = testTo ? `${base()}/go/sample-invite-link` : await makeInviteLink(p.id);
  let spotsLeft = "";
  if (p.cityId && p.categoryId) {
    const { slotCount, slotLimits } = await import("./slots");
    spotsLeft = String(Math.max(0, (await slotLimits()).cap - (await slotCount(p.cityId, p.categoryId))));
  }
  const v = { first_name: p.name.split(" ")[0] || "there", name: p.name, city: p.city ?? "your city", category: (p.category ?? "your service").toLowerCase(), recruiter: recruiterName, link, spots_left: spotsLeft || "a few" };
  const t = templates[key];
  const subject = render(t.subject, v);
  const body = render(t.body, v);
  const unsub = `${base()}/unsubscribe/${unsubToken(p.id)}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;max-width:560px">
${body.split(/\n\s*\n/).map((para) => `<p style="margin:0 0 14px">${esc(para).replace(/\n/g, "<br>").replace(esc(link), `<a href="${link}" style="color:#0a58ca">${esc(link)}</a>`)}</p>`).join("\n")}
<p style="font-size:11px;color:#888;margin-top:28px;border-top:1px solid #eee;padding-top:10px">${esc(address)}<br>You're receiving this because we think you'd be a great fit for Nearest. <a href="${unsub}" style="color:#888">Unsubscribe</a></p></div>`;
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: `${recruiterName} at Nearest <${SENDER}>`, to: testTo ?? p.email!, replyTo: REPLY_TO, subject: testTo ? `[Test] ${subject}` : subject, html,
      text: `${body}\n\n--\n${address}\nUnsubscribe: ${unsub}`,
      headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    });
    if (error) return { sent: false, reason: error.message };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
  if (!testTo) {
    await logProspect(p.id, "email_sent", `${TEMPLATE_LABELS[key]}: "${subject}" (invite link good for 24 hours)`, null);
    const { prospectMessages } = await import("@/db");
    await db.insert(prospectMessages).values({ prospectId: p.id, direction: "out", author: "ai", subject, body });
  }
  return { sent: true };
}

/** Runs every 15 minutes: starts scheduled batches, sends due emails and follow-ups, closes finished batches, warns on low queues. */
export async function runOutreach() {
  const out = { started: 0, sent: 0, skipped: 0, lowAlerts: 0 };
  if (await getFlag("outreach.paused")) return out;
  const s = await getSettings();
  const perRun = Math.max(1, Number(s["outreach.per_run"] ?? 40));
  const f1 = Number(s["outreach.follow1_days"] ?? 3), f2 = Number(s["outreach.follow2_days"] ?? 4);
  const now = new Date();
  // 1) Scheduled batches whose start time arrived.
  const due = await db.update(outreachBatches).set({ status: "running" }).where(and(eq(outreachBatches.status, "scheduled"), lte(outreachBatches.startAt, now))).returning();
  for (const b of due) {
    await db.update(prospects).set({ status: "scheduled", nextEmailAt: now, updatedAt: now }).where(and(eq(prospects.batchId, b.id), eq(prospects.status, "approved")));
    out.started++;
  }
  // 2) Emails that are due, in running batches.
  const rows = await db.select({ p: prospects }).from(prospects).innerJoin(outreachBatches, eq(outreachBatches.id, prospects.batchId))
    .where(and(eq(outreachBatches.status, "running"), isNotNull(prospects.nextEmailAt), lte(prospects.nextEmailAt, now), eq(prospects.paused, false), sql`${prospects.emailsSent} < 3`))
    .orderBy(prospects.nextEmailAt).limit(perRun);
  for (const { p } of rows) {
    const why = await cantEmail(p);
    if (why) {
      await db.update(prospects).set({ nextEmailAt: null, ...(why === "market_full" ? { status: "market_full" } : {}), updatedAt: now }).where(eq(prospects.id, p.id));
      await logProspect(p.id, "skipped", `Not emailed: ${why.replace("_", " ")}.`, null);
      out.skipped++;
      continue;
    }
    const key: TemplateKey = p.emailsSent === 0 ? "first" : p.emailsSent === 1 ? "follow1" : "follow2";
    const r = await sendOutreach(p, key);
    if (!r.sent) { await logProspect(p.id, "email_failed", r.reason ?? "Send failed.", null); await db.update(prospects).set({ nextEmailAt: new Date(now.getTime() + 3600000) }).where(eq(prospects.id, p.id)); continue; }
    const n = p.emailsSent + 1;
    await db.update(prospects).set({
      emailsSent: n, lastContactAt: now, linkSentAt: now, updatedAt: now,
      status: ["scheduled", "approved", "contacted", "link_sent"].includes(p.status) ? "link_sent" : p.status,
      nextEmailAt: n === 1 ? new Date(now.getTime() + f1 * 86400000) : n === 2 ? new Date(now.getTime() + f2 * 86400000) : null,
    }).where(eq(prospects.id, p.id));
    out.sent++;
  }
  // 3) No reply 7 days after the last follow-up → "No response".
  await db.update(prospects).set({ status: "no_response", updatedAt: now })
    .where(and(eq(prospects.emailsSent, 3), inArray(prospects.status, ["link_sent", "contacted"]), lte(prospects.lastContactAt, new Date(now.getTime() - 7 * 86400000))));
  // 4) Batches with nothing left to send are done.
  await db.execute(sql`update outreach_batches b set status = 'done' where b.status = 'running'
    and not exists (select 1 from prospects p where p.batch_id = b.id and p.next_email_at is not null and not p.paused)`);
  // 5) Low / empty queue alerts (once a day per recruiter).
  const recruiters = await db.selectDistinct({ id: outreachBatches.recruiterId }).from(outreachBatches).where(isNotNull(outreachBatches.recruiterId));
  for (const { id } of recruiters) {
    if (!id) continue;
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(prospects).where(and(eq(prospects.recruiterId, id), eq(prospects.status, "approved"), isNull(prospects.batchId)));
    if (n > 15) continue;
    const recent = await db.select({ id: adminNotifications.id }).from(adminNotifications)
      .where(and(eq(adminNotifications.userId, id), inArray(adminNotifications.kind, ["queue_low", "queue_empty"]), sql`${adminNotifications.createdAt} > now() - interval '24 hours'`)).limit(1);
    if (recent.length) continue;
    await notifyAdmins(n === 0
      ? { kind: "queue_empty", title: "Outreach queue empty", body: "You have no uncontacted prospects left. Add more to keep recruiting.", href: "/admin/outreach/import" }
      : { kind: "queue_low", title: "Outreach queue low", body: `You have ${n} uncontacted prospect${n === 1 ? "" : "s"} left. Add more to keep recruiting.`, href: "/admin/outreach/import" }, [id]);
    out.lowAlerts++;
  }
  return out;
}
