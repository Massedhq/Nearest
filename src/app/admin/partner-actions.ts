"use server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, partnerApplications, partnerPages, users } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { sendEmail } from "@/lib/email";
import { inbox } from "@/lib/inbox";
import { partnerSetupDemoLink } from "@/lib/partners";
import { SITE_URL } from "@/lib/public/site";

type FormState = { error?: string; ok?: string; link?: string };
const UUID = /^[0-9a-f-]{36}$/;

/** Owner: approve or decline a Nearest Partner application (approve also opens the page for a matching pro account). */
export async function decidePartnerApplication(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const id = String(form.get("id") ?? "");
  const to = String(form.get("to") ?? "");
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
  if (!UUID.test(id) || !["approved", "declined", "new"].includes(to)) return { error: "Not found." };
  const before = await db.query.partnerApplications.findFirst({ where: eq(partnerApplications.id, id) });
  if (!before) return { error: "Not found." };
  await db.update(partnerApplications).set({ status: to, note, decidedAt: to === "new" ? null : new Date(), decidedBy: to === "new" ? null : user.id }).where(eq(partnerApplications.id, id));

  let pro: { id: string; accountType: string } | undefined;
  if (to === "approved") {
    pro = (await db.select({ id: users.id, accountType: users.accountType }).from(users).where(sql`lower(${users.email}) = ${before.email}`).limit(1))[0];
    if (pro?.accountType === "professional") {
      await db.insert(partnerPages).values({ userId: pro.id, applicationId: id }).onConflictDoNothing();
      await inbox(pro.id, { kind: "partner", title: "You're a Nearest Partner", body: "Your partner page is ready. Open Business → Partner page to add your links and videos and turn it on.", href: "/pro/partner" }).catch(() => {});
    }
    const hasPro = pro?.accountType === "professional";
    sendEmail({
      to: before.email, subject: "You're approved as a Nearest Partner", eyebrow: "Nearest Partner", heading: `Welcome, ${before.name.split(" ")[0]}.`,
      lines: hasPro
        ? ["Your partner page is ready. Sign in to the Nearest pro app and open Business → Partner page to add your links, videos and top services, then turn on Page is live.", `Step-by-step: ${partnerSetupDemoLink()}`]
        : [`Create your Nearest professional account with this same email (${before.email}), set up your profile, then open Business → Partner page.`, `Step-by-step: ${partnerSetupDemoLink()}`],
      button: hasPro ? { label: "Open my partner page", url: `${SITE_URL}/pro/partner` } : { label: "Create my account", url: `${SITE_URL}/pro/sign-up` },
    }).catch(() => {});
  } else if (to === "declined") {
    sendEmail({
      to: before.email, subject: "Your Nearest Partner application", eyebrow: "Nearest Partner", heading: `Thanks for applying, ${before.name.split(" ")[0]}.`,
      lines: ["We're not able to approve your partner application right now.", ...(note ? [note] : [])],
    }).catch(() => {});
  }
  await logActivity({ actorUserId: user.id, action: `partner.application_${to}`, targetType: "partner_application", targetId: id, before: { status: before.status }, after: { status: to, note, proUserId: pro?.id ?? null } });
  revalidatePath("/admin/partners");
  return { ok: to === "approved" ? (pro?.accountType === "professional" ? "Approved — their partner page is open in their pro app." : "Approved — they'll get it once they create a pro account with this email.") : to === "declined" ? "Declined — they were emailed." : "Moved back to New." };
}

/** Owner: pause or resume a partner page (paused pages are hidden from the public). */
export async function setPartnerPagePaused(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const id = String(form.get("userId") ?? "");
  const pause = form.get("pause") === "1";
  if (!UUID.test(id)) return { error: "Not found." };
  const before = await db.query.partnerPages.findFirst({ where: eq(partnerPages.userId, id) });
  if (!before) return { error: "Not found." };
  await db.update(partnerPages).set(pause ? { pausedAt: new Date(), pausedBy: user.id } : { pausedAt: null, pausedBy: null }).where(and(eq(partnerPages.userId, id)));
  await logActivity({ actorUserId: user.id, action: pause ? "partner.page_paused" : "partner.page_resumed", targetType: "partner_page", targetId: id, before: { pausedAt: before.pausedAt }, after: { paused: pause } });
  revalidatePath("/admin/partners");
  return { ok: pause ? "Paused — the page is hidden." : "Resumed." };
}

/** Owner: refund a partner shop order that hasn't been paid out to the seller yet. */
export async function refundPartnerOrder(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return { error: "Not found." };
  const { refundShopOrder } = await import("@/lib/shop");
  try {
    const r = await refundShopOrder(id, user.id);
    if ("error" in r) return { error: r.error };
    await logActivity({ actorUserId: user.id, action: "partner.order_refunded", targetType: "partner_order", targetId: id, before: { status: r.before }, after: { status: "refunded" } });
  } catch (e) {
    console.error("Shop refund failed", id, e);
    return { error: "The refund didn't go through. Try again, or refund it in Stripe." };
  }
  revalidatePath("/admin/partners");
  return { ok: "Refunded — the buyer was emailed." };
}

