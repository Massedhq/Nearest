import "server-only";
import { Resend } from "resend";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, broadcasts, broadcastRecipients, outreachSuppression } from "@/db";
import { normEmail } from "./outreach";
import { getTemplates, render, unsubToken, REPLY_TO } from "./outreach-mail";

export type Audience = {
  kind: "prospects" | "pros" | "students";
  status?: string; // prospects: active | contacted | no_response | registered • pros: all | live | incomplete | waiting • students: verified | all
  city?: string; category?: string; recruiter?: string; // recruiter = admin user id (prospects only)
};
export type Recipient = { email: string; firstName: string | null; userId?: string | null; prospectId?: string | null };

export function audienceLabel(a: Audience) {
  const what = a.kind === "prospects"
    ? { active: "Active prospects", contacted: "Prospects emailed, not joined", no_response: "Prospects with no response", registered: "Prospects who joined" }[a.status ?? "active"] ?? "Prospects"
    : a.kind === "pros"
      ? { all: "All professionals", live: "Live professionals", incomplete: "Professionals with unfinished profiles", waiting: "Professionals waiting for their city to open" }[a.status ?? "all"] ?? "Professionals"
      : a.status === "all" ? "All students" : "Verified students";
  return [what, a.category ? a.category : null, a.city ? `in ${a.city}` : null].filter(Boolean).join(" • ");
}

/** Who a broadcast would go to right now — deduplicated, with unsubscribed / do-not-contact emails removed. */
export async function audienceRecipients(a: Audience): Promise<Recipient[]> {
  const city = a.city?.trim() || null, cat = a.category?.trim() || null;
  let rows: Recipient[] = [];
  if (a.kind === "prospects") {
    const st = a.status ?? "active";
    const statusSql = st === "contacted" ? sql`p.emails_sent > 0 and p.status not in ('registered','profile_complete','opted_out','declined')`
      : st === "no_response" ? sql`p.status = 'no_response'`
      : st === "registered" ? sql`p.status in ('registered','profile_complete')`
      : sql`p.status not in ('registered','profile_complete','opted_out','declined','ineligible')`;
    const r = await db.execute<{ email: string; name: string; id: string }>(sql`select p.email, p.name, p.id from prospects p
      where p.email_norm is not null and ${statusSql}
      ${city ? sql`and lower(p.city) = lower(${city})` : sql``} ${cat ? sql`and lower(p.category) = lower(${cat})` : sql``}
      ${a.recruiter ? sql`and p.recruiter_id = ${a.recruiter}::uuid` : sql``}`);
    rows = r.rows.map((x) => ({ email: x.email, firstName: x.name?.split(" ")[0] ?? null, prospectId: x.id }));
  } else if (a.kind === "pros") {
    const st = a.status ?? "all";
    const statusSql = st === "live" ? sql`pp.review_status = 'approved' and pp.searchable`
      : st === "incomplete" ? sql`pp.review_status in ('draft','rejected')`
      : st === "waiting" ? sql`pp.card_saved_at is not null and pp.subscription_id is null`
      : sql`true`;
    const r = await db.execute<{ email: string; first: string | null; id: string }>(sql`select u.email, u.first_name as first, u.id from professional_profiles pp join users u on u.id = pp.user_id
      where u.email is not null and pp.entry_paid_at is not null and ${statusSql}
      ${city ? sql`and exists (select 1 from cities c where c.id = coalesce(pp.city_id, pp.slot_city_id) and lower(c.name) = lower(${city}))` : sql``}
      ${cat ? sql`and exists (select 1 from pro_services s join categories k on k.id = s.category_id where s.user_id = pp.user_id and s.active and lower(k.name) = lower(${cat}))` : sql``}`);
    rows = r.rows.map((x) => ({ email: x.email, firstName: x.first, userId: x.id }));
  } else {
    const r = await db.execute<{ email: string; first: string | null; id: string }>(sql`select u.email, u.first_name as first, u.id from student_profiles sp join users u on u.id = sp.user_id
      where u.email is not null ${a.status === "all" ? sql`` : sql`and sp.verification_status = 'verified'`}
      ${city ? sql`and exists (select 1 from schools sc join cities c on c.id = sc.city_id where sc.id = sp.school_id and lower(c.name) = lower(${city}))` : sql``}`);
    rows = r.rows.map((x) => ({ email: x.email, firstName: x.first, userId: x.id }));
  }
  const suppressed = new Set((await db.select({ e: outreachSuppression.emailNorm }).from(outreachSuppression)).map((x) => x.e).filter(Boolean) as string[]);
  const seen = new Set<string>();
  return rows.filter((r) => { const e = normEmail(r.email); if (!e || suppressed.has(e) || seen.has(e)) return false; seen.add(e); return true; });
}

const SENDER = (process.env.EMAIL_FROM || "Nearest <hello@usenearest.com>").match(/<([^>]+)>/)?.[1] ?? "hello@usenearest.com";
const base = () => process.env.APP_URL || "https://www.usenearest.com";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Runs every 15 minutes: sends the next recipients of any broadcast that's sending. */
export async function sendBroadcasts(limit = 150) {
  if (!process.env.RESEND_API_KEY) return 0;
  const live = await db.select().from(broadcasts).where(eq(broadcasts.status, "sending"));
  if (!live.length) return 0;
  const { address } = await getTemplates();
  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  for (const b of live) {
    const todo = await db.select().from(broadcastRecipients).where(and(eq(broadcastRecipients.broadcastId, b.id), isNull(broadcastRecipients.sentAt))).limit(Math.max(0, limit - sent));
    for (const r of todo) {
      const body = render(b.body, { first_name: r.firstName || "there" });
      const unsub = `${base()}/unsubscribe/${unsubToken(r.prospectId ?? `u-${r.userId}`)}`;
      const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;max-width:560px">${body.split(/\n\s*\n/).map((x) => `<p style="margin:0 0 14px">${esc(x).replace(/\n/g, "<br>").replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>')}</p>`).join("")}
<p style="font-size:11px;color:#888;margin-top:24px;border-top:1px solid #eee;padding-top:10px">${esc(address || "Nearest")} • <a href="${unsub}" style="color:#888">Unsubscribe</a></p></div>`;
      try {
        await resend.emails.send({ from: `Nearest <${SENDER}>`, to: r.email, replyTo: REPLY_TO, subject: render(b.subject, { first_name: r.firstName || "there" }), html, text: `${body}\n\n--\n${address}\nUnsubscribe: ${unsub}`, headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } });
      } catch (e) { console.error("broadcast send", e); }
      await db.update(broadcastRecipients).set({ sentAt: new Date() }).where(eq(broadcastRecipients.id, r.id));
      sent++;
    }
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(broadcastRecipients).where(and(eq(broadcastRecipients.broadcastId, b.id), sql`${broadcastRecipients.sentAt} is not null`));
    const done = todo.length === 0 || n >= b.recipients;
    await db.update(broadcasts).set({ sent: n, ...(done ? { status: "sent", sentAt: new Date() } : {}) }).where(eq(broadcasts.id, b.id));
    if (sent >= limit) break;
  }
  return sent;
}
