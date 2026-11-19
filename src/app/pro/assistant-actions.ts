"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, partnerAssistants } from "@/db";
import { requirePro } from "@/lib/pro";
import { getViewer } from "@/lib/viewer";
import { isPartner } from "@/lib/partner-booking";
import { logActivity } from "@/lib/log";
import { sendEmail } from "@/lib/email";
import { ASSIST_COOKIE, ASSISTANT_INVITE_DAYS, MAX_ASSISTANTS, activeAssistant, newAssistantToken } from "@/lib/assistants";

type FormState = { error?: string; ok?: string };
const APP = () => process.env.APP_URL || "https://usenearest.com";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function emailInvite(to: string, name: string, business: string, token: string) {
  await sendEmail({
    to, subject: `${business} invited you to help on Nearest`, eyebrow: "Assistant invitation", heading: `Help run ${business} on Nearest.`,
    lines: [`Hi ${name.split(" ")[0]}, ${business} added you as their assistant.`, "You'll create your own login and can post Model Calls, update services and prices, add photos, edit their partner page, see appointments and message clients.", `This link works for ${ASSISTANT_INVITE_DAYS} days.`],
    button: { label: "Accept and create my login", url: `${APP()}/pro/assistant/join/${token}` },
  }).catch(() => undefined); // a failed email never blocks the invite
}

/** The partner (never their assistant — requirePro refuses assistants here) invites an assistant by name + email. */
export async function inviteAssistant(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requirePro();
  if (!(await isPartner(user.id))) return { error: "Assistants are for Nearest Partners." };
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  if (!name) return { error: "Enter your assistant's name." };
  if (!EMAIL.test(email)) return { error: "Enter a valid email." };
  if (email === user.email?.toLowerCase()) return { error: "That's your own email — your assistant needs their own." };
  const mine = await db.select().from(partnerAssistants).where(and(eq(partnerAssistants.partnerId, user.id), inArray(partnerAssistants.status, ["invited", "active"])));
  if (mine.some((a) => a.email === email)) return { error: "You already added this email." };
  if (mine.length >= MAX_ASSISTANTS) return { error: `You can have up to ${MAX_ASSISTANTS} assistants. Remove one first.` };
  const token = newAssistantToken();
  const [row] = await db.insert(partnerAssistants).values({ partnerId: user.id, name, email, token, inviteExpiresAt: new Date(Date.now() + ASSISTANT_INVITE_DAYS * 86400000) }).returning();
  await logActivity({ actorUserId: user.id, action: "assistant.invited", targetType: "partner", targetId: user.id, after: { name, email, id: row.id } });
  await emailInvite(email, name, profile.businessName || [user.firstName, user.lastName].filter(Boolean).join(" ") || "A Nearest Partner", token);
  revalidatePath("/pro/partner");
  return { ok: `Invitation sent to ${email}.` };
}

/** New link (old one stops working) for an invitation that hasn't been accepted yet. */
export async function resendAssistant(form: FormData) {
  const { user, profile } = await requirePro();
  const id = String(form.get("id") ?? "");
  const token = newAssistantToken();
  const [row] = await db.update(partnerAssistants).set({ token, inviteExpiresAt: new Date(Date.now() + ASSISTANT_INVITE_DAYS * 86400000) })
    .where(and(eq(partnerAssistants.id, id), eq(partnerAssistants.partnerId, user.id), eq(partnerAssistants.status, "invited"))).returning();
  if (row) {
    await emailInvite(row.email, row.name, profile.businessName || "A Nearest Partner", token);
    await logActivity({ actorUserId: user.id, action: "assistant.resent", targetType: "partner", targetId: user.id, after: { id } });
  }
  revalidatePath("/pro/partner");
}

/** Remove an assistant (or cancel an invitation). Access ends on their next tap — it's checked on every request. */
export async function removeAssistant(form: FormData) {
  const { user } = await requirePro();
  const id = String(form.get("id") ?? "");
  const [row] = await db.update(partnerAssistants).set({ status: "removed", removedAt: new Date() })
    .where(and(eq(partnerAssistants.id, id), eq(partnerAssistants.partnerId, user.id), sql`${partnerAssistants.status} <> 'removed'`)).returning();
  if (row) await logActivity({ actorUserId: user.id, action: "assistant.removed", targetType: "partner", targetId: user.id, after: { id, name: row.name } });
  revalidatePath("/pro/partner");
}

/** Assistant: start managing one of the partners they help. */
export async function startAssisting(form: FormData) {
  const viewer = await getViewer();
  if (!viewer?.user || viewer.user.accountType !== "staff") redirect("/pro/assistant");
  const partnerId = String(form.get("partnerId") ?? "");
  if (!(await activeAssistant(viewer.user.id, partnerId))) redirect("/pro/assistant?e=removed");
  (await cookies()).set(ASSIST_COOKIE, partnerId, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 30 });
  const name = [viewer.user.firstName, viewer.user.lastName].filter(Boolean).join(" ") || "Assistant";
  await logActivity({ actorUserId: viewer.user.id, action: "assistant.started", targetType: "partner", targetId: partnerId, after: { by: name, detail: null } });
  redirect("/pro/assistant");
}

/** Assistant: stop managing (back to the list of businesses). */
export async function stopAssisting() {
  (await cookies()).delete(ASSIST_COOKIE);
  redirect("/pro/assistant");
}
