import "server-only";
import { Resend } from "resend";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, prospects, prospectMessages, outreachAnswers, outreachTemplates, outreachSuppression, users, cities, categories } from "@/db";
import { guideFor } from "./guide";
import { getFlag } from "./settings";
import { logProspect, notifyAdmins, normEmail, normPhone } from "./outreach";
import { makeInviteLink, REPLY_TO, getTemplates, unsubToken } from "./outreach-mail";

const SENDER = (process.env.EMAIL_FROM || "Nearest <hello@usenearest.com>").match(/<([^>]+)>/)?.[1] ?? "hello@usenearest.com";
const base = () => process.env.APP_URL || "https://www.usenearest.com";
export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

/** Editable on Outreach → Answers. These are the starting versions. */
export const DEFAULT_PLAYBOOK = `You are writing on behalf of the recruiter named in the facts, by email, to a beauty, wellness or self-care professional they reached out to about Nearest.
Voice: warm, confident, short (2–5 sentences), like a real person texting a colleague — never salesy or pushy, no emojis overload, no bullet lists.
Goal: answer their questions honestly, show the value, and when they're interested send their personal invite link.
How to sell Nearest (only with true facts):
- Nearest is controlled by city: a limited number of spots per category in each city, so they're never one of fifty.
- It helps pros who are underbooked, underexposed, newer and building clientele, or who want to reach a new market.
- "I already have a booking site": Nearest doesn't replace it — it's another place new clients find and book them.
- "I'm new / few clients": Model Calls and a protected local spot help build clientele and a portfolio.
- "I don't want to pay if I don't get bookings": explain the real enrollment terms in the facts (for example no charge until their city opens). Never promise bookings, clients or income.
- "I'll think about it": you may state the real spots left in their city and category from the facts. Never invent urgency.
If they say yes, sounds good, send it, how do I sign up, or similar: action "send_link".`;
export const DEFAULT_NEVER = `Never promise or imply guaranteed bookings, clients, income or results.
Never invent prices, spots, dates, partnerships, school relationships or policies — use only the facts and approved answers.
Never name or describe specific school districts or schools.
Never ask for passwords, payment details, or ID numbers by email.
Never argue. If they're not interested, thank them and stop.`;
export const DEFAULT_HOLDING = `Great question — I want to make sure I give you the right answer, so I'm checking with our team and will get back to you shortly.`;

export async function getAiCopy() {
  const rows = await db.select().from(outreachTemplates);
  const get = (k: string, d: string) => rows.find((r) => r.key === k)?.body ?? d;
  return { playbook: get("playbook", DEFAULT_PLAYBOOK), never: get("never", DEFAULT_NEVER), holding: get("holding", DEFAULT_HOLDING) };
}

/** Live, true facts about this prospect's market — the only numbers the AI may use. */
async function marketFacts(p: typeof prospects.$inferSelect) {
  const lines: string[] = [];
  const city = p.cityId ? await db.query.cities.findFirst({ where: eq(cities.id, p.cityId) }) : null;
  const cat = p.categoryId ? await db.query.categories.findFirst({ where: eq(categories.id, p.categoryId) }) : null;
  if (!city || !cat) {
    lines.push(`Their city/category isn't matched in Nearest yet (city: ${p.city ?? "unknown"}, category: ${p.category ?? "unknown"}). Don't state spots or prices for their area — say availability is confirmed when they claim a spot with their invite link.`);
    return lines;
  }
  const { slotCount, slotLimits } = await import("./slots");
  const { marketOfCity, cityBookingOpen } = await import("./city-booking");
  const { firstInStats, nextEntryStats, getEntryState } = await import("./entry");
  const [taken, { firstIn, cap }, market, open, fi, next, state] = await Promise.all([slotCount(city.id, cat.id), slotLimits(), marketOfCity(city.id), cityBookingOpen(city.id), firstInStats(), nextEntryStats(), getEntryState()]);
  const left = Math.max(0, cap - taken);
  lines.push(`${cat.name} in ${city.name}: ${taken} of ${cap} spots taken, ${left} left.`);
  if (state === "FIRST_IN_CLOSED") lines.push("New professional enrollment is paused right now — escalate if they want to join.");
  else if (left === 0) lines.push(market === "DFW" && next.open ? "That category is full there: they can join the free waitlist, or skip it by joining the next 750 at $17/month." : "That category is full there: they can join the free waitlist.");
  else if (market === "DFW") lines.push(taken < firstIn && fi.open && state === "FIRST_IN_OPEN" ? `Their price: First In, $11/month for the first 12 months (First In spot ${taken + 1} of ${firstIn} in this category and city).` : "Their price: $17/month for the first 12 months.");
  else lines.push("Their price: $20/month for the first 12 months.");
  lines.push(open ? `Booking is already open in ${city.name}: the first month is charged when they join.` : `Booking isn't open in ${city.name} yet: they save a card to claim the spot, nothing is charged until booking opens there, and their 12 months start then.`);
  lines.push("After the first 12 months the standard rate applies. Nearest takes no commission on bookings.");
  return lines;
}

