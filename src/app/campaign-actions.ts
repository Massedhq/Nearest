"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, notInArray, sql } from "drizzle-orm";
import { db, campaignEntries, campaignWaitlist } from "@/db";
import { requireStudent } from "@/lib/student";
import type { FormState } from "@/components/ActionForm";
import { CAMPAIGN_KEY, campaignEligibility, entryFor, getCampaign, parseProfileUrl, recordEvent } from "@/lib/campaign";
import { chicagoToUtc } from "@/lib/time";

/** Join the launch campaign: eligibility is checked on the server from real records, then a place is reserved atomically. */
export async function joinCampaign(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requireStudent();
  const c = await getCampaign();
  if (await entryFor(user.id)) redirect("/campaign");
  if (c.status !== "open") return { error: c.status === "paused" ? "The campaign is paused right now." : "The campaign isn't open for new students." };
  const el = await campaignEligibility(user, profile, c);
  if (el.state !== "eligible") return { error: el.message };
  if (form.get("agree") !== "on" || String(form.get("termsVersion") ?? "") !== (c.termsVersion ?? "")) return { error: "Read and agree to the campaign terms to join." };
  const res = await reservePlaceAndNotify(user.id, el, c.termsVersion);
  if ("full" in res) { revalidatePath("/campaign"); return { error: "The campaign just filled up. You can join the waitlist." }; }
  redirect("/campaign?joined=1");
}

async function reservePlaceAndNotify(userId: string, el: { cityId: number | null; countyId: number | null }, termsVersion: string | null) {
  const { reservePlace } = await import("@/lib/campaign");
  const res = await reservePlace(userId, el, { termsVersion });
  if ("id" in res) {
    const { notifyOnce } = await import("@/lib/campaign-notify");
    await notifyOnce(`enrolled:${res.id}`, userId, {
      title: "Your launch campaign place is reserved",
      body: "Download the Nearest picture, set it as your profile picture, then submit your profile link and starting screenshot.",
      href: "/campaign",
      email: { subject: "Your Nearest launch campaign place is reserved", heading: "Your place is reserved.", lines: ["Download the Nearest picture from your campaign page and set it as your Instagram, Facebook or TikTok profile picture.", "Your seven days start when Nearest accepts your profile link and starting screenshot — not before."], button: "Open my campaign" },
    });
  }
  return res;
}

export async function joinCampaignWaitlist() {
  const { user, profile } = await requireStudent();
  const c = await getCampaign();
  const el = await campaignEligibility(user, profile, c);
  if (el.state !== "eligible" || (await entryFor(user.id))) redirect("/campaign");
  await db.insert(campaignWaitlist).values({ campaignKey: CAMPAIGN_KEY, studentId: user.id }).onConflictDoNothing();
  revalidatePath("/campaign");
  redirect("/campaign");
}

export async function leaveCampaignWaitlist() {
  const { user } = await requireStudent();
  await db.update(campaignWaitlist).set({ status: "removed" }).where(and(eq(campaignWaitlist.campaignKey, CAMPAIGN_KEY), eq(campaignWaitlist.studentId, user.id), eq(campaignWaitlist.status, "waiting")));
  revalidatePath("/campaign");
  redirect("/campaign");
}

/** The social account can't be swapped during an active campaign without review — the student asks, an admin decides. */
export async function requestProfileChange(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireStudent();
  const e = await entryFor(user.id);
  if (!e?.startedAt || !["in_progress", "ready_for_review", "needs_correction"].includes(e.status)) return { error: "Link changes aren't available right now." };
  const link = parseProfileUrl(String(form.get("profileUrl") ?? ""));
  if ("error" in link) return { error: link.error };
  if (link.norm === e.profileUrlNorm) return { error: "That's the link already on your campaign." };
  const reason = String(form.get("reason") ?? "").trim().slice(0, 500);
  if (!reason) return { error: "Tell Nearest why the link needs to change (for example, a typo)." };
  const taken = await db.select({ id: campaignEntries.id }).from(campaignEntries)
    .where(and(eq(campaignEntries.profileUrlNorm, link.norm), ne(campaignEntries.id, e.id), notInArray(campaignEntries.status, ["cancelled", "rejected"]))).limit(1);
  if (taken.length) return { error: "That social profile is already part of the campaign." };
  await db.update(campaignEntries).set({ pendingProfileUrl: link.url, pendingProfileReason: reason, pendingProfileAt: new Date(), version: sql`${campaignEntries.version} + 1` }).where(eq(campaignEntries.id, e.id));
  await recordEvent(e.id, user.id, "link_change_requested", `${link.url} — ${reason}`);
  try {
    const { notifyAdmins } = await import("@/lib/outreach");
    await notifyAdmins({ kind: "campaign", title: "Campaign link change to review", body: `A participant asked to change their profile link: ${reason.slice(0, 120)}`, href: `/admin/campaign/${e.id}` });
  } catch (err) { console.error(err); }
  revalidatePath("/campaign");
  return { ok: "Sent. Nearest will review the change — keep uploading with your current account until then." };
}

/** After a correction request: the student says it's fixed (with an optional note). The clock is never reset. */
export async function markCorrectionDone(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireStudent();
  const e = await entryFor(user.id);
  if (!e || e.status !== "needs_correction") return { error: "There's no correction waiting." };
  const note = String(form.get("note") ?? "").trim().slice(0, 500);
  const [row] = await db.update(campaignEntries).set({
    status: sql`case when ${campaignEntries.completesAt} <= now() then 'ready_for_review' else 'in_progress' end`,
    version: sql`${campaignEntries.version} + 1`,
  }).where(and(eq(campaignEntries.id, e.id), eq(campaignEntries.status, "needs_correction"))).returning();
  if (!row) return { error: "There's no correction waiting." };
  await recordEvent(e.id, user.id, "correction_done", note || "Student marked the correction as done.");
  revalidatePath("/campaign");
  return { ok: "Thanks — Nearest will take another look." };
}

/** Book the free-service reward (only once approved, booking open, an appointment available, and unused). */
export async function bookCampaignReward(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireStudent();
  const offerId = String(form.get("offerId") ?? "");
  const day = String(form.get("day") ?? ""), time = String(form.get("time") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Pick a day and time." };
  if (form.get("agree") !== "on") return { error: "Please agree to the reward booking terms." };
  const { campaignOffers, proServices } = await import("@/db");
  const offer = await db.query.campaignOffers.findFirst({ where: eq(campaignOffers.id, offerId) });
  const svc = offer ? await db.query.proServices.findFirst({ where: eq(proServices.id, offer.serviceId) }) : null;
  if (!offer || !svc) return { error: "That appointment option isn't available." };
  const { openSlots } = await import("@/lib/availability");
  if (!(await openSlots(offer.proId, svc.durationMin, day)).includes(time)) return { error: "That time was just taken or isn't available. Pick another." };
  const { bookReward } = await import("@/lib/campaign-reward");
  const r = await bookReward(user.id, offerId, chicagoToUtc(day, time));
  if ("error" in r) return { error: r.error };
  redirect(`/bookings/${r.bookingId}?requested=1`);
}
