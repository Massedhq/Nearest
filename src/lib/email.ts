import "server-only";
import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM || "Nearest <invites@usenearest.com>";

export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendInviteEmail(opts: { to: string; name: string; city: string; code: string; link: string; expires: string }) {
  if (!emailEnabled()) return { sent: false as const, reason: "Email isn't set up yet (no RESEND_API_KEY)." };
  const resend = new Resend(process.env.RESEND_API_KEY);
  const html = `
  <div style="background:#000;padding:32px 20px;font-family:Arial,Helvetica,sans-serif;color:#ECE8E1">
    <div style="max-width:480px;margin:0 auto">
      <p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#E3C58A;margin:0 0 12px">Founding Professional Invitation</p>
      <h1 style="font-family:Georgia,serif;font-weight:500;font-size:28px;line-height:1.15;margin:0 0 16px">${esc(opts.name)}, you're invited to join Nearest's founding 750.</h1>
      <table style="width:100%;border:1px solid #242427;border-radius:14px;padding:12px;margin:0 0 16px;color:#ECE8E1;font-size:14px">
        <tr><td style="color:#A8A399">Invitation code</td><td style="text-align:right;font-weight:bold">${esc(opts.code)}</td></tr>
        <tr><td style="color:#A8A399">City</td><td style="text-align:right;font-weight:bold">${esc(opts.city)}</td></tr>
        <tr><td style="color:#A8A399">Expires</td><td style="text-align:right;font-weight:bold">${esc(opts.expires)}</td></tr>
      </table>
      <p style="font-size:15px;margin:0 0 20px">30 days free, then $10/month for your first 12 months. Your founding rate is locked to your account.</p>
      <a href="${esc(opts.link)}" style="display:block;text-align:center;background:#ECE8E1;color:#0A0A0A;text-decoration:none;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;padding:16px;border-radius:26px">Accept invitation</a>
    </div>
  </div>`;
  const { error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: "You're invited to Nearest's founding 750",
    html,
    text: `${opts.name}, you're invited to join Nearest's founding 750.\nCode: ${opts.code}\nCity: ${opts.city}\nExpires: ${opts.expires}\nAccept: ${opts.link}`,
  });
  if (error) return { sent: false as const, reason: error.message };
  return { sent: true as const };
}
