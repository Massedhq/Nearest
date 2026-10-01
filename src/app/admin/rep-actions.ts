"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, ne } from "drizzle-orm";
import { db, salesReps } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { mainOwnerId } from "@/lib/partner";
import { logActivity } from "@/lib/log";
import { sendRepInviteEmail } from "@/lib/email";
import { newRepCode, newRepToken, REP_INVITE_DAYS } from "@/lib/reps";
import type { FormState } from "@/app/admin/actions";

/** Sales Board actions — main owner only, checked here on the server (not just hidden in the page). */
async function requireMain() {
  const { user } = await requireAdmin();
  if ((await mainOwnerId()) !== user.id) throw new Error("Only the main owner can manage sales reps.");
  return user;
}

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" });

async function emailInvite(rep: typeof salesReps.$inferSelect) {
  const link = `${await origin()}/rep/join/${rep.token}`;
  const res = await sendRepInviteEmail({ to: rep.email, name: rep.name, link, expires: fmt(rep.inviteExpiresAt) });
  return { link, sent: res.sent };
}

export async function inviteRep(_: FormState, form: FormData): Promise<FormState> {
  let user;
  try { user = await requireMain(); } catch (e) { return { error: (e as Error).message }; }
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 120);
  if (!name) return { error: "Enter their name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a real email address." };
  const existing = await db.query.salesReps.findFirst({ where: and(eq(salesReps.email, email), ne(salesReps.status, "removed")) });
  if (existing) return { error: existing.status === "active" ? "This person is already on your sales team." : "This person already has an invitation. Use Resend below." };

  const expires = new Date(Date.now() + REP_INVITE_DAYS * 86400000);
  let rep: typeof salesReps.$inferSelect | undefined;
  for (let i = 0; i < 5 && !rep; i++) {
    [rep] = await db.insert(salesReps).values({ name, email, code: newRepCode(), token: newRepToken(), invitedBy: user.id, inviteExpiresAt: expires }).onConflictDoNothing().returning();
  }
  if (!rep) return { error: "Couldn't create the invitation. Try again." };
  await logActivity({ actorUserId: user.id, action: "rep.invited", targetType: "sales_rep", targetId: rep.id, after: { name, email } });
  const { link, sent } = await emailInvite(rep);
  revalidatePath("/admin/sales-board");
  return { ok: sent ? `Invitation emailed to ${email}.` : `Invitation created, but the email didn't send. Copy this link and send it to them: ${link}` };
}

export async function resendRepInvite(_: FormState, form: FormData): Promise<FormState> {
  try { await requireMain(); } catch (e) { return { error: (e as Error).message }; }
  const rep = await db.query.salesReps.findFirst({ where: eq(salesReps.id, String(form.get("id") ?? "")) });
  if (!rep || rep.status !== "invited") return { error: "This invitation can't be resent." };
  // Fresh link and a fresh 14 days.
  const [fresh] = await db.update(salesReps).set({ token: newRepToken(), inviteExpiresAt: new Date(Date.now() + REP_INVITE_DAYS * 86400000) }).where(eq(salesReps.id, rep.id)).returning();
  const { link, sent } = await emailInvite(fresh);
  revalidatePath("/admin/sales-board");
  return { ok: sent ? `Sent again to ${rep.email}.` : `The email didn't send. Copy this link and send it to them: ${link}` };
}

/** Remove a rep: their dashboard closes and their link stops giving credit. Past sign-ups stay counted. */
export async function setRepStatus(_: FormState, form: FormData): Promise<FormState> {
  let user;
  try { user = await requireMain(); } catch (e) { return { error: (e as Error).message }; }
  const id = String(form.get("id") ?? "");
  const to = String(form.get("to") ?? "");
  const rep = await db.query.salesReps.findFirst({ where: eq(salesReps.id, id) });
  if (!rep) return { error: "Not found." };
  const status = to === "removed" ? "removed" : rep.userId ? "active" : "invited";
  await db.update(salesReps).set({ status }).where(eq(salesReps.id, id));
  await logActivity({ actorUserId: user.id, action: to === "removed" ? "rep.removed" : "rep.restored", targetType: "sales_rep", targetId: id, before: rep.status, after: status });
  revalidatePath("/admin/sales-board");
  return { ok: to === "removed" ? `${rep.name} was removed.` : `${rep.name} is back on the team.` };
}