async function knowledge() {
  const sections = await guideFor("pro");
  const guide = sections.map((s) => `## ${s.title}\n${s.topics.map((t) => `Q: ${t.q}\nA: ${[...t.a, ...(t.steps ?? [])].join(" ")}`).join("\n")}`).join("\n\n");
  const answers = await db.select().from(outreachAnswers).orderBy(asc(outreachAnswers.createdAt));
  return { guide: guide.slice(0, 24000), answers: answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n") };
}

type Decision = { action: "reply" | "send_link" | "escalate" | "declined"; reply: string; question?: string };

async function decide(p: typeof prospects.$inferSelect, history: (typeof prospectMessages.$inferSelect)[]): Promise<Decision | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const [copy, k, facts, recruiter] = await Promise.all([getAiCopy(), knowledge(), marketFacts(p), p.recruiterId ? db.query.users.findFirst({ where: eq(users.id, p.recruiterId) }) : null]);
  const recruiterName = [recruiter?.firstName, recruiter?.lastName].filter(Boolean).join(" ") || "the Nearest team";
  const system = `${copy.playbook}

RULES YOU MUST FOLLOW:
${copy.never}
- If the answer isn't clearly in the facts, approved answers or guide below, use action "escalate" (don't guess).
- Sign off as ${recruiterName}. Write plain text only. Do not include any link — if you choose "send_link", Nearest adds their personal invite link (good for 24 hours) for you; just say it's below.
- Reply ONLY with JSON: {"action":"reply"|"send_link"|"escalate"|"declined","reply":"<email text>","question":"<only for escalate: their question in one line>"}.
- "escalate": leave "reply" empty — Nearest sends a holding message. "declined": a short, kind goodbye.

FACTS (live, true right now):
Prospect: ${p.name}${p.business ? ` (${p.business})` : ""}. Recruiter: ${recruiterName}.
${facts.join("\n")}

APPROVED ANSWERS (use these when they fit):
${k.answers || "(none yet)"}

HOW NEAREST WORKS — PROFESSIONAL GUIDE (source of truth):
${k.guide}`;
  // The conversation must start with the prospect: emails we sent before their first reply become context.
  const firstIn = history.findIndex((m) => m.direction === "in");
  if (firstIn < 0) return null;
  const sentBefore = history.slice(0, firstIn).map((m) => `Subject: ${m.subject ?? ""}\n${m.body}`).join("\n---\n");
  const messages = history.slice(firstIn).map((m) => ({ role: m.direction === "in" ? "user" as const : "assistant" as const, content: m.direction === "in" ? m.body : JSON.stringify({ action: "reply", reply: m.body }) }));
  const fullSystem = sentBefore ? `${system}\n\nEMAILS ALREADY SENT TO THEM (before their reply):\n${sentBefore}` : system;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 700, system: fullSystem, messages }),
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) { console.error("AI recruiter", r.status, await r.text()); return null; }
    const data = (await r.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("").trim();
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Decision;
    if (!["reply", "send_link", "escalate", "declined"].includes(json.action)) return null;
    if (json.action !== "escalate" && !json.reply?.trim()) return null;
    return json;
  } catch (e) {
    console.error("AI recruiter", e);
    return null;
  }
}

