"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, learnClasses } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { LEARN_LIMITS, ownLearnUrl, publishProblems } from "@/lib/learn";

type FormState = { error?: string; ok?: string };
const s = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);

async function owner() {
  try { return (await requireAdmin({ owner: true })).user; } catch { return null; }
}

function cleanLink(v: string) {
  if (!v) return null;
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try { const u = new URL(withProto); return u.protocol === "https:" || u.protocol === "http:" ? u.toString().slice(0, 300) : null; } catch { return null; }
}

/** Owners: add a class or save changes (title, educator credit, cover, video, license confirmation). */
export async function saveLearnClass(_: FormState, form: FormData): Promise<FormState> {
  const user = await owner();
  if (!user) return { error: "Only an owner can add classes." };
  const id = s(form, "id", 40);
  const title = s(form, "title", 120), educatorName = s(form, "educator", 80), category = s(form, "category", 60) || null;
  const description = s(form, "description", 2000) || null;
  const educatorLink = cleanLink(s(form, "educatorLink", 300));
  if (s(form, "educatorLink", 300) && !educatorLink) return { error: "That educator link doesn't look right. Paste the full link, like instagram.com/theirname." };
  if (!title) return { error: "Add a title." };
  if (!educatorName) return { error: "Add the educator's name so they get credit." };
  const priceRaw = s(form, "price", 12).replace(/[$,\s]/g, "");
  const priceCents = priceRaw ? Math.round(Number(priceRaw) * 100) : null;
  if (priceRaw && (!Number.isFinite(priceCents) || priceCents! < LEARN_LIMITS.minPriceCents || priceCents! > LEARN_LIMITS.maxPriceCents)) return { error: "Set a price between $1 and $1,000." };
  const coverUrl = s(form, "cover", 600), videoUrl = s(form, "video", 600);
  if (coverUrl && !ownLearnUrl(coverUrl, user.id, "cover")) return { error: "Upload the cover again — that file isn't one of your uploads." };
  if (videoUrl && !ownLearnUrl(videoUrl, user.id, "video")) return { error: "Upload the video again — that file isn't one of your uploads." };
  const licensed = form.get("license") === "on";

  const before = id ? await db.query.learnClasses.findFirst({ where: eq(learnClasses.id, id) }) : null;
  if (id && !before) return { error: "That class no longer exists." };
  const values = {
    title, educatorName, educatorLink, category, description, priceCents,
    ...(coverUrl && coverUrl !== before?.coverUrl ? { coverUrl, coverAccess: s(form, "cover_access", 10) === "public" ? "public" : "private" } : {}),
    ...(videoUrl && videoUrl !== before?.videoUrl ? { videoUrl, videoAccess: s(form, "video_access", 10) === "public" ? "public" : "private", videoName: s(form, "video_name", 160) || null, videoSize: Number(s(form, "video_size", 20)) || null } : {}),
    licenseConfirmedAt: licensed ? (before?.licenseConfirmedAt ?? new Date()) : null,
    updatedAt: new Date(),
  };
  if (before) {
    // Taking away the license confirmation hides a class that was showing.
    const status = !licensed && before.status === "published" ? "hidden" : before.status;
    await db.update(learnClasses).set({ ...values, status }).where(eq(learnClasses.id, before.id));
    await logActivity({ actorUserId: user.id, action: "learn.class_saved", targetType: "learn_class", targetId: before.id, before: { title: before.title, educator: before.educatorName, priceCents: before.priceCents, status: before.status, licensed: Boolean(before.licenseConfirmedAt) }, after: { title, educator: educatorName, priceCents, status, licensed } });
    revalidatePath("/admin/learn"); revalidatePath(`/admin/learn/${before.id}`); revalidatePath("/pro/learn");
    return { ok: "Saved." };
  }
  const [row] = await db.insert(learnClasses).values({ ...values, createdBy: user.id }).returning();
  await logActivity({ actorUserId: user.id, action: "learn.class_added", targetType: "learn_class", targetId: row.id, after: { title, educator: educatorName, priceCents, licensed } });
  revalidatePath("/admin/learn");
  redirect(`/admin/learn/${row.id}?added=1`);
}

/** Owners: show a class to professionals (as Coming soon), hide it, or put it back to draft. */
export async function setLearnStatus(form: FormData) {
  const user = await owner();
  if (!user) return;
  const id = s(form, "id", 40), to = s(form, "to", 12);
  if (!["published", "hidden", "draft"].includes(to)) return;
  const c = await db.query.learnClasses.findFirst({ where: eq(learnClasses.id, id) });
  if (!c) return;
  if (to === "published" && publishProblems(c).length) redirect(`/admin/learn/${id}?blocked=1`);
  await db.update(learnClasses).set({ status: to, updatedAt: new Date() }).where(eq(learnClasses.id, id));
  await logActivity({ actorUserId: user.id, action: "learn.class_status", targetType: "learn_class", targetId: id, before: { status: c.status }, after: { status: to } });
  revalidatePath("/admin/learn"); revalidatePath(`/admin/learn/${id}`); revalidatePath("/pro/learn");
}

/** Owners: delete a class and its files. */
export async function deleteLearnClass(form: FormData) {
  const user = await owner();
  if (!user) return;
  const id = s(form, "id", 40);
  const c = await db.query.learnClasses.findFirst({ where: eq(learnClasses.id, id) });
  if (!c) redirect("/admin/learn");
  const { deleteEvidence } = await import("@/lib/campaign-storage");
  if (c.videoUrl) await deleteEvidence(c.videoUrl);
  if (c.coverUrl) await deleteEvidence(c.coverUrl);
  await db.delete(learnClasses).where(eq(learnClasses.id, id));
  await logActivity({ actorUserId: user.id, action: "learn.class_deleted", targetType: "learn_class", targetId: id, before: { title: c.title, educator: c.educatorName, status: c.status } });
  revalidatePath("/admin/learn"); revalidatePath("/pro/learn");
  redirect("/admin/learn");
}
