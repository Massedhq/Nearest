import { Resend } from "resend";
import { handleInbound } from "@/lib/outreach-ai";

export const maxDuration = 60;

/**
 * Resend Inbound → emails sent to info@usenearest.com. The webhook only carries the envelope (sender, subject, id),
 * so the message body is fetched with the Received Emails API. Every call is verified with the webhook signing secret.
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_INBOUND_SECRET;
  if (!secret || !process.env.RESEND_API_KEY) return new Response("Inbound email isn't set up", { status: 500 });
  const payload = await req.text();
  const resend = new Resend(process.env.RESEND_API_KEY);
  let event: { type?: string; data?: { email_id?: string; from?: string; to?: string[]; subject?: string; message_id?: string } };
  try {
    event = resend.webhooks.verify({
      payload,
      headers: { id: req.headers.get("svix-id") ?? "", timestamp: req.headers.get("svix-timestamp") ?? "", signature: req.headers.get("svix-signature") ?? "" },
      webhookSecret: secret,
    }) as typeof event;
  } catch {
    return new Response("Bad signature", { status: 400 });
  }
  if (event.type !== "email.received" || !event.data?.email_id) return Response.json({ ok: true, ignored: event.type });
  try {
    const { data: email } = await resend.emails.receiving.get(event.data.email_id);
    const text = email?.text || (email?.html ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
    const result = await handleInbound({ from: email?.from ?? event.data.from ?? "", subject: email?.subject ?? event.data.subject ?? "", text, messageId: email?.message_id ?? event.data.message_id ?? null });
    return Response.json({ ok: true, result });
  } catch (e) {
    console.error("inbound email", e);
    return new Response("Error", { status: 500 }); // Resend retries
  }
}
