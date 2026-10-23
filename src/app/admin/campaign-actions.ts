"use server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { db, campaigns, campaignEntries, campaignChecks, campaignOffers, campaignWaitlist, proServices, professionalProfiles, studentProfiles, users } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import type { FormState } from "@/components/ActionForm";
import {
  CAMPAIGN_KEY, campaignEligibility, evidenceFor, finalProof, fmtWhen, getCampaign, hasOtherReward, missingEvidence, parseProfileUrl,
  readinessProblems, recordEvent, releasePlace, fillFromWaitlist, bookingOpensLabel,
} from "@/lib/campaign";
import { chicagoToUtc } from "@/lib/time";

const s = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const CHANGED = { error: "This record changed since you opened it (someone else may have acted). Reload the page and try again." };
const refresh = (id?: string) => { revalidatePath("/admin/campaign"); if (id) revalidatePath(`/admin/campaign/${id}`); revalidatePath("/campaign"); };

async function load(f: FormData) {
  const id = s(f, "id", 40);
  const version = Number(f.get("version"));
  const e = await db.query.campaignEntries.findFirst({ where: eq(campaignEntries.id, id) });
  return { e, version };
}

/** "Record profile check": an admin looked at the student's social profile directly. Who + server time are recorded. */
export async function recordProfileCheck(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const id = s(f, "id", 40);
  const e = await db.query.campaignEntries.findFirst({ where: eq(campaignEntries.id, id) });
  if (!e) return { error: "Not found." };
  const v = s(f, "visible", 10);
  if (!["yes", "no", "cant"].includes(v)) return { error: "Choose whether the Nearest picture was visible." };
  const notes = s(f, "notes", 1000) || null;
  await db.insert(campaignChecks).values({ entryId: id, adminId: user.id, pictureVisible: v === "yes" ? true : v === "no" ? false : null, notes });
  await logActivity({ actorUserId: user.id, action: "campaign.profile_check", targetType: "campaign_entry", targetId: id, after: { visible: v, notes } });
  refresh(id);
  return { ok: "Profile check recorded." };
}

export async function requestCorrection(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const { e, version } = await load(f);
  if (!e) return { error: "Not found." };
  const note = s(f, "note", 1000);
  if (!note) return { error: "Tell the student exactly what to correct." };
  const [row] = await db.update(campaignEntries).set({ status: "needs_correction", correctionNote: note, version: sql`${campaignEntries.version} + 1` })
    .where(and(eq(campaignEntries.id, e.id), eq(campaignEntries.version, version), inArray(campaignEntries.status, ["in_progress", "ready_for_review", "needs_correction"]))).returning();
  if (!row) return CHANGED;
  await recordEvent(e.id, user.id, "correction_requested", note);
  await logActivity({ actorUserId: user.id, action: "campaign.correction", targetType: "campaign_entry", targetId: e.id, after: { note } });
  const { notifyOnce } = await import("@/lib/campaign-notify");
  await notifyOnce(`correction:${e.id}:${row.version}`, e.studentId, {
    title: "Nearest asked for a correction", body: note, href: "/campaign",
    email: { subject: "A correction is needed for your Nearest campaign", heading: "Nearest asked for a correction.", lines: [note, "Open your campaign page to fix it. Your seven-day clock isn't reset."], button: "Open my campaign" },
  });
  refresh(e.id);
  return { ok: "Correction requested — the student was notified." };
}

/**
 * Approve: only after the full 168 hours, with a final screenshot taken at/after 168 hours, the student still eligible,
 * no other reward, missing daily windows explicitly acknowledged, and the record unchanged since the admin opened it.
 */
