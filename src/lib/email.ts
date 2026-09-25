import "server-only";
import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM || "Nearest <hello@usenearest.com>";

export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** One branded layout for every Nearest email: black, pearl text, one button. Never throws. */
export async function sendEmail(opts: { to: string | null | undefined; subject: string; eyebrow?: string; heading: string; lines: string[]; button?: { label: string; url: string } }) {
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
      text: [opts.heading, ...opts.lines, opts.button ? `${opts.button.label}: ${opts.button.url}` : ""].join("\n\n"),
    });
    if (error) { console.error("Email failed", opts.subject, error.message); return { sent: false as const, reason: error.message }; }
    return { sent: true as const };
  } catch (e) {
    console.error("Email failed", opts.subject, e);
    return { sent: false as const };
  }
}

export async function sendInviteEmail(opts: { to: string; name: string; city: string; code: string; link: string; expires: string }) {
  if (!emailEnabled()) return { sent: false as const, reason: "Email isn't set up yet (no RESEND_API_KEY)." };
  const r = await sendEmail({
    to: opts.to, subject: "You're invited to Nearest's founding 750", eyebrow: "Founding Professional Invitation",
    heading: `${opts.name}, you're invited to join Nearest's founding 750.`,
    lines: [`Invitation code: ${opts.code}`, `City: ${opts.city}`, `Expires: ${opts.expires}`, "30 days free, then $10/month for your first 12 months. Your founding rate is locked to your account."],
    button: { label: "Accept invitation", url: opts.link },
  });
  return r.sent ? { sent: true as const } : { sent: false as const, reason: "reason" in r ? r.reason ?? "Email failed" : "Email failed" };
}
