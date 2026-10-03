"use server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, proTransfers, professionalProfiles, proServices, proWaitlist, users, cities, categories } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { sendTransferEmail, sendSpotOpenedEmail } from "@/lib/email";

type FormState = { error?: string; ok?: string };
const base = () => process.env.APP_URL || "https://www.usenearest.com";

/** Approve or deny a professional's transfer to a full city. Approving applies their new location and frees their old spot. */
export async function decideTransfer(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const approve = form.get("decision") === "approve";
  const reason = String(form.get("reason") ?? "").trim().slice(0, 300) || null;
  if (!approve && !reason) return { error: "Add a short reason so they know why." };
  const t = await db.query.proTransfers.findFirst({ where: eq(proTransfers.id, id) });
  if (!t || t.status !== "pending") return { error: "This request was already handled." };
  const [pro, u, toCity, fromCity] = await Promise.all([
    db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, t.userId) }),
    db.query.users.findFirst({ where: eq(users.id, t.userId) }),
    db.query.cities.findFirst({ where: eq(cities.id, t.toCityId) }),
    t.fromCityId ? db.query.cities.findFirst({ where: eq(cities.id, t.fromCityId) }) : null,
  ]);
  if (!pro || !u) return { error: "Professional not found." };
  const { inbox } = await import("@/lib/inbox");

  if (approve) {
    const p = t.payload as Record<string, unknown>;
    await db.update(professionalProfiles).set({ ...p, ...(pro.slotCityId ? { slotCityId: t.toCityId } : {}) } as Partial<typeof professionalProfiles.$inferInsert>).where(eq(professionalProfiles.userId, t.userId));
    await db.update(proTransfers).set({ status: "approved", decidedBy: user.id, decidedAt: new Date() }).where(eq(proTransfers.id, t.id));
    await inbox(t.userId, { kind: "transfer", title: `You're now listed in ${toCity?.name ?? "your new city"}`, body: "Your transfer was approved. Your membership and rate stay the same.", href: "/pro/home" });
    if (u.email) await sendTransferEmail({ to: u.email, first: u.firstName ?? "Hi", approved: true, toCity: toCity?.name ?? "your new city", link: `${base()}/pro/home` });
    // Their old spot opened: tell everyone waiting for it.
    let told = 0;
    if (t.fromCityId) {
      const cats = [...new Set([...(await db.select({ c: proServices.categoryId }).from(proServices).where(and(eq(proServices.userId, t.userId), eq(proServices.active, true)))).map((r) => r.c), ...(pro.slotCategoryId ? [pro.slotCategoryId] : [])])];
      if (cats.length) {
        const waiting = await db.select({ w: proWaitlist, u: users, cat: categories.name }).from(proWaitlist)
          .innerJoin(users, eq(users.id, proWaitlist.userId)).innerJoin(categories, eq(categories.id, proWaitlist.categoryId))
          .where(and(eq(proWaitlist.cityId, t.fromCityId), inArray(proWaitlist.categoryId, cats)));
        for (const w of waiting) {
          await inbox(w.u.id, { kind: "spot_opened", title: `A ${w.cat} spot opened in ${fromCity?.name ?? "your city"}`, body: "Spots go to whoever claims them first.", href: "/pro/join" });
          if (w.u.email) await sendSpotOpenedEmail({ to: w.u.email, first: w.u.firstName ?? "Hi", city: fromCity?.name ?? "your city", category: w.cat, link: `${base()}/pro/join` });
          told++;
        }
      }
    }
    await logActivity({ actorUserId: user.id, action: "pro.transfer_approved", targetType: "professional", targetId: t.userId, after: { from: t.fromCityId, to: t.toCityId, waitlistNotified: told } });
    revalidatePath("/admin/professionals");
    return { ok: `Approved — ${u.firstName ?? "they"} now listed in ${toCity?.name}. ${told} waiting professional${told === 1 ? "" : "s"} in ${fromCity?.name ?? "the old city"} notified.` };
  }

  await db.update(proTransfers).set({ status: "denied", decisionNote: reason, decidedBy: user.id, decidedAt: new Date() }).where(eq(proTransfers.id, t.id));
  await inbox(t.userId, { kind: "transfer", title: `Transfer to ${toCity?.name ?? "your new city"} wasn't approved`, body: reason!, href: "/pro/setup/location?edit=1" });
  if (u.email) await sendTransferEmail({ to: u.email, first: u.firstName ?? "Hi", approved: false, toCity: toCity?.name ?? "your new city", reason, link: `${base()}/pro/setup/location?edit=1` });
  await logActivity({ actorUserId: user.id, action: "pro.transfer_denied", targetType: "professional", targetId: t.userId, after: reason });
  revalidatePath("/admin/professionals");
  return { ok: "Denied — they were notified with your reason." };
}