export async function approveEntry(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const { e, version } = await load(f);
  if (!e) return { error: "Not found." };
  if (e.version !== version) return CHANGED;
  if (!e.completesAt || Date.now() < e.completesAt.getTime()) return { error: `The full 168 hours haven't passed. They complete ${e.completesAt ? fmtWhen(e.completesAt) : "after the student starts"}.` };
  const evidence = await evidenceFor(e.id);
  if (finalProof(e, evidence).state !== "submitted") return { error: "The final screenshot (taken at or after 168 hours) is missing. Ask the student for it before approving." };
  const missing = missingEvidence(e, evidence);
  if (missing.length && f.get("ackMissing") !== "on") return { error: `Missing evidence: ${missing.join(", ")}. Tick "I reviewed the missing evidence" to approve anyway.` };
  const u = await db.query.users.findFirst({ where: eq(users.id, e.studentId) });
  const p = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, e.studentId) });
  const el = u ? await campaignEligibility(u, p, await getCampaign()) : null;
  if (!el || el.state !== "eligible") return { error: `The student isn't currently eligible: ${el && "message" in el ? el.message : "account not found"}` };
  if (await hasOtherReward(e.studentId, e.id)) return { error: "This student already has a campaign reward. Only one reward per student." };
  const note = s(f, "note", 1000) || null;
  const [row] = await db.update(campaignEntries).set({ status: "approved", approvedAt: new Date(), decidedBy: user.id, decisionNote: note, version: sql`${campaignEntries.version} + 1` })
    .where(and(eq(campaignEntries.id, e.id), eq(campaignEntries.version, version), inArray(campaignEntries.status, ["in_progress", "ready_for_review", "needs_correction"]), sql`${campaignEntries.completesAt} <= now()`)).returning();
  if (!row) return CHANGED;
  await recordEvent(e.id, user.id, "approved", [missing.length ? `Approved with missing evidence acknowledged: ${missing.join(", ")}` : "Approved", note].filter(Boolean).join(" — "));
  await logActivity({ actorUserId: user.id, action: "campaign.approved", targetType: "campaign_entry", targetId: e.id, before: e.status, after: { status: "approved", missing } });
  // The reward: Nearest credit, added to the student's account once (usable with any professional).
  const { issueRewardCredit, creditLabel, rewardCreditCents } = await import("@/lib/campaign");
  const added = await issueRewardCredit(e.id);
  const credit = creditLabel(added ?? (await rewardCreditCents()));
  const { notifyOnce } = await import("@/lib/campaign-notify");
  await notifyOnce(`approved:${e.id}`, e.studentId, {
    title: `You're approved — ${credit} credit added`,
    body: `${credit} in Nearest credit is in your account. Use it toward any service you book with a professional on Nearest.`,
    href: "/credits",
    email: { subject: `You're approved — ${credit} Nearest credit added`, heading: "You're approved.", lines: [`${credit} in Nearest credit was added to your account. It's taken off your total automatically when you pay for any service with any professional on Nearest.`], button: "See my credit" },
  });
  refresh(e.id);
  return { ok: `Approved — ${credit} Nearest credit added. The student was notified.` };
}

async function endEntry(kind: "rejected" | "cancelled", f: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const { e, version } = await load(f);
  if (!e) return { error: "Not found." };
  const reason = s(f, "reason", 1000);
  if (!reason) return { error: kind === "rejected" ? "Give the reason for not approving." : "Give the reason for cancelling." };
  const allowed = kind === "rejected" ? ["in_progress", "ready_for_review", "needs_correction"] : ["reserved", "in_progress", "ready_for_review", "needs_correction"];
  const [row] = await db.update(campaignEntries).set({
    status: kind, decisionNote: reason, decidedBy: user.id, ...(kind === "rejected" ? { rejectedAt: new Date() } : { cancelledAt: new Date() }), version: sql`${campaignEntries.version} + 1`,
  }).where(and(eq(campaignEntries.id, e.id), eq(campaignEntries.version, version), inArray(campaignEntries.status, allowed))).returning();
  if (!row) return CHANGED;
  await recordEvent(e.id, user.id, kind, reason);
  await logActivity({ actorUserId: user.id, action: `campaign.${kind}`, targetType: "campaign_entry", targetId: e.id, before: e.status, after: { status: kind, reason } });
  let released = false;
  if (f.get("release") === "on") {
    released = await releasePlace(e.id);
    if (released) { await recordEvent(e.id, user.id, "place_released", "The unearned place was released."); await fillFromWaitlist(); }
  }
  const { notifyOnce } = await import("@/lib/campaign-notify");
  await notifyOnce(`${kind}:${e.id}`, e.studentId, {
    title: kind === "rejected" ? "Your campaign participation wasn't approved" : "Your campaign entry was cancelled", body: reason, href: "/campaign",
    email: { subject: kind === "rejected" ? "Your Nearest launch campaign review" : "Your Nearest launch campaign entry", heading: kind === "rejected" ? "Your participation wasn't approved." : "Your campaign entry was cancelled.", lines: [reason, "Questions? Reply to support@usenearest.com."], button: "Open my campaign" },
  });
  refresh(e.id);
  return { ok: `${kind === "rejected" ? "Not approved" : "Cancelled"}${released ? " — the place was released" : ""}. The student was notified.` };
}
export async function rejectEntry(_: FormState, f: FormData) { return endEntry("rejected", f); }
export async function cancelEntry(_: FormState, f: FormData) { return endEntry("cancelled", f); }

