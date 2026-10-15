"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, leadInvites } from "@/db";
import type { FormState } from "@/components/ActionForm";
import { normEmail } from "@/lib/outreach";
import { LEAD_LINK_DAYS, LEAD_SOURCES, leadProblems, newLeadLinkToken, requireContributor, saveContributorLead, type LeadInput } from "@/lib/lead-contributors";

const s = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);

/**
 * Lead Contributor actions. Attribution (recruiter = Avy / AVY code, entered by = this contributor, method, invitation,
 * time) comes ONLY from the signed-in contributor's server record — any such fields sent in the form are ignored.
 */
export async function addLead(_: FormState, f: FormData): Promise<FormState> {
  const { user, contributor } = await requireContributor();
  const catId = Number(f.get("categoryId"));
  const i: LeadInput = {
    name: s(f, "name", 120), business: s(f, "business", 120), categoryId: Number.isInteger(catId) && catId > 0 ? catId : null,
    city: s(f, "city", 80), county: s(f, "county", 80), state: s(f, "state", 20).toUpperCase() || "TX",
    email: s(f, "email", 160), phone: s(f, "phone", 30), social: s(f, "social", 300),
    source: LEAD_SOURCES.includes(s(f, "source", 40)) ? s(f, "source", 40) : "", notes: s(f, "notes", 1000),
  };
  const problems = leadProblems(i);
  if (problems.length) return { error: problems.join(" ") };
  const row = await saveContributorLead(i, { contributorUserId: user.id, recruiterId: contributor.recruiterId, contributorName: contributor.name }, { method: "manual" });
  return { ok: `Saved — ${i.name} was received (reference ${row.id.slice(0, 8).toUpperCase()}).${normEmail(i.email) ? "" : " Without an email address it's kept as Needs information."}` };
}

export async function createLeadLink(_: FormState, f: FormData): Promise<FormState> {
  const { contributor } = await requireContributor();
  const days = LEAD_LINK_DAYS.includes(Number(f.get("days"))) ? Number(f.get("days")) : 14;
  const source = LEAD_SOURCES.includes(s(f, "source", 40)) ? s(f, "source", 40) : null;
  await db.insert(leadInvites).values({ token: newLeadLinkToken(), contributorId: contributor.id, label: s(f, "label", 120) || null, source, expiresAt: new Date(Date.now() + days * 86400000) });
  revalidatePath("/leads");
  return { ok: "Link created — copy it from Your invitation links below." };
}

export async function revokeLeadLink(f: FormData) {
  const { contributor } = await requireContributor();
  await db.update(leadInvites).set({ status: "revoked" }).where(and(eq(leadInvites.id, s(f, "id", 40)), eq(leadInvites.contributorId, contributor.id), eq(leadInvites.status, "active")));
  revalidatePath("/leads");
}
