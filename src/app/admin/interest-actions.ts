"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, locationInterest } from "@/db";
import { requireAdmin } from "@/lib/admin";

export async function markInterestContacted(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (/^[0-9a-f-]{36}$/.test(id)) await db.update(locationInterest).set({ contactedAt: new Date() }).where(eq(locationInterest.id, id));
  revalidatePath("/admin/outreach/interest");
}