/** Email a reply in the conversation (from the recruiter, reply-to the outreach reply address) and record it. */
export async function sendReply(p: typeof prospects.$inferSelect, body: string, author: "ai" | "admin", authorId?: string | null) {
  if (!process.env.RESEND_API_KEY || !p.email) return false;
  const last = await db.query.prospectMessages.findFirst({ where: and(eq(prospectMessages.prospectId, p.id), eq(prospectMessages.direction, "in")), orderBy: desc(prospectMessages.createdAt) });
  const recruiter = p.recruiterId ? await db.query.users.findFirst({ where: eq(users.id, p.recruiterId) }) : null;
  const name = [recruiter?.firstName, recruiter?.lastName].filter(Boolean).join(" ") || "The Nearest team";
  const { address } = await getTemplates();
  const unsub = `${base()}/unsubscribe/${unsubToken(p.id)}`;
  const subject = last?.subject ? (/^re:/i.test(last.subject) ? last.subject : `Re: ${last.subject}`) : "Re: Nearest";
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;max-width:560px">${body.split(/\n\s*\n/).map((x) => `<p style="margin:0 0 14px">${esc(x).replace(/\n/g, "<br>").replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>')}</p>`).join("")}
<p style="font-size:11px;color:#888;margin-top:24px;border-top:1px solid #eee;padding-top:10px">${esc(address)} • <a href="${unsub}" style="color:#888">Unsubscribe</a></p></div>`;
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: `${name} at Nearest <${SENDER}>`, to: p.email, replyTo: REPLY_TO, subject, html, text: `${body}\n\n--\n${address}\nUnsubscribe: ${unsub}`,
    headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click", ...(last?.messageId ? { "In-Reply-To": last.messageId, References: last.messageId } : {}) },
  });
  if (error) { console.error("reply failed", error.message); return false; }
  await db.insert(prospectMessages).values({ prospectId: p.id, direction: "out", author, authorId: authorId ?? null, subject, body });
  await db.update(prospects).set({ lastContactAt: new Date(), lastMessageAt: new Date(), updatedAt: new Date() }).where(eq(prospects.id, p.id));
  return true;
}

// Only a reply that is essentially just a stop request — "Stop by my salon sometime" must NOT unsubscribe anyone.
const OPT_OUT = /^\W*(please\s+)?(stop|unsubscribe|remove me|remove me from (this|your) list|take me off (this|your) list|do not (contact|email) me|don'?t (contact|email) me( again)?|no more emails)(\s+please)?\W*$/i;
export const isOptOut = (body: string) => OPT_OUT.test(body.split("\n")[0].trim().slice(0, 80));

/** Strip the quoted older email from a reply ("On Mon, … wrote:" and "> …" lines). */
export function cleanReply(text: string) {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  for (const l of lines) {
    if (/^On .+wrote:\s*$/.test(l) || /^-{2,}\s*Original Message/i.test(l) || /^From: .+/.test(l) && out.length > 0) break;
    if (/^\s*>/.test(l)) continue;
    out.push(l);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 6000);
}

/** An email arrived at the outreach reply address. */
export async function handleInbound(e: { from: string; subject: string; text: string; messageId: string | null }) {
  const em = normEmail(e.from.match(/<([^>]+)>/)?.[1] ?? e.from);
  if (e.messageId && (await db.query.prospectMessages.findFirst({ where: eq(prospectMessages.messageId, e.messageId) }))) return "duplicate";
  const p = em ? await db.query.prospects.findFirst({ where: eq(prospects.emailNorm, em) }) : null;
  const body = cleanReply(e.text) || "(empty message)";
  if (!p) {
    await notifyAdmins({ kind: "inbound_unknown", title: "Email to the outreach inbox", body: `From ${e.from}: ${e.subject || "(no subject)"} — ${body.slice(0, 140)}` });
    return "unknown sender";
  }
  await db.insert(prospectMessages).values({ prospectId: p.id, direction: "in", author: "prospect", subject: e.subject, body, messageId: e.messageId });
  // They replied: stop automatic follow-ups.
  await db.update(prospects).set({ nextEmailAt: null, lastMessageAt: new Date(), updatedAt: new Date(), ...(["link_sent", "contacted", "scheduled", "approved", "no_response", "link_clicked"].includes(p.status) ? { status: "conversation" } : {}) }).where(eq(prospects.id, p.id));
  await logProspect(p.id, "replied", body.slice(0, 200), null);
  const notifyTo = p.recruiterId ? [p.recruiterId] : undefined;

  if (isOptOut(body)) {
    await db.insert(outreachSuppression).values({ emailNorm: em, phoneNorm: normPhone(p.phone), reason: "Replied asking to stop" });
    await db.update(prospects).set({ status: "opted_out", nextEmailAt: null }).where(eq(prospects.id, p.id));
    await logProspect(p.id, "opted_out", "Asked to stop — added to do-not-contact.", null);
    return "opted out";
  }
  if (["registered", "profile_complete"].includes(p.status)) {
    await notifyAdmins({ kind: "inbound_member", title: `${p.name} emailed info@`, body: `They're already a Nearest member: "${body.slice(0, 140)}"`, href: `/admin/outreach/prospects/${p.id}` }, notifyTo);
    return "member";
  }
  const fresh = (await db.query.prospects.findFirst({ where: eq(prospects.id, p.id) }))!;
  if (fresh.aiMode === "human" || !(await getFlag("outreach.ai_enabled")) || !process.env.ANTHROPIC_API_KEY) {
    await db.update(prospects).set({ status: "needs_review", reviewQuestion: body.slice(0, 300) }).where(eq(prospects.id, p.id));
    await notifyAdmins({ kind: "human_review", title: `${p.name} replied`, body: body.slice(0, 160), href: `/admin/outreach/prospects/${p.id}` }, notifyTo);
    return "for a person";
  }
  const history = await db.select().from(prospectMessages).where(eq(prospectMessages.prospectId, p.id)).orderBy(asc(prospectMessages.createdAt));
  const d = await decide(fresh, history.slice(-12));
  if (!d || d.action === "escalate") {
    const { holding } = await getAiCopy();
    await sendReply(fresh, holding, "ai");
    await db.update(prospects).set({ status: "needs_review", reviewQuestion: (d?.question || body).slice(0, 300) }).where(eq(prospects.id, p.id));
    await logProspect(p.id, "needs_review", `AI needs a person: ${(d?.question || body).slice(0, 160)}`, null);
    await notifyAdmins({ kind: "human_review", title: "Human review required", body: `${p.name}: ${(d?.question || body).slice(0, 150)}`, href: `/admin/outreach/review` }, notifyTo);
    return "escalated";
  }
  let reply = d.reply.trim();
  if (d.action === "send_link") {
    const link = await makeInviteLink(p.id);
    reply = `${reply}\n\nYour personal invite (good for 24 hours):\n${link}`;
  }
  const ok = await sendReply(fresh, reply, "ai");
  if (!ok) return "send failed";
  await db.update(prospects).set(d.action === "send_link" ? { status: "link_sent", linkSentAt: new Date() } : d.action === "declined" ? { status: "declined" } : { status: "conversation" }).where(eq(prospects.id, p.id));
  await logProspect(p.id, d.action === "send_link" ? "link_sent" : d.action === "declined" ? "declined" : "ai_replied", d.action === "send_link" ? "AI sent their invite link." : d.action === "declined" ? "Not interested — AI said goodbye and stopped." : "AI answered.", null);
  return d.action;
}
