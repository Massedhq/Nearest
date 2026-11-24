import "server-only";
import { and, eq } from "drizzle-orm";
import { db, users, teamAssistants } from "@/db";
import type { FieldActor } from "@/lib/team";

/**
 * Field team room (2026-11-23): meetings, the Note Room and who works which organization. A team = one owner + that
 * owner's active assistants (Avy + Nicky + Deann). Everything here is scoped to actor.ownerId.
 */
export type Member = { userId: string; name: string; email: string | null; owner: boolean };

export async function teamMembers(ownerId: string): Promise<Member[]> {
  const o = await db.query.users.findFirst({ where: eq(users.id, ownerId), columns: { id: true, firstName: true, email: true } });
  const helpers = await db.select({ userId: teamAssistants.userId, name: teamAssistants.name, email: teamAssistants.email })
    .from(teamAssistants).where(and(eq(teamAssistants.ownerId, ownerId), eq(teamAssistants.status, "active")));
  return [
    ...(o ? [{ userId: o.id, name: o.firstName ?? "Owner", email: o.email, owner: true }] : []),
    ...helpers.filter((h) => h.userId).map((h) => ({ userId: h.userId!, name: h.name, email: h.email, owner: false })),
  ];
}

/** The person this screen belongs to (an owner viewing an assistant's screen = that assistant). */
export const meOf = (a: FieldActor) => a.assistant?.userId ?? a.user.id;

const APP = () => process.env.APP_URL || "https://usenearest.com";

/** Tell teammates: the owner gets a bell + email (admin link), assistants an in-app notice + email (workspace link). */
export async function teamNotify(ownerId: string, to: string[] | "all", exceptUserId: string | null, title: string, body: string, path: string, email = true) {
  const { notifyAdmins } = await import("@/lib/outreach");
  const { inbox } = await import("@/lib/inbox");
  const { sendEmail } = await import("@/lib/email");
  for (const m of await teamMembers(ownerId)) {
    if (m.userId === exceptUserId || (to !== "all" && !to.includes(m.userId))) continue;
    const href = `${m.owner ? "/admin/field" : "/outreach"}${path}`;
    if (m.owner) await notifyAdmins({ kind: "field", title, body, href }, [m.userId]).catch(() => undefined);
    else await inbox(m.userId, { kind: "field", title, body, href }).catch(() => undefined);
    if (email) await sendEmail({ to: m.email, subject: title, eyebrow: "Field team", heading: title, lines: [body], button: { label: "Open it", url: `${APP()}${href}` } }).catch(() => undefined);
  }
}

/** Only Google Meet or Facebook / Messenger video links (owner's rule — no other outside services). */
export function meetingLinkProblem(link: string): string | null {
  if (!link) return null;
  let u: URL;
  try { u = new URL(link); } catch { return "Paste the full meeting link (it starts with https://)."; }
  if (u.protocol !== "https:") return "The meeting link should start with https://";
  const h = u.hostname.toLowerCase();
  const ok = h === "meet.google.com" || h === "facebook.com" || h.endsWith(".facebook.com") || h === "messenger.com" || h.endsWith(".messenger.com") || h === "m.me" || h === "fb.me";
  return ok ? null : "Use a Google Meet or Facebook / Messenger video link.";
}

export const HOW: Record<string, string> = { video: "Video (Google Meet or Facebook)", in_person: "In person", phone: "Phone call" };

/** Google Calendar "add event" link (opens their own calendar; nothing is sent to Google by Nearest). */
export function calendarLink(m: { title: string; startsAt: Date; minutes: number; agenda: string | null; link: string | null; place: string | null }) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = new Date(m.startsAt.getTime() + m.minutes * 60000);
  const q = new URLSearchParams({ action: "TEMPLATE", text: m.title, dates: `${f(m.startsAt)}/${f(end)}`, details: [m.agenda, m.link].filter(Boolean).join("\n\n"), location: m.link ?? m.place ?? "" });
  return `https://calendar.google.com/calendar/render?${q}`;
}
