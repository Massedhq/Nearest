import "server-only";
import { db, campaignNotices, users } from "@/db";
import { eq } from "drizzle-orm";

const base = () => process.env.APP_URL || "https://www.usenearest.com";

/**
 * Campaign email + in-app notice, sent at most once per key (retries and repeated cron runs never duplicate).
 * The key is claimed first; if it was already claimed nothing is sent. Email failures never block anything.
 */
export async function notifyOnce(key: string, userId: string, n: {
  title: string; body: string; href: string;
  email?: { subject: string; heading: string; lines: string[]; button: string };
}) {
  const claimed = await db.insert(campaignNotices).values({ key, userId }).onConflictDoNothing().returning({ key: campaignNotices.key });
  if (!claimed.length) return false;
  const { inbox } = await import("./inbox");
  await inbox(userId, { kind: "campaign", title: n.title, body: n.body, href: n.href, refId: key });
  if (n.email) {
    try {
      const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
      if (u?.email) {
        const { sendEmail } = await import("./email");
        await sendEmail({ to: u.email, subject: n.email.subject, eyebrow: "Nearest launch campaign", heading: n.email.heading, lines: n.email.lines, button: { label: n.email.button, url: `${base()}${n.href}` } });
      }
    } catch (e) { console.error("campaign email", key, e); }
  }
  return true;
}
