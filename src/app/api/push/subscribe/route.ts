import { and, eq } from "drizzle-orm";
import { db, pushSubscriptions } from "@/db";
import { getViewer } from "@/lib/viewer";

const ok = (u: unknown) => typeof u === "string" && /^https:\/\/[^\s]{10,900}$/.test(u);

/** Turn phone alerts on for this phone/browser (POST the browser's subscription), or off (DELETE with its endpoint). */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer?.user) return Response.json({ error: "Sign in" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;
  const p256dh = b?.keys?.p256dh, auth = b?.keys?.auth;
  if (!b || !ok(b.endpoint) || typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100) return Response.json({ error: "That browser didn't give a valid alert subscription." }, { status: 400 });
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 300) || null;
  // The same phone signing in as someone else moves the subscription to them.
  await db.insert(pushSubscriptions).values({ userId: viewer.user.id, endpoint: b.endpoint!, p256dh, auth, userAgent: ua })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: viewer.user.id, p256dh, auth, userAgent: ua } });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const viewer = await getViewer();
  if (!viewer?.user) return Response.json({ error: "Sign in" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (b?.endpoint) await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, viewer.user.id), eq(pushSubscriptions.endpoint, b.endpoint)));
  return Response.json({ ok: true });
}
