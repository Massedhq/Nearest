import { eq } from "drizzle-orm";
import { db, prospects, outreachSuppression } from "@/db";
import { checkUnsubToken } from "@/lib/outreach-mail";
import { logProspect, normEmail, normPhone } from "@/lib/outreach";

const page = (title: string, body: string, form = "") => new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#0A0A0A;color:#ECE8E1;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px">
<div style="max-width:420px;text-align:center"><h1 style="font-family:Georgia,serif;font-weight:500">${title}</h1><p style="color:#B8B2A7">${body}</p>${form}</div></body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });

async function unsubscribe(token: string) {
  const id = checkUnsubToken(token);
  if (id?.startsWith("u-")) {
    // A member or student unsubscribing from broadcasts.
    const { users } = await import("@/db");
    const u = await db.query.users.findFirst({ where: eq(users.id, id.slice(2)) });
    if (!u?.email) return false;
    await db.insert(outreachSuppression).values({ emailNorm: normEmail(u.email), reason: "Unsubscribed from Nearest broadcasts" });
    return true;
  }
  const p = id ? await db.query.prospects.findFirst({ where: eq(prospects.id, id) }) : null;
  if (!p) return false;
  await db.insert(outreachSuppression).values({ emailNorm: normEmail(p.email), phoneNorm: normPhone(p.phone), reason: "Unsubscribed from outreach email" });
  if (p.status !== "opted_out") {
    await db.update(prospects).set({ status: "opted_out", nextEmailAt: null, updatedAt: new Date() }).where(eq(prospects.id, p.id));
    await logProspect(p.id, "opted_out", "Unsubscribed — added to do-not-contact.", null);
  }
  return true;
}

/** Link in the email: confirm first (so link scanners can't unsubscribe people by accident). */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!checkUnsubToken(token)) return page("Link not valid", "This unsubscribe link isn't valid. Reply to the email and we'll take care of it.");
  return page("Unsubscribe?", "You won't get any more emails from Nearest outreach.", `<form method="post"><button style="background:#ECE8E1;color:#0A0A0A;border:0;border-radius:24px;padding:14px 28px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;cursor:pointer">Unsubscribe</button></form>`);
}

/** The button above, and one-click unsubscribe from Gmail / Apple Mail. */
export async function POST(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (await unsubscribe(token)) ? page("You're unsubscribed", "You won't receive any more outreach emails from Nearest.") : page("Link not valid", "This unsubscribe link isn't valid.");
}