/** Release an unearned place later (cancelled/not approved entries only). */
export async function releaseEntryPlace(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const id = s(f, "id", 40);
  if (!(await releasePlace(id))) return { error: "That place can't be released (only cancelled or not-approved entries that were never approved)." };
  await recordEvent(id, user.id, "place_released", "The unearned place was released.");
  await logActivity({ actorUserId: user.id, action: "campaign.place_released", targetType: "campaign_entry", targetId: id });
  await fillFromWaitlist();
  refresh(id);
  return { ok: "Place released." };
}

/** Approve or deny a requested social-profile change. */
export async function decideLinkChange(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const { e, version } = await load(f);
  if (!e?.pendingProfileUrl) return { error: "No link change is waiting." };
  const approve = f.get("decision") === "approve";
  if (approve) {
    const link = parseProfileUrl(e.pendingProfileUrl);
    if ("error" in link) return { error: link.error };
    const taken = await db.select({ id: campaignEntries.id }).from(campaignEntries)
      .where(and(eq(campaignEntries.profileUrlNorm, link.norm), ne(campaignEntries.id, e.id), notInArray(campaignEntries.status, ["cancelled", "rejected"]))).limit(1);
    if (taken.length) return { error: "That profile is already used by another participant." };
    const [row] = await db.update(campaignEntries).set({ profileUrl: link.url, profileUrlNorm: link.norm, platform: link.platform, pendingProfileUrl: null, pendingProfileReason: null, pendingProfileAt: null, version: sql`${campaignEntries.version} + 1` })
      .where(and(eq(campaignEntries.id, e.id), eq(campaignEntries.version, version))).returning();
    if (!row) return CHANGED;
    await recordEvent(e.id, user.id, "link_change_approved", `${e.profileUrl} → ${link.url}`);
  } else {
    const [row] = await db.update(campaignEntries).set({ pendingProfileUrl: null, pendingProfileReason: null, pendingProfileAt: null, version: sql`${campaignEntries.version} + 1` })
      .where(and(eq(campaignEntries.id, e.id), eq(campaignEntries.version, version))).returning();
    if (!row) return CHANGED;
    await recordEvent(e.id, user.id, "link_change_denied", s(f, "note", 500) || `Kept ${e.profileUrl}`);
  }
  await logActivity({ actorUserId: user.id, action: `campaign.link_${approve ? "approved" : "denied"}`, targetType: "campaign_entry", targetId: e.id });
  const { inbox } = await import("@/lib/inbox");
  await inbox(e.studentId, { kind: "campaign", title: approve ? "Your profile link was updated" : "Your profile link change wasn't approved", body: approve ? "Keep uploading screenshots from the updated account." : "Keep using the original account for the campaign.", href: "/campaign" });
  refresh(e.id);
  return { ok: approve ? "Link updated." : "Change denied." };
}

// ---------- Settings (owners) ----------
export async function saveCampaignSettings(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const c = await getCampaign();
  const capacity = Math.round(Number(f.get("capacity")));
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000) return { error: "Enter a capacity of at least 1." };
  if (capacity < c.occupied) return { error: `${c.occupied} places are already taken — capacity can't be lower than that.` };
  const day = s(f, "opensDay", 10), time = s(f, "opensTime", 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Set the booking-opening date and time." };
  const market = s(f, "market", 40) || "DFW";
  const patch = {
    capacity, market, bookingOpensAt: chicagoToUtc(day, time), instructions: s(f, "instructions", 6000),
    rewardTitle: s(f, "rewardTitle", 120) || null, rewardIncludes: s(f, "rewardIncludes", 1500) || null, updatedBy: user.id, updatedAt: new Date(),
  };
  await db.update(campaigns).set(patch).where(eq(campaigns.key, CAMPAIGN_KEY));
  await logActivity({ actorUserId: user.id, action: "campaign.settings", targetType: "campaign", targetId: CAMPAIGN_KEY, before: { capacity: c.capacity, bookingOpensAt: c.bookingOpensAt, market: c.market }, after: { capacity, bookingOpensAt: patch.bookingOpensAt, market } });
  if (capacity > c.capacity) await fillFromWaitlist();
  refresh();
  return { ok: "Saved." };
}

