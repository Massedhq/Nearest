"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, ne } from "drizzle-orm";
import { db, salesReps, repPayouts } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { mainOwnerId } from "@/lib/partner";
import { logActivity } from "@/lib/log";
import { sendRepInviteEmail } from "@/lib/email";
import { newRepCode, newRepToken } from "@/lib/reps";
import { parseExpiry, expiryLabel } from "@/lib/invite-expiry";
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

const fmt = (d: Date) => expiryLabel(d);

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

  const exp = parseExpiry(form);
  if ("error" in exp) return { error: exp.error };
  const expires = exp.at;
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
  // Fresh link, with the new expiration you choose.
  const exp = parseExpiry(form);
  if ("error" in exp) return { error: exp.error };
  const [fresh] = await db.update(salesReps).set({ token: newRepToken(), inviteExpiresAt: exp.at }).where(eq(salesReps.id, rep.id)).returning();
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

/** Pay a sales rep through Stripe (from Nearest's Stripe balance to their connected bank or debit card). */
export async function payRep(_: FormState, form: FormData): Promise<FormState> {
  let user;
  try { user = await requireMain(); } catch (e) { return { error: (e as Error).message }; }
  const id = String(form.get("id") ?? "");
  const dollars = Number(String(form.get("amount") ?? "").replace(/[^0-9.]/g, ""));
  const note = String(form.get("note") ?? "").trim().slice(0, 140) || null;
  if (!Number.isFinite(dollars) || dollars < 1 || dollars > 10000) return { error: "Enter an amount between $1 and $10,000." };
  const cents = Math.round(dollars * 100);
  const rep = await db.query.salesReps.findFirst({ where: eq(salesReps.id, id) });
  if (!rep || rep.status !== "active") return { error: "Only active reps can be paid." };
  if (rep.verificationStatus !== "approved") return { error: `${rep.name} isn't verified yet. Approve their ID first.` };
  if (!rep.stripeAccountId || !rep.payoutsEnabled) return { error: `${rep.name} hasn't finished payout setup yet. They can do it from their dashboard.` };
  try {
    const { stripe } = await import("@/lib/stripe");
    const t = await stripe().transfers.create({
      amount: cents, currency: "usd", destination: rep.stripeAccountId,
      description: `Nearest sales ambassador payment${note ? ` — ${note}` : ""}`,
      metadata: { repId: rep.id, kind: "rep_payout" },
    });
    await db.insert(repPayouts).values({ repId: rep.id, amountCents: cents, note, stripeTransferId: t.id, createdBy: user.id });
    await logActivity({ actorUserId: user.id, action: "rep.paid", targetType: "sales_rep", targetId: rep.id, after: { cents, note, transfer: t.id } });
  } catch (e) {
    const m = (e as Error).message ?? "";
    return { error: /insufficient/i.test(m) ? "Nearest's Stripe balance doesn't have enough available funds for this payment yet." : `Stripe didn't send the payment: ${m}` };
  }
  revalidatePath("/admin/sales-board");
  return { ok: `Sent $${dollars.toFixed(2)} to ${rep.name}.` };
}

/** Approve or reject a rep's ID + selfie. The photos are deleted on every decision. */
export async function reviewRepVerification(_: FormState, form: FormData): Promise<FormState> {
  let user;
  try { user = await requireMain(); } catch (e) { return { error: (e as Error).message }; }
  const id = String(form.get("id") ?? "");
  const approve = form.get("decision") === "approve";
  const reason = String(form.get("reason") ?? "").trim().slice(0, 200) || null;
  if (!approve && !reason) return { error: "Add a short reason so they know what to fix." };
  const rep = await db.query.salesReps.findFirst({ where: eq(salesReps.id, id) });
  if (!rep?.userId || rep.verificationStatus !== "pending") return { error: "This rep isn't waiting for review." };
  await db.update(salesReps).set(approve
    ? { verificationStatus: "approved", verifiedAt: new Date(), verificationNote: null }
    : { verificationStatus: "rejected", verificationNote: reason }).where(eq(salesReps.id, id));
  const { studentIdDocs } = await import("@/db");
  const { inArray, and: both } = await import("drizzle-orm");
  await db.delete(studentIdDocs).where(both(eq(studentIdDocs.userId, rep.userId), inArray(studentIdDocs.kind, ["gov_id", "selfie"])));
  await logActivity({ actorUserId: user.id, action: approve ? "rep.verification_approved" : "rep.verification_rejected", targetType: "sales_rep", targetId: id, after: reason });
  const { sendRepVerificationEmail } = await import("@/lib/email");
  await sendRepVerificationEmail({ to: rep.email, name: rep.name.split(" ")[0], approved: approve, reason, link: `${await origin()}/rep` });
  revalidatePath("/admin/sales-board");
  return { ok: approve ? `${rep.name} is verified — their links are live.` : `${rep.name} was asked to send new photos.` };
}
