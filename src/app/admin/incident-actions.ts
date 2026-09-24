"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, incidents } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { cancelAsProFault } from "@/lib/bookings";
import type { FormState } from "@/components/ActionForm";

export async function decideIncident(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const id = String(form.get("id"));
  const decision = String(form.get("decision"));
  const note = String(form.get("note") ?? "").trim().slice(0, 1000);
  if (!["pro_fault", "not_substantiated"].includes(decision)) return { error: "Choose a decision." };
  if (!note) return { error: "Add a short note for the record." };
  const [inc] = await db
    .update(incidents)
    .set({ status: decision as "pro_fault" | "not_substantiated", decisionNote: note, decidedBy: user.id, decidedAt: new Date() })
    .where(and(eq(incidents.id, id), eq(incidents.status, "open")))
    .returning();
  if (!inc) return { error: "Already decided." };
  if (decision === "pro_fault") await cancelAsProFault(inc.bookingId, "Professional fault confirmed");
  await logActivity({ actorUserId: user.id, action: `incident.${decision}`, targetType: "incident", targetId: inc.id, after: note });
  revalidatePath("/admin", "layout");
  return { ok: decision === "pro_fault" ? "Confirmed. The student received the full amount as Nearest credit." : "Closed as not substantiated." };
}
