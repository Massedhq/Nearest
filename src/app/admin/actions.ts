"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, invitations, cities, platformSettings } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { getSettings } from "@/lib/settings";
import { SETTINGS, STATUS_KEYS } from "@/lib/settings-defaults";
import { foundingOpen } from "@/lib/invites";

export type FormState = { error?: string; ok?: string };

async function writeSetting(key: string, value: number | string | boolean, actorId: string, before: unknown) {
  await db
    .insert(platformSettings)
    .values({ key, value, updatedBy: actorId })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedBy: actorId, updatedAt: new Date() } });
  await logActivity({ actorUserId: actorId, action: "setting.changed", targetType: "setting", targetId: key, before, after: value });
}

export async function toggleStatus(form: FormData) {
  const { user } = await requireAdmin({ owner: true });
  const key = String(form.get("key"));
  if (!(STATUS_KEYS as readonly string[]).includes(key)) return;
  const s = await getSettings();
  const before = s[key] === true;
  await writeSetting(key, !before, user.id, before);
  revalidatePath("/admin", "layout");
}

export async function saveSettings(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const current = await getSettings();
  let changed = 0;
  for (const [key, def] of Object.entries(SETTINGS)) {
    if (def.type === "bool") continue;
    const raw = form.get(key);
    if (raw === null) continue;
    let value: number | string;
    if (def.type === "time") {
      value = String(raw);
      if (!/^\d{2}:\d{2}$/.test(value)) return { error: `${def.label}: use a time like 12:00.` };
    } else if (def.type === "cents") {
      const dollars = Number(String(raw).replace(/[$,]/g, ""));
      if (!Number.isFinite(dollars) || dollars < 0) return { error: `${def.label}: enter a dollar amount.` };
      value = Math.round(dollars * 100);
    } else {
      value = Number(raw);
      if (!Number.isInteger(value) || value < 0) return { error: `${def.label}: enter a whole number.` };
    }
    if (current[key] !== value) {
      await writeSetting(key, value, user.id, current[key]);
      changed++;
    }
  }
  revalidatePath("/admin", "layout");
  return { ok: changed ? `Saved ${changed} change${changed === 1 ? "" : "s"}.` : "Nothing changed." };
}

export async function createInvite(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  const contact = String(form.get("contact") ?? "").trim();
  const cityId = Number(form.get("cityId"));
  const category = String(form.get("category") ?? "").trim();
  if (!name || !contact || !cityId || !category) return { error: "Fill in name, contact, city and category." };

  const f = await foundingOpen();
  if (!f.open) return { error: "Founding registration is closed." };

  const city = await db.query.cities.findFirst({ where: eq(cities.id, cityId) });
  if (!city) return { error: "Pick a city." };
  const s = await getSettings();
  const expiresAt = new Date(Date.now() + Number(s["growth.invite_expiry_days"]) * 86400000);

  for (let attempt = 0; attempt < 5; attempt++) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(invitations);
    const code = `FND-${city.abbreviation}-${String(n + 1 + attempt).padStart(4, "0")}`;
    const [row] = await db
      .insert(invitations)
      .values({ code, name, contact, cityId, category, cohort: "FOUNDING", expiresAt, createdBy: user.id })
      .onConflictDoNothing()
      .returning();
    if (row) {
      await logActivity({ actorUserId: user.id, action: "invite.created", targetType: "invitation", targetId: code, after: { name, contact, city: city.name, category } });
      revalidatePath("/admin/founding");
      redirect(`/admin/founding?new=${encodeURIComponent(code)}`);
    }
  }
  return { error: "Couldn't generate a unique code. Try again." };
}

export async function revokeInvite(form: FormData) {
  const { user } = await requireAdmin();
  const id = String(form.get("id"));
  const [row] = await db
    .update(invitations)
    .set({ status: "revoked" })
    .where(and(eq(invitations.id, id), eq(invitations.status, "invited")))
    .returning();
  if (row) await logActivity({ actorUserId: user.id, action: "invite.revoked", targetType: "invitation", targetId: row.code, before: "invited", after: "revoked" });
  revalidatePath("/admin/founding");
}

export async function closeFounding() {
  const { user } = await requireAdmin({ owner: true });
  const s = await getSettings();
  if (s["status.founding_invitations"] === true) await writeSetting("status.founding_invitations", false, user.id, true);
  revalidatePath("/admin", "layout");
}
