"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, favorites } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";

export async function toggleFavorite(form: FormData) {
  const { user } = await requireVerifiedStudent();
  const proId = String(form.get("proId"));
  if (!/^[0-9a-f-]{36}$/.test(proId)) return;
  const [removed] = await db.delete(favorites).where(and(eq(favorites.studentId, user.id), eq(favorites.proId, proId))).returning();
  if (!removed) await db.insert(favorites).values({ studentId: user.id, proId }).onConflictDoNothing();
  revalidatePath("/home"); revalidatePath(`/p/${proId}`); revalidatePath("/favorites");
}
