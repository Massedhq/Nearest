"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db, bundles, bundleItems, categories, proServices } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { BUNDLE_DAYS, BUNDLE_KEEP_DAYS, loadBundle } from "@/lib/bundles";
import { chicagoNow } from "@/lib/time";
import { MAX_PRICE_CENTS } from "@/lib/pricing";

type FormState = { error?: string; ok?: string };

/** Step 1 + 2: categories, budget and the week → a new bundle. */
export async function createBundle(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireVerifiedStudent();
  const catIds = [...new Set(form.getAll("cat").map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))];
  if (catIds.length < 2) return { error: "Choose at least two things you need." };
  if (catIds.length > 6) return { error: "Choose up to six." };
  const valid = await db.select({ id: categories.id }).from(categories).where(and(inArray(categories.id, catIds), eq(categories.active, true), ne(categories.name, "Other")));
  if (valid.length !== catIds.length) return { error: "Choose from the list." };
  const budget = Math.round(Number(String(form.get("budget") ?? "").replace(/[^0-9.]/g, "")) * 100);
  if (!Number.isFinite(budget) || budget < 2000) return { error: "Enter a budget of at least $20." };
  if (budget > catIds.length * MAX_PRICE_CENTS) return { error: `Your budget can be up to $${(catIds.length * MAX_PRICE_CENTS) / 100} for ${catIds.length} services.` };
  const start = String(form.get("start") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return { error: "Choose the week you need it done." };
  const today = new Date(`${chicagoNow().date}T12:00:00Z`).getTime();
  const s = new Date(`${start}T12:00:00Z`).getTime();
  if (s < today + 86400000) return { error: "Choose a week starting tomorrow or later." };
  if (s > today + 60 * 86400000) return { error: "Choose a week within the next 60 days." };
  const end = new Date(s + (BUNDLE_DAYS - 1) * 86400000).toISOString().slice(0, 10);
  const [b] = await db.insert(bundles).values({
    studentId: user.id, categoryIds: catIds, budgetCents: budget, startDate: start, endDate: end,
    expiresAt: new Date(Date.now() + BUNDLE_KEEP_DAYS * 86400000),
  }).returning();
  redirect(`/bundle/${b.id}`);
}

/** Save a professional to the bundle for a category (replaces anyone saved there before). */
export async function saveBundlePro(form: FormData) {
  const { user } = await requireVerifiedStudent();
  const loaded = await loadBundle(String(form.get("bundleId") ?? ""), user.id);
  if (!loaded || !["building", "ready"].includes(loaded.bundle.status)) redirect("/bundle");
  const svc = await db.query.proServices.findFirst({ where: and(eq(proServices.id, String(form.get("serviceId") ?? "")), eq(proServices.active, true)) });
  const catId = Number(form.get("categoryId"));
  if (!svc || svc.categoryId !== catId || !loaded.bundle.categoryIds.includes(catId)) redirect(`/bundle/${loaded.bundle.id}`);
  await db.insert(bundleItems).values({ bundleId: loaded.bundle.id, categoryId: catId, proId: svc.userId, serviceId: svc.id, priceCents: svc.priceCents })
    .onConflictDoUpdate({ target: [bundleItems.bundleId, bundleItems.categoryId], set: { proId: svc.userId, serviceId: svc.id, priceCents: svc.priceCents, bookingId: null, savedAt: new Date() } });
  const count = (await db.select({ id: bundleItems.id }).from(bundleItems).where(eq(bundleItems.bundleId, loaded.bundle.id))).length;
  await db.update(bundles).set({ status: count >= loaded.bundle.categoryIds.length ? "ready" : "building" }).where(eq(bundles.id, loaded.bundle.id));
  revalidatePath(`/bundle/${loaded.bundle.id}`);
  redirect(`/bundle/${loaded.bundle.id}`);
}

/** Remove the professional saved for a category. */
export async function removeBundlePro(form: FormData) {
  const { user } = await requireVerifiedStudent();
  const loaded = await loadBundle(String(form.get("bundleId") ?? ""), user.id);
  if (!loaded) redirect("/bundle");
  const catId = Number(form.get("categoryId"));
  await db.delete(bundleItems).where(and(eq(bundleItems.bundleId, loaded.bundle.id), eq(bundleItems.categoryId, catId)));
  if (loaded.bundle.status === "ready") await db.update(bundles).set({ status: "building" }).where(eq(bundles.id, loaded.bundle.id));
  revalidatePath(`/bundle/${loaded.bundle.id}`);
  redirect(`/bundle/${loaded.bundle.id}?cat=${catId}`);
}

export async function deleteBundle(form: FormData) {
  const { user } = await requireVerifiedStudent();
  const loaded = await loadBundle(String(form.get("bundleId") ?? ""), user.id);
  if (loaded && loaded.bundle.status !== "booked") {
    await db.delete(bundleItems).where(eq(bundleItems.bundleId, loaded.bundle.id));
    await db.update(bundles).set({ status: "expired" }).where(eq(bundles.id, loaded.bundle.id));
  }
  redirect("/bundle");
}
