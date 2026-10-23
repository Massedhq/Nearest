"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";

type FormState = { error?: string; ok?: string };

/** Owner: let a held professional finish registering (they're emailed + notified). */
export async function releaseEnrollmentHold(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const id = String(form.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return { error: "Not found." };
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
  const { releaseHold } = await import("@/lib/enrollment-holds");
  const h = await releaseHold(id, user.id, note);
  if (!h) return { error: "This hold was already released." };
  await logActivity({ actorUserId: user.id, action: "enrollment_hold.released", targetType: "enrollment_hold", targetId: id, before: { status: "held" }, after: { status: "released", note, kind: h.kind, subject: h.subjectId } });
  revalidatePath("/admin/enrollment-holds");
  return { ok: "Released — they've been told they can finish registering." };
}

/** Owner: put a released professional back on hold. */
export async function reholdEnrollment(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const id = String(form.get("id") ?? "");
  const { holdAgain } = await import("@/lib/enrollment-holds");
  const h = await holdAgain(id);
  if (!h) return { error: "Only released professionals can be put back on hold." };
  await logActivity({ actorUserId: user.id, action: "enrollment_hold.held_again", targetType: "enrollment_hold", targetId: id, before: { status: "released" }, after: { status: "held" } });
  revalidatePath("/admin/enrollment-holds");
  return { ok: "Back on hold." };
}

/** Owner: run the 30-day check now instead of waiting for the nightly run. */
export async function runEnrollmentHoldsNow(_: FormState): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const { runEnrollmentHolds } = await import("@/lib/enrollment-holds");
  const r = await runEnrollmentHolds();
  await logActivity({ actorUserId: user.id, action: "enrollment_hold.run", targetType: "enrollment_hold", after: r });
  revalidatePath("/admin/enrollment-holds");
  return { ok: `Checked. Newly on hold: ${r.accounts} account${r.accounts === 1 ? "" : "s"}, ${r.invitations} invitation${r.invitations === 1 ? "" : "s"}, ${r.outreach} registration link${r.outreach === 1 ? "" : "s"}.` };
}
