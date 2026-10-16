"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, prospectDrafts } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { deleteEvidence } from "@/lib/campaign-storage";
import { DRAFT_KEYS, approveDraft, canSeeDraft, cleanFields, draftProblems, type DraftFields } from "@/lib/screenshot-leads";

type FormState = { error?: string; ok?: string };
const s = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);

async function load(f: FormData, userId: string) {
  const d = await db.query.prospectDrafts.findFirst({ where: eq(prospectDrafts.id, s(f, "id", 40)) });
  if (!d || !(await canSeeDraft(userId, d.recruiterId))) return null;
  return d;
}
const fromForm = (f: FormData) => cleanFields(Object.fromEntries(DRAFT_KEYS.map((k) => [k, s(f, k, k === "notes" ? 1500 : k === "prices" ? 500 : 300)])));

/** Save the checked/fixed details (stays in the queue). With approve=1, also approves it into a prospect. */
export async function saveScreenshotDraft(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const d = await load(f, user.id);
  if (!d) return { error: "Not found." };
  if (d.status !== "review") return { error: "This draft was already handled." };
  const fields: DraftFields = await fromForm(f);
  await db.update(prospectDrafts).set({ fields, updatedAt: new Date() }).where(and(eq(prospectDrafts.id, d.id), eq(prospectDrafts.status, "review")));
  revalidatePath("/admin/outreach/screenshots", "layout");
  if (f.get("approve") !== "1") {
    const missing = draftProblems(fields);
    return { ok: missing.length ? `Saved. Still needed before approving: ${missing.join(", ")}.` : "Saved — everything required is filled in. Approve it when you've checked it." };
  }
  const r = await approveDraft(d.id, user.id);
  if ("error" in r) return { error: r.error };
  redirect(`/admin/outreach/prospects/${r.prospectId}`);
}

/** Not a lead after all: the draft and its screenshots are removed. */
export async function discardScreenshotDraft(f: FormData) {
  const { user } = await requireAdmin();
  const d = await load(f, user.id);
  if (!d || d.status !== "review") return;
  for (const im of d.images as { url: string }[]) await deleteEvidence(im.url);
  await db.update(prospectDrafts).set({ status: "discarded", images: [], decidedBy: user.id, decidedAt: new Date(), updatedAt: new Date() }).where(eq(prospectDrafts.id, d.id));
  revalidatePath("/admin/outreach/screenshots", "layout");
  redirect("/admin/outreach/screenshots");
}
