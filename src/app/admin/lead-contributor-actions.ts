"use server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, leadContributors, leadInvites, prospects, users, adminMembers, salesReps } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { normEmail } from "@/lib/outreach";
import { CONTRIBUTOR_INVITE_DAYS, CONTRIBUTOR_REFERRAL_CODE, contributorRecruiterId, newContributorToken } from "@/lib/lead-contributors";

type FormState = { error?: string; ok?: string };
const s = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const refresh = () => revalidatePath("/admin/outreach/contributors");

/**
 * Owner only: invite a Lead Contributor. Their leads always carry Avy's existing AVY referral attribution — the
 * recruiter is looked up from the AVY code here, never chosen in a form.
 */
export async function inviteLeadContributor(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const name = s(f, "name", 120);
  const email = normEmail(s(f, "email", 160));
  if (!name) return { error: "Enter their name." };
  if (!email) return { error: "Enter a valid email address." };
  const recruiterId = await contributorRecruiterId();
  if (!recruiterId) return { error: `The ${CONTRIBUTOR_REFERRAL_CODE} referral code wasn't found on an active owner account, so leads couldn't be attributed. Check Admin → Team.` };
  // A contributor login must be a separate, staff-only login — never an admin, professional, student or sales rep.
  const existing = await db.query.users.findFirst({ where: sql`lower(${users.email}) = ${email}` });
  if (existing) {
    if (existing.accountType !== "staff") return { error: "That email already has a Nearest student or professional account. Use a different email for their contributor login." };
    if (await db.query.adminMembers.findFirst({ where: eq(adminMembers.userId, existing.id) })) return { error: "That email belongs to a Nearest admin. Use a different email." };
    if (await db.query.salesReps.findFirst({ where: and(eq(salesReps.userId, existing.id), eq(salesReps.status, "active")) })) return { error: "That email belongs to a sales rep. Use a different email." };
  }
  const dup = await db.query.leadContributors.findFirst({ where: and(eq(leadContributors.email, email), sql`${leadContributors.status} <> 'removed'`) });
  if (dup) return { error: "That email is already a Lead Contributor (or has an invitation waiting)." };
  const [row] = await db.insert(leadContributors).values({
    name, email, token: newContributorToken(), recruiterId, invitedBy: user.id,
    inviteExpiresAt: new Date(Date.now() + CONTRIBUTOR_INVITE_DAYS * 86400000),
  }).returning();
  await logActivity({ actorUserId: user.id, action: "lead_contributor.invited", targetType: "lead_contributor", targetId: row.id, after: { name, email, recruiterId } });
  refresh();
  return { ok: "Invitation created — copy the link below and send it to them yourself." };
}

/** A fresh invitation link (the old one stops working). */
export async function newLeadContributorLink(f: FormData) {
  const { user } = await requireAdmin({ owner: true });
  const id = s(f, "id", 40);
  await db.update(leadContributors).set({ token: newContributorToken(), inviteExpiresAt: new Date(Date.now() + CONTRIBUTOR_INVITE_DAYS * 86400000) })
    .where(and(eq(leadContributors.id, id), eq(leadContributors.status, "invited")));
  await logActivity({ actorUserId: user.id, action: "lead_contributor.new_link", targetType: "lead_contributor", targetId: id });
  refresh();
}

/** Revoke the role: their workspace and every invitation link they made stop working right away. Leads stay. */
export async function removeLeadContributor(f: FormData) {
  const { user } = await requireAdmin({ owner: true });
  const id = s(f, "id", 40);
  const before = await db.query.leadContributors.findFirst({ where: eq(leadContributors.id, id) });
  if (!before || before.status === "removed") return;
  await db.update(leadContributors).set({ status: "removed", removedAt: new Date() }).where(eq(leadContributors.id, id));
  await db.update(leadInvites).set({ status: "revoked" }).where(and(eq(leadInvites.contributorId, id), eq(leadInvites.status, "active")));
  await logActivity({ actorUserId: user.id, action: "lead_contributor.removed", targetType: "lead_contributor", targetId: id, before: { status: before.status } });
  refresh();
}

/** Give the role back to a removed contributor (same login, same attribution). */
export async function restoreLeadContributor(f: FormData) {
  const { user } = await requireAdmin({ owner: true });
  const id = s(f, "id", 40);
  const before = await db.query.leadContributors.findFirst({ where: eq(leadContributors.id, id) });
  if (!before || before.status !== "removed") return;
  await db.update(leadContributors).set({ status: before.userId ? "active" : "invited", removedAt: null, ...(before.userId ? {} : { token: newContributorToken(), inviteExpiresAt: new Date(Date.now() + CONTRIBUTOR_INVITE_DAYS * 86400000) }) }).where(eq(leadContributors.id, id));
  await logActivity({ actorUserId: user.id, action: "lead_contributor.restored", targetType: "lead_contributor", targetId: id });
  refresh();
}

/** The recruiter (Avy) or main owner marks an attribution conflict as reviewed. Attribution itself isn't changed here. */
export async function reviewLeadConflict(f: FormData) {
  const { user, role } = await requireAdmin();
  const p = await db.query.prospects.findFirst({ where: eq(prospects.id, s(f, "id", 40)) });
  if (!p?.conflictNote) return;
  const { canSeeContributorLeads } = await import("@/lib/lead-contributors");
  if (!(await canSeeContributorLeads(user.id, role, p.recruiterId))) return;
  await db.update(prospects).set({ conflictReviewedAt: new Date(), conflictReviewedBy: user.id, updatedAt: new Date() }).where(eq(prospects.id, p.id));
  const { logProspect } = await import("@/lib/outreach");
  await logProspect(p.id, "conflict_reviewed", s(f, "note", 500) || "Attribution conflict reviewed.", user.id);
  revalidatePath(`/admin/outreach/prospects/${p.id}`);
}
