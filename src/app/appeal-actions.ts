"use server";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, appeals, fines } from "@/db";
import { getViewer } from "@/lib/viewer";
import type { FormState } from "@/components/ActionForm";

const KINDS = ["student_suspension", "pro_fine", "pro_suspension"];

export async function submitAppeal(_: FormState, form: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer?.user) redirect("/");
  const kind = String(form.get("kind"));
  const targetId = String(form.get("targetId") ?? "") || null;
  const explanation = String(form.get("explanation") ?? "").trim().slice(0, 2000);
  if (!KINDS.includes(kind)) return { error: "Something went wrong." };
  if (kind.startsWith("pro_") && viewer.user.accountType !== "professional") return { error: "Not allowed." };
  if (kind === "student_suspension" && viewer.user.accountType !== "student") return { error: "Not allowed." };
  if (kind === "pro_fine" && targetId) {
    const f = await db.query.fines.findFirst({ where: and(eq(fines.id, targetId), eq(fines.proId, viewer.user.id)) });
    if (!f) return { error: "Fine not found." };
  }
  if (explanation.length < 10) return { error: "Tell us what happened (a sentence or two)." };
  const open = await db.query.appeals.findFirst({ where: and(eq(appeals.userId, viewer.user.id), eq(appeals.kind, kind), eq(appeals.status, "under_review")) });
  if (open) return { error: "You already have a review in progress for this." };
  await db.insert(appeals).values({ userId: viewer.user.id, kind, targetId, explanation });
  return { ok: "Submitted. Reviews can take 30–90 days. The action stays in place while we review." };
}