export async function publishCampaignTerms(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const terms = s(f, "terms", 12000);
  if (!terms) return { error: "Write the terms first." };
  if (f.get("reviewed") !== "on") return { error: "Confirm you've reviewed the terms before publishing." };
  const version = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  await db.update(campaigns).set({ terms, termsVersion: version, termsPublishedAt: new Date(), updatedBy: user.id, updatedAt: new Date() }).where(eq(campaigns.key, CAMPAIGN_KEY));
  await logActivity({ actorUserId: user.id, action: "campaign.terms_published", targetType: "campaign", targetId: CAMPAIGN_KEY, after: { version } });
  refresh();
  return { ok: `Published as version ${version}. New participants accept this version.` };
}

export async function saveCampaignGraphic(urls: string[]): Promise<{ error?: string }> {
  const { user } = await requireAdmin({ owner: true });
  const url = urls[0];
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !u.hostname.endsWith(".public.blob.vercel-storage.com") || !u.pathname.startsWith(`/students/${user.id}/`)) return { error: "Upload didn't complete." };
  } catch { return { error: "Upload didn't complete." }; }
  await db.update(campaigns).set({ graphicUrl: url, updatedBy: user.id, updatedAt: new Date() }).where(eq(campaigns.key, CAMPAIGN_KEY));
  await logActivity({ actorUserId: user.id, action: "campaign.graphic", targetType: "campaign", targetId: CAMPAIGN_KEY, after: { url } });
  refresh();
  return {};
}

export async function applySuppliedGraphic() {
  const { user } = await requireAdmin({ owner: true });
  await db.update(campaigns).set({ graphicUrl: "/campaign/nearest-profile-picture.png", updatedBy: user.id, updatedAt: new Date() }).where(eq(campaigns.key, CAMPAIGN_KEY));
  await logActivity({ actorUserId: user.id, action: "campaign.graphic", targetType: "campaign", targetId: CAMPAIGN_KEY, after: { url: "supplied" } });
  refresh();
}

export async function updateRewardOffer(form: FormData) {
  const { user } = await requireAdmin({ owner: true });
  const id = String(form.get("id") ?? "");
  const o = await db.query.campaignOffers.findFirst({ where: eq(campaignOffers.id, id) });
  if (!o) return;
  if (form.get("toggle") === "1") await db.update(campaignOffers).set({ active: !o.active }).where(eq(campaignOffers.id, id));
  const slots = form.get("slots") === null ? NaN : Number(form.get("slots"));
  if (Number.isInteger(slots) && slots >= 1 && slots >= o.slotsUsed && slots <= 5000) await db.update(campaignOffers).set({ slotsTotal: slots }).where(eq(campaignOffers.id, id));
  await logActivity({ actorUserId: user.id, action: "campaign.offer_updated", targetType: "campaign_offer", targetId: id, before: { active: o.active, slots: o.slotsTotal }, after: { toggle: form.get("toggle") === "1", slots } });
  refresh();
}


/** Enable (open), pause or close. Opening is blocked until the readiness checklist is complete. */
export async function setCampaignStatus(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const to = s(f, "to", 10);
  if (!["open", "paused", "closed"].includes(to)) return { error: "Unknown status." };
  const c = await getCampaign();
  if (to === "open") {
    const problems = await readinessProblems(c);
    if (problems.length) return { error: `Not ready to open: ${problems.join(" ")}` };
  }
  await db.update(campaigns).set({ status: to, updatedBy: user.id, updatedAt: new Date() }).where(eq(campaigns.key, CAMPAIGN_KEY));
  await logActivity({ actorUserId: user.id, action: "campaign.status", targetType: "campaign", targetId: CAMPAIGN_KEY, before: c.status, after: to });
  if (to === "open") await fillFromWaitlist();
  refresh();
  return { ok: to === "open" ? "The campaign is open." : to === "paused" ? "Paused — no new enrollments; participants can keep uploading." : "Closed to new enrollments; participants can finish." };
}

export async function removeFromWaitlist(form: FormData) {
  const { user } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  await db.update(campaignWaitlist).set({ status: "removed" }).where(eq(campaignWaitlist.id, id));
  await logActivity({ actorUserId: user.id, action: "campaign.waitlist_removed", targetType: "campaign_waitlist", targetId: id });
  refresh();
}
