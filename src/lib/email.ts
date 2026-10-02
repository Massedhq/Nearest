import "server-only";
import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM || "Nearest <hello@usenearest.com>";

export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** One branded layout for every Nearest email: black, pearl text, one button. Never throws. */
export async function sendEmail(opts: { to: string | null | undefined; subject: string; eyebrow?: string; heading: string; lines: string[]; button?: { label: string; url: string }; attachments?: { filename: string; content: string }[]; replyTo?: string }) {
  if (!emailEnabled() || !opts.to) return { sent: false as const };
  const html = `
  <div style="background:#000;padding:32px 20px;font-family:Arial,Helvetica,sans-serif;color:#ECE8E1">
    <div style="max-width:480px;margin:0 auto">
      ${opts.eyebrow ? `<p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#E3C58A;margin:0 0 12px">${esc(opts.eyebrow)}</p>` : ""}
      <h1 style="font-family:Georgia,serif;font-weight:500;font-size:26px;line-height:1.2;margin:0 0 16px">${esc(opts.heading)}</h1>
      ${opts.lines.map((l) => `<p style="font-size:15px;line-height:1.5;margin:0 0 10px;color:#D8D2C6">${esc(l)}</p>`).join("")}
      ${opts.button ? `<a href="${esc(opts.button.url)}" style="display:block;text-align:center;background:#ECE8E1;color:#0A0A0A;text-decoration:none;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;padding:16px;border-radius:26px;margin-top:20px">${esc(opts.button.label)}</a>` : ""}
      <p style="font-size:11px;color:#8F8A81;margin-top:28px">Nearest • Every alert is visual and readable. Reply-to is not monitored — message your professional in the app.</p>
    </div>
  </div>`;
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: FROM, to: opts.to, subject: opts.subject, html,
      ...(opts.attachments?.length ? { attachments: opts.attachments } : {}),
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      text: [opts.heading, ...opts.lines, opts.button ? `${opts.button.label}: ${opts.button.url}` : ""].join("\n\n"),
    });
    if (error) { console.error("Email failed", opts.subject, error.message); return { sent: false as const, reason: error.message }; }
    return { sent: true as const };
  } catch (e) {
    console.error("Email failed", opts.subject, e);
    return { sent: false as const };
  }
}

export async function sendInviteEmail(opts: { to: string; name: string; city?: string | null; code: string; link: string; expires: string; kind?: string; rateCents?: number | null }) {
  if (!emailEnabled()) return { sent: false as const, reason: "Email isn't set up yet (no RESEND_API_KEY)." };
  const rate = `$${((opts.rateCents ?? 1500) / 100).toFixed(0)}`;
  const offer = opts.kind === "AMBASSADOR"
    ? { subject: "You're invited to join Nearest as an Ambassador", eyebrow: "Ambassador Invitation", heading: `${opts.name}, you're invited to join Nearest as an Ambassador.`, line: "Your professional account is free — no sign-up fee and no monthly membership. Share Nearest with other professionals and help them get on board." }
    : opts.kind === "BOOKING_PAID"
      ? { subject: "You're invited to join Nearest", eyebrow: "Special Invitation", heading: `${opts.name}, you're invited to join Nearest.`, line: `Nothing to pay up front. Your membership is ${rate}/month, collected from your bookings — once ${rate} is covered for the month, the rest of that month's earnings are all yours. A month with no bookings costs nothing.` }
      : { subject: "You're invited to join Nearest First In", eyebrow: "First In Invitation", heading: `${opts.name}, you're invited to join Nearest First In.`, line: "$11/month for your first 12 months. Your First In rate is locked to your account." };
  const r = await sendEmail({
    to: opts.to, subject: offer.subject, eyebrow: offer.eyebrow,
    heading: offer.heading,
    lines: [`Invitation code: ${opts.code}`, ...(opts.city ? [`City: ${opts.city}`] : []), `Expires: ${opts.expires}`, offer.line],
    button: { label: "Accept invitation", url: opts.link },
  });
  return r.sent ? { sent: true as const } : { sent: false as const, reason: "reason" in r ? r.reason ?? "Email failed" : "Email failed" };
}

/** Sales Board: invitation for a new sales rep. */
export async function sendRepInviteEmail(opts: { to: string; name: string; link: string; expires: string }) {
  if (!emailEnabled()) return { sent: false as const, reason: "Email isn't set up yet (no RESEND_API_KEY)." };
  const r = await sendEmail({
    to: opts.to,
    subject: "You're invited to join the Nearest sales team",
    eyebrow: "Sales Team Invitation",
    heading: `${opts.name}, you're invited to join the Nearest sales team.`,
    lines: [
      `Create your account with this email address (${opts.to}). Your sales dashboard opens right after.`,
      "Your dashboard has your own links to share and shows everyone who signs up through them.",
      `This invitation expires ${opts.expires}.`,
    ],
    button: { label: "Accept invitation", url: opts.link },
  });
  return r.sent ? { sent: true as const } : { sent: false as const, reason: "reason" in r ? r.reason ?? "Email failed" : "Email failed" };
}

/** Sales Board: the result of a sales rep's identity check. */
export async function sendRepVerificationEmail(opts: { to: string; name: string; approved: boolean; reason?: string | null; link: string }) {
  if (!emailEnabled()) return { sent: false as const };
  const r = await sendEmail(opts.approved
    ? { to: opts.to, subject: "You're verified — your Nearest sales links are live", eyebrow: "Sales Team",
        heading: `${opts.name}, you're verified.`,
        lines: ["Your sales links are live now — sign-ups through them count for you.", "If you haven't yet, set up payouts on your dashboard so Nearest can pay you."],
        button: { label: "Open my dashboard", url: opts.link } }
    : { to: opts.to, subject: "Your Nearest sales verification needs another look", eyebrow: "Sales Team",
        heading: `${opts.name}, we couldn't verify your ID yet.`,
        lines: [opts.reason ? `Reason: ${opts.reason}` : "The photos didn't let us confirm your identity.", "Open your dashboard and send new photos — make sure your name and photo are clear and the selfie is well lit."],
        button: { label: "Send new photos", url: opts.link } });
  return { sent: r.sent };
}

/** Parent / guardian approval for a student aged 13–17. */
export async function sendGuardianEmail(opts: { to: string; studentFirst: string; age: number | null; link: string }) {
  if (!emailEnabled()) return { sent: false as const };
  const r = await sendEmail({
    to: opts.to,
    subject: `${opts.studentFirst} signed up for Nearest — your approval is needed`,
    eyebrow: "Parent or guardian approval",
    heading: `${opts.studentFirst} needs your approval to use Nearest.`,
    lines: [
      `${opts.studentFirst}${opts.age ? ` (age ${opts.age})` : ""} created a Nearest account and listed you as their parent or legal guardian.`,
      "Nearest is a booking platform where verified students book services with licensed, ID-checked professionals. Payments are held until each appointment is finished, and phone numbers and emails are never shared.",
      `${opts.studentFirst} can't book anything until you review and approve. If this wasn't you, or you don't approve, you can decline from the same page.`,
    ],
    button: { label: "Review and approve", url: opts.link },
  });
  return { sent: r.sent };
}
