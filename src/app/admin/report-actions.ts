"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, problemReports } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";

export async function toggleReportResolved(form: FormData) {
  const { user } = await requireAdmin();
  const id = String(form.get("id"));
  const r = await db.query.problemReports.findFirst({ where: eq(problemReports.id, id) });
  if (!r) return;
  const next = r.status === "resolved" ? "new" : "resolved";
  await db.update(problemReports).set({ status: next }).where(eq(problemReports.id, id));
  await logActivity({ actorUserId: user.id, action: `report.${next}`, targetType: "report", targetId: r.ref });
  revalidatePath("/admin/reports");
}
