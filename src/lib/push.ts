import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, appKeys, pushSubscriptions } from "@/db";

/**
 * Phone alerts (web push) — free, no texting service. Works on Android and on computers, and on iPhone (iOS 16.4+)
 * once Nearest is added to the home screen. Nearest makes its own signing key the first time it's needed and keeps
 * it in app_keys, so there's nothing to set up. (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars win if they're set.)
 */
type Vapid = { publicKey: string; privateKey: string };
let cached: Vapid | null = null;

export async function vapidKeys(): Promise<Vapid> {
  if (cached) return cached;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) return (cached = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY });
  const row = await db.query.appKeys.findFirst({ where: eq(appKeys.key, "vapid") });
  if (row) return (cached = row.value as Vapid);
  const webpush = (await import("web-push")).default;
  const k = webpush.generateVAPIDKeys();
  await db.insert(appKeys).values({ key: "vapid", value: k }).onConflictDoNothing();
  // Two servers starting at once: whichever saved first wins, everyone uses that one.
  const saved = await db.query.appKeys.findFirst({ where: eq(appKeys.key, "vapid") });
  return (cached = (saved?.value as Vapid) ?? k);
}

/** Sends a phone alert to every phone this person turned alerts on for. Never throws; dead phones are removed. */
export async function pushTo(userId: string, n: { title: string; body?: string; href?: string; tag?: string }) {
  try {
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    if (!subs.length) return 0;
    const webpush = (await import("web-push")).default;
    const k = await vapidKeys();
    const contact = `mailto:${process.env.SUPPORT_EMAIL || "support@usenearest.com"}`;
    const payload = JSON.stringify({ title: n.title, body: n.body ?? "", url: n.href ?? "/", tag: n.tag });
    const gone: string[] = [];
    let sent = 0;
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { vapidDetails: { subject: contact, publicKey: k.publicKey, privateKey: k.privateKey }, TTL: 60 * 60 * 12, urgency: "high", timeout: 8000 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.id); // the phone unsubscribed or the browser was reset
        else console.error("push failed", code ?? e);
      }
    }));
    if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
    if (sent) await db.update(pushSubscriptions).set({ lastSentAt: new Date() }).where(eq(pushSubscriptions.userId, userId));
    return sent;
  } catch (e) {
    console.error("push", e);
    return 0;
  }
}
