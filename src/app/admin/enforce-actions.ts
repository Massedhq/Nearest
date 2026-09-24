"use server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, studentProfiles, professionalProfiles, fines, appeals, partnerPayouts, users } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { sweep } from "@/lib/enforcement";
import { getSettings } from "@/lib/settings";
import { earningsFor, mainOwnerId, syncInvoices } from "@/lib/partner";
import type { FormState } from "@/components/ActionForm";

const nameOf = async (id: string) => { const u = await db.query.users.findFirst({ where: eq(users.id, id) }); return u ? `${u.firstName} ${u.lastName}` : id; };

export async function liftStudent(form: FormData) {
  const { user } = await requireAdmin();
  const id = String(form.get("userId"));
  await db.update(studentProfiles).set({ bookingSuspendedUntil: null, suspensionReason: null }).where(eq(studentProfiles.userId, id));
  await logActivity({ actorUserId: user.id, action: "student.suspension_lifted", targetType: "student", targetId: await nameOf(id) });
  revalidatePath("/admin", "layout");
}

export async function reverseNoShow(form: FormData) {
  const { user } = await requireAdmin();
  const id = String(form.get("userId"));
  const s = await getSettings();
  const [p] = await db.update(studentProfiles).set({ noShowCount: sql`greatest(${studentProfiles.noShowCount} - 1, 0)` }).where(eq(studentProfiles.userId, id)).returning();
  if (p && p.suspensionReason === "no_shows" && p.noShowCount <= Number(s["enforce.customer_noshow_limit"])) {
    await db.update(studentProfiles).set({ bookingSuspendedUntil: null, suspensionReason: null }).where(eq(studentProfiles.userId, id));
  }
  await logActivity({ actorUserId: user.id, action: "student.no_show_reversed", targetType: "student", targetId: await nameOf(id), after: p?.noShowCount });
  revalidatePath("/admin", "layout");
}

export async function waiveFine(form: FormData) {
  const { user } = await requireAdmin();
  const [f] = await db.update(fines).set({ status: "waived" }).where(and(eq(fines.id, String(form.get("id"))), eq(fines.status, "outstanding"))).returning();
  if (f) await logActivity({ actorUserId: user.id, action: "fine.waived", targetType: "fine", targetId: await nameOf(f.proId), before: "outstanding", after: "waived" });
  revalidatePath("/admin", "layout");
}

export async function liftPro(form: FormData) {
  const { user } = await requireAdmin();
  const id = String(form.get("userId"));
  await db.update(professionalProfiles).set({ suspendedUntil: null, suspensionReason: null }).where(eq(professionalProfiles.userId, id));
  await logActivity({ actorUserId: user.id, action: "pro.suspension_lifted", targetType: "professional", targetId: await nameOf(id) });
  revalidatePath("/admin", "layout");
}

export async function runChecks(_: FormState, form: FormData): Promise<FormState> {
  void form;
  const { user } = await requireAdmin();
  const r = await sweep();
  await logActivity({ actorUserId: user.id, action: "sweep.manual", after: r });
  revalidatePath("/admin", "layout");
  return { ok: `Checked ${r.checked}: ${r.released} payments released, ${r.suspended} students suspended${r.failed ? `, ${r.failed} need attention` : ""}.` };
}

export async function decideAppeal(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const id = String(form.get("id"));
  const decision = String(form.get("decision"));
  const note = String(form.get("note") ?? "").trim().slice(0, 1000);
  if (!["upheld", "overturned"].includes(decision)) return { error: "Choose Uphold or Overturn." };
  if (!note) return { error: "Add a reason for the record." };
  const [a] = await db.update(appeals).set({ status: decision as "upheld" | "overturned", decisionNote: note, decidedBy: user.id, decidedAt: new Date() })
    .where(and(eq(appeals.id, id), eq(appeals.status, "under_review"))).returning();
  if (!a) return { error: "Already decided." };
  if (decision === "overturned") {
    if (a.kind === "student_suspension") await db.update(studentProfiles).set({ bookingSuspendedUntil: null, suspensionReason: null }).where(eq(studentProfiles.userId, a.userId));
    if (a.kind === "pro_suspension") await db.update(professionalProfiles).set({ suspendedUntil: null, suspensionReason: null }).where(eq(professionalProfiles.userId, a.userId));
    if (a.kind === "pro_fine" && a.targetId) await db.update(fines).set({ status: "waived" }).where(and(eq(fines.id, a.targetId), eq(fines.status, "outstanding")));
  }
  await logActivity({ actorUserId: user.id, action: `appeal.${decision}`, targetType: a.kind, targetId: await nameOf(a.userId), after: note });
  revalidatePath("/admin", "layout");
  return { ok: decision === "overturned" ? "Overturned — the action was reversed." : "Upheld." };
}

// ---------- Sales Track (main owner only for money actions) ----------
async function requireMain() {
  const a = await requireAdmin();
  if ((await mainOwnerId()) !== a.user.id) throw new Error("Only the main owner can do this.");
  return a;
}

export async function syncPayments(_: FormState, form: FormData): Promise<FormState> {
  void form;
  const { user } = await requireMain();
  try {
    const n = await syncInvoices();
    await logActivity({ actorUserId: user.id, action: "partner.sync_payments", after: n });
    revalidatePath("/admin/sales");
    return { ok: `Synced ${n} paid membership invoices from Stripe.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function approvePayout(form: FormData) {
  const { user } = await requireMain();
  const month = String(form.get("month"));
  const partnerId = String(form.get("partnerId"));
  if (!/^\d{4}-\d{2}$/.test(month)) return;
  const e = await earningsFor(month);
  const row = e.perPartner.find((p) => p.userId === partnerId);
  if (!row || row.totalCents <= 0) return;
  await db.insert(partnerPayouts).values({ partnerId, month, amountCents: row.totalCents, approvedBy: user.id }).onConflictDoNothing();
  await logActivity({ actorUserId: user.id, action: "partner.payout_approved", targetType: "partner", targetId: row.name, after: { month, cents: row.totalCents } });
  revalidatePath("/admin/sales");
}

export async function markPayoutPaid(form: FormData) {
  const { user } = await requireMain();
  const [p] = await db.update(partnerPayouts).set({ status: "paid", paidAt: new Date(), note: String(form.get("note") ?? "").slice(0, 200) || null })
    .where(and(eq(partnerPayouts.id, String(form.get("id"))), eq(partnerPayouts.status, "approved"))).returning();
  if (p) await logActivity({ actorUserId: user.id, action: "partner.payout_paid", targetType: "partner", targetId: await nameOf(p.partnerId), after: { month: p.month, cents: p.amountCents } });
  revalidatePath("/admin/sales");
}