/** Add a partner → "They'll set it up themselves": leave builder mode and email their setup link. */
export async function partnerSetupHandoff(userId: string): Promise<{ ok: true } | { error: string }> {
  const { user } = await requireAdmin({ owner: true });
  if (!UUID.test(userId)) return { error: "Not found." };
  const { cookies } = await import("next/headers");
  const { BUILD_COOKIE } = await import("@/lib/build-mode");
  (await cookies()).delete(BUILD_COOKIE);
  const { sendPartnerHandoff } = await import("@/lib/partner-handoff");
  const r = await sendPartnerHandoff({ userId, mode: "setup", byUserId: user.id });
  revalidatePath("/admin/partners");
  return "error" in r ? { error: r.error } : { ok: true };
}

/** Owner: email one of the three links to a partner they added (setup / finish / approve). */
export async function sendPartnerLink(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const id = String(form.get("userId") ?? "");
  const mode = String(form.get("mode") ?? "");
  const { isHandoffMode, sendPartnerHandoff } = await import("@/lib/partner-handoff");
  if (!UUID.test(id) || !isHandoffMode(mode)) return { error: "Not found." };
  const copy = form.get("via") === "copy";
  const r = await sendPartnerHandoff({ userId: id, mode, byUserId: user.id, email: !copy });
  if ("error" in r) return { error: r.error };
  revalidatePath("/admin/partners");
  const { CLAIM_DAYS } = await import("@/lib/build-mode");
  const lasts = `It works once and lasts ${CLAIM_DAYS} days; any earlier link stopped working.`;
  return { link: r.link, ok: copy ? `Here's their link — copy it and send it to them by text or DM. ${lasts}` : r.emailed ? `Emailed to ${r.email}. You can also copy it and text or DM it. ${lasts}` : `The email didn't go out — copy the link and send it yourself. ${lasts}` };
}

/**
 * Owner: switch an existing professional (for example a free Ambassador account) to a Nearest Partner. Their account,
 * profile, bookings and free status stay as they are; a published partner page is added and they're told.
 */
export async function switchToPartner(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const id = String(form.get("userId") ?? "");
  if (!UUID.test(id)) return { error: "Not found." };
  const { professionalProfiles, cities } = await import("@/db");
  const r = (await db.select({ u: users, p: professionalProfiles }).from(professionalProfiles).innerJoin(users, eq(users.id, professionalProfiles.userId)).where(eq(professionalProfiles.userId, id)).limit(1))[0];
  if (!r || r.u.accountType !== "professional") return { error: "Not found." };
  if (await db.query.partnerPages.findFirst({ where: eq(partnerPages.userId, id) })) return { error: "They're already a Nearest Partner." };
  const email = (r.u.email ?? "").trim().toLowerCase();
  const city = r.p.cityId ? await db.query.cities.findFirst({ where: eq(cities.id, r.p.cityId) }) : null;
  const [app] = await db.insert(partnerApplications).values({ name: `${r.u.firstName ?? ""} ${r.u.lastName ?? ""}`.trim() || email, email, city: city?.name ?? null, state: city?.state ?? null, specialty: null, about: `Switched by Nearest from an existing account (${r.p.entryType ?? "professional"})`, status: "approved", decidedAt: new Date(), decidedBy: user.id }).returning();
  await db.insert(partnerPages).values({ userId: id, applicationId: app.id, approvedAt: new Date(), published: true, addedBy: user.id, partnerApprovedAt: new Date() }).onConflictDoNothing();
  await inbox(id, { kind: "partner", title: "You're a Nearest Partner", body: "Your account is now a Nearest Partner account. Open Business → Partner page to add your links, videos and shop — your link to share is at the top.", href: "/pro/partner" }).catch(() => {});
  if (email) sendEmail({
    to: email, subject: "You're a Nearest Partner", eyebrow: "Nearest Partner", heading: `Welcome, ${r.u.firstName ?? "there"}.`,
    lines: ["Your Nearest account is now a Nearest Partner account. Everything you already set up stays the same.", "Sign in and open Business → Partner page to add your links, videos and shop. Your link to share is at the top."],
    button: { label: "Open my partner page", url: `${SITE_URL}/pro/partner` },
  }).catch(() => {});
  await logActivity({ actorUserId: user.id, action: "partner.switched_existing", targetType: "partner_page", targetId: id, before: { partner: false, entryType: r.p.entryType }, after: { partner: true, entryType: r.p.entryType } });
  revalidatePath("/admin/partners");
  revalidatePath(`/admin/professionals/${id}`);
  return { ok: "Done — they're a Nearest Partner now and were told by email and in the app. Find them under Partner pages → Partners you added." };
}
