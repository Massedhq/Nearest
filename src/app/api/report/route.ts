import { and, eq, gte, sql } from "drizzle-orm";
import { db, problemReports } from "@/db";
import { getViewer } from "@/lib/viewer";
import { sendEmail } from "@/lib/email";

const SUPPORT = process.env.SUPPORT_EMAIL || "support@usenearest.com";
const cut = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);

/** Receives an automatic problem report (error details + screenshot), saves it, and emails support. */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: "Bad report" }, { status: 400 }); }
  const viewer = await getViewer().catch(() => null);
  const userId = viewer?.user?.id ?? null;

  // Keep it from flooding: at most 10 reports per person per hour.
  if (userId) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(problemReports)
      .where(and(eq(problemReports.userId, userId), gte(problemReports.createdAt, new Date(Date.now() - 3600_000))));
    if (n >= 10) return Response.json({ ok: true, ref: "limit" });
  }

  const shot = typeof body.screenshot === "string" ? /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(body.screenshot)?.[1] ?? null : null;
  const screenshot = shot && shot.length < 4_000_000 ? shot : null;
  const ref = `NR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const accountType = viewer?.admin ? "admin" : viewer?.user?.accountType ?? "signed out";
  const who = viewer?.user ? `${viewer.user.firstName ?? ""} ${viewer.user.lastName ?? ""}`.trim() + ` <${viewer.user.email ?? "no email"}>` : "Not signed in";

  const [row] = await db.insert(problemReports).values({
    ref, userId, accountType,
    url: cut(body.url, 500) ?? "unknown", message: cut(body.message, 2000) ?? "Unknown error",
    stack: cut(body.stack, 6000), digest: cut(body.digest, 100), userAgent: cut(req.headers.get("user-agent"), 400),
    viewport: cut(body.viewport, 40), note: cut(body.note, 1000), screenshotB64: screenshot,
  }).returning();

  const res = await sendEmail({
    to: SUPPORT,
    subject: `Problem report ${ref} — ${accountType} — ${String(body.message ?? "error").slice(0, 60)}`,
    eyebrow: "Automatic problem report",
    heading: `${ref}: something went wrong for a ${accountType}`,
    lines: [
      `Who: ${who}`,
      `Page: ${row.url}`,
      `When: ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} (Central)`,
      `Error: ${row.message}`,
      row.digest ? `Server error ID: ${row.digest} (search this in Vercel → Logs)` : "",
      row.note ? `Their note: ${row.note}` : "Their note: (none)",
      `Device: ${row.userAgent ?? "unknown"} • screen ${row.viewport ?? "?"}`,
      row.stack ? `Details: ${row.stack.split("\n").slice(0, 6).join(" | ")}` : "",
      screenshot ? "Screenshot attached." : "No screenshot could be captured.",
    ].filter(Boolean),
    button: { label: "Open problem reports", url: `${process.env.APP_URL || "https://usenearest.com"}/admin/reports` },
    attachments: screenshot ? [{ filename: `${ref}-screenshot.jpg`, content: screenshot }] : undefined,
    replyTo: viewer?.user?.email ?? undefined,
  });
  if (res.sent) await db.update(problemReports).set({ emailed: true }).where(eq(problemReports.id, row.id));
  return Response.json({ ok: true, ref });
}
