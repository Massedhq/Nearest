"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, users, professionalProfiles } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { legalNameProblem } from "@/lib/legal-name";

type FormState = { error?: string; ok?: string };

/** Admin → Review account: correct a professional's legal name (it must match their government ID, never their business name). */
export async function correctLegalName(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const id = String(form.get("userId") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return { error: "Not found." };
  const first = String(form.get("firstName") ?? "").trim().replace(/\s+/g, " ");
  const last = String(form.get("lastName") ?? "").trim().replace(/\s+/g, " ");
  const [row] = await db.select({ u: users, p: professionalProfiles }).from(users).innerJoin(professionalProfiles, eq(professionalProfiles.userId, users.id)).where(eq(users.id, id)).limit(1);
  if (!row) return { error: "Not found." };
  const problem = legalNameProblem(first, last, row.p.businessName, "they");
  if (problem) return { error: problem };
  await db.update(users).set({ firstName: first, lastName: last, updatedAt: new Date() }).where(eq(users.id, id));
  await logActivity({ actorUserId: user.id, action: "pro.legal_name_corrected", targetType: "professional", targetId: id, before: { firstName: row.u.firstName, lastName: row.u.lastName }, after: { firstName: first, lastName: last } });
  revalidatePath(`/admin/professionals/${id}`);
  return { ok: "Legal name updated." };
}
