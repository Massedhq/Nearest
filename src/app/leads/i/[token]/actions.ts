"use server";
import { and, eq, gt } from "drizzle-orm";
import { db, leadInvites } from "@/db";
import type { FormState } from "@/components/ActionForm";
import { normEmail, normPhone } from "@/lib/outreach";
import { normSocial, openLeadInvite, saveContributorLead, type LeadInput } from "@/lib/lead-contributors";

const s = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);

/**
 * Public professional interest form (a Lead Contributor's invitation link). No account. The contributor, invitation and
 * Avy's referral attribution come from the link's server record — never from the form. One submission per link:
 * the link is claimed atomically, so repeat submissions never create another record.
 */
export async function submitInterest(_: FormState, f: FormData): Promise<FormState> {
  const token = s(f, "token", 60);
  const open = await openLeadInvite(token);
  if ("done" in open) return { ok: "Thanks — we already received your information." };
  if ("error" in open) return { error: open.error };
  if (f.get("website_url")) return { ok: "Thanks — your information was received." }; // hidden honeypot field filled in by bots
  const catId = Number(f.get("categoryId"));
  const i: LeadInput = {
    name: s(f, "name", 120), business: s(f, "business", 120), categoryId: Number.isInteger(catId) && catId > 0 ? catId : null,
    city: s(f, "city", 80), county: s(f, "county", 80), state: s(f, "state", 20).toUpperCase() || "TX",
    email: s(f, "email", 160), phone: s(f, "phone", 30), social: s(f, "social", 300), source: open.invite.source ?? "", notes: s(f, "message", 1000),
  };
  if (!i.name) return { error: "Enter your name." };
  if (!i.categoryId) return { error: "Choose the service you offer." };
  if (!i.city || !i.county || !i.state) return { error: "Enter your city, county and state." };
  if (i.email && !normEmail(i.email)) return { error: "Check your email address." };
  if (i.phone && !normPhone(i.phone)) return { error: "Enter a 10-digit phone number." };
  if (i.social && !normSocial(i.social)) return { error: "Enter the full address of your social profile or website (or your @handle)." };
  if (!normEmail(i.email) && !normPhone(i.phone)) return { error: "Add an email address or phone number so Nearest can reach you." };
  if (f.get("understand") !== "on") return { error: "Tick the box to confirm you understand what this form does." };

  const [claimed] = await db.update(leadInvites).set({ status: "submitted", submittedAt: new Date() })
    .where(and(eq(leadInvites.id, open.invite.id), eq(leadInvites.status, "active"), gt(leadInvites.expiresAt, new Date()))).returning();
  if (!claimed) return { ok: "Thanks — we already received your information." };
  try {
    const row = await saveContributorLead(i, { contributorUserId: open.contributor.userId!, recruiterId: open.contributor.recruiterId, contributorName: open.contributor.name }, { method: "invitation", inviteId: claimed.id });
    await db.update(leadInvites).set({ prospectId: row.id }).where(eq(leadInvites.id, claimed.id));
  } catch (e) {
    console.error("interest submit", e);
    await db.update(leadInvites).set({ status: "active", submittedAt: null }).where(eq(leadInvites.id, claimed.id));
    return { error: "Something went wrong — please try again." };
  }
  return { ok: "Thank you — your information was received. Someone from Nearest may reach out to you." };
}
