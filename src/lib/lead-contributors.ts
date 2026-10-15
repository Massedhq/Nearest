import "server-only";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { and, eq, ne, or, sql } from "drizzle-orm";
import { db, leadContributors, leadInvites, prospects, users, professionalProfiles, outreachSuppression, categories } from "@/db";
import { normEmail, normPhone, resolvePlace, logProspect, notifyAdmins } from "./outreach";

/**
 * Lead Contributors — hired people who may ONLY add professional prospects, by hand or through their own invitation
 * links. Every lead they add uses Avy's existing recruiter account and AVY referral code (prospects.recruiterId), set
 * here on the server; the contributor is recorded separately as "Entered by" (prospects.enteredBy) for internal
 * tracking only — never referral ownership, partner credit or compensation. Contributors are not admins: every admin
 * page and API keeps refusing them, and their own pages show only confirmations and their own invitation links.
 */

/** The existing referral code every contributor lead is attributed to. */
export const CONTRIBUTOR_REFERRAL_CODE = "AVY";
export const CONTRIBUTOR_INVITE_DAYS = 14; // to create their login
export const LEAD_LINK_DAYS = [7, 14, 30];
export const LEAD_SOURCES = ["Instagram", "Facebook", "TikTok", "Google", "Website", "Salon", "Barber Shop", "Beauty School", "Beauty Supply Store", "Event", "Referral", "Other"];

export const newContributorToken = () => randomBytes(24).toString("hex"); // 48 hex characters
export const newLeadLinkToken = () => randomBytes(18).toString("base64url"); // 24 characters
export const contributorTokenShape = (t: string) => /^[0-9a-f]{48}$/.test(t);
export const leadLinkShape = (t: string) => /^[A-Za-z0-9_-]{20,40}$/.test(t);

/** Avy's recruiter account — found through her existing AVY partner code. */
export async function contributorRecruiterId() {
  const { partnerByCode } = await import("./partner");
  return partnerByCode(CONTRIBUTOR_REFERRAL_CODE);
}

export async function contributorForUser(userId: string | null | undefined) {
  if (!userId) return null;
  return (await db.query.leadContributors.findFirst({ where: and(eq(leadContributors.userId, userId), eq(leadContributors.status, "active")) })) ?? null;
}

/** Top of every contributor page and action. Anyone else goes back to where they belong. */
export async function requireContributor() {
  const { getViewer, destinationFor } = await import("@/lib/viewer");
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?redirect_url=/leads");
  const contributor = await contributorForUser(viewer.user?.id);
  if (!contributor || !viewer.user) redirect(viewer.admin ? "/admin" : await destinationFor(viewer));
  return { user: viewer.user, contributor };
}

/**
 * "instagram.com/Jas.Nails/", "https://www.instagram.com/jas.nails?igshid=…", "@jas.nails" → "instagram.com/jas.nails".
 * A bare @handle is treated as Instagram. Anything that isn't a web address or handle → null.
 */
export function normSocial(raw: string | null | undefined) {
  let v = (raw ?? "").trim();
  if (!v) return null;
  if (/^@[A-Za-z0-9._]{2,40}$/.test(v)) return `instagram.com/${v.slice(1).toLowerCase()}`;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)) return null;
    const host = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch { return null; }
}

export type LeadInput = {
  name: string; business: string; categoryId: number | null; city: string; county: string; state: string;
  email: string; phone: string; social: string; source: string; notes: string;
};

/** Required: name, service category, city + county + state, and at least one usable way to reach them. */
export function leadProblems(i: LeadInput) {
  const out: string[] = [];
  if (!i.name) out.push("Enter the professional's or contact's name.");
  if (!i.categoryId) out.push("Choose a service category.");
  if (!i.city || !i.county || !i.state) out.push("Enter the city, county and state.");
  if (i.email && !normEmail(i.email)) out.push("That email address doesn't look complete.");
  if (i.phone && !normPhone(i.phone)) out.push("Enter a 10-digit phone number.");
  if (i.social && !normSocial(i.social)) out.push("Enter the full social profile or website address (or an @handle).");
  if (!normEmail(i.email) && !normPhone(i.phone) && !normSocial(i.social)) out.push("Add at least one way to reach them: email, phone, or a social profile / website.");
  return out;
}

const who = async (id: string | null | undefined) => (id ? (await db.query.users.findFirst({ where: eq(users.id, id), columns: { firstName: true, lastName: true } })) : null);
const nameOf = (u: { firstName: string | null; lastName: string | null } | null | undefined) => [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "another recruiter";

/**
 * Saves a contributor's lead. Attribution comes only from the contributor's server record — never from the form.
 * Matches on normalized email, phone or social link (other prospects and professional accounts) become a separate
 * "Duplicate" record for the owner to review; the existing lead is never changed or shown to the contributor.
 * Another recruiter's attribution on the match is flagged as a conflict, never overwritten.
 */
export async function saveContributorLead(
  i: LeadInput,
  c: { contributorUserId: string; recruiterId: string; contributorName: string },
  how: { method: "manual" | "invitation"; inviteId?: string | null },
) {
  const em = normEmail(i.email), ph = normPhone(i.phone), so = normSocial(i.social);
  const cat = i.categoryId ? await db.query.categories.findFirst({ where: eq(categories.id, i.categoryId) }) : null;
  const cityId = await resolvePlace(i.city, i.state);
  const base = {
    recruiterId: c.recruiterId, enteredBy: c.contributorUserId, entryMethod: how.method, leadInviteId: how.inviteId ?? null,
    name: i.name, business: i.business || null, city: i.city || null, county: i.county || null, state: (i.state || "TX").toUpperCase().slice(0, 2), cityId,
    category: cat?.name ?? null, categoryId: cat?.id ?? null, email: i.email || null, phone: i.phone || null, socialUrl: i.social || null,
    source: i.source || (how.method === "invitation" ? "Invitation link" : null), notes: i.notes || null,
  };

  // Do-not-contact list: kept for the owner's records, never made ready for outreach.
  const suppressed = (em || ph) ? (await db.select({ id: outreachSuppression.id }).from(outreachSuppression)
    .where(or(...(em ? [eq(outreachSuppression.emailNorm, em)] : []), ...(ph ? [eq(outreachSuppression.phoneNorm, ph)] : []))).limit(1)).length > 0 : false;

  const match = (em || ph || so) ? (await db.select().from(prospects).where(and(ne(prospects.status, "duplicate"),
    or(...(em ? [eq(prospects.emailNorm, em)] : []), ...(ph ? [eq(prospects.phoneNorm, ph)] : []), ...(so ? [eq(prospects.socialNorm, so)] : [])))).limit(1))[0] ?? null : null;
  const pro = !match && (em || ph) ? (await db.select({ id: users.id, referredBy: professionalProfiles.referredBy }).from(users)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
    .where(or(...(em ? [sql`lower(${users.email}) = ${em}`] : []), ...(ph ? [sql`right(regexp_replace(coalesce(${users.phone}, ''), '\\D', '', 'g'), 10) = ${ph}`] : []))).limit(1))[0] ?? null : null;

  let row;
  let flagged = false;
  if (match || pro) {
    const otherOwner = match ? match.recruiterId : pro!.referredBy;
    const conflict = otherOwner && otherOwner !== c.recruiterId ? (match
      ? `Already a prospect attributed to ${nameOf(await who(otherOwner))}. Kept with them — not reassigned.`
      : `Already a registered professional attributed to ${nameOf(await who(otherOwner))}. Their attribution was not changed.`) : null;
    [row] = await db.insert(prospects).values({
      ...base, status: "duplicate", duplicateOf: match?.id ?? null,
      emailNorm: null, phoneNorm: null, socialNorm: null, // a duplicate record never matches anything
      conflictNote: conflict, conflictAt: conflict ? new Date() : null,
    }).returning();
    flagged = true;
    await logProspect(row.id, "duplicate", match ? "Matched an existing prospect — kept as a separate record for review." : `Matched an existing professional account (/admin/professionals/${pro!.id}).`, c.contributorUserId);
    if (match) await logProspect(match.id, "note", `Submitted again by a Lead Contributor (${how.method}). See duplicate record ${row.id.slice(0, 8)}.`, c.contributorUserId);
    if (conflict) await logProspect(row.id, "attribution_conflict", conflict, null);
  } else {
    const maybe = i.city ? (await db.select({ id: prospects.id }).from(prospects).where(and(ne(prospects.status, "duplicate"), sql`lower(${prospects.city}) = lower(${i.city})`,
      or(sql`lower(${prospects.name}) = lower(${i.name})`, ...(i.business ? [sql`lower(${prospects.business}) = lower(${i.business})`] : [])))).limit(1))[0] ?? null : null;
    [row] = await db.insert(prospects).values({
      ...base, emailNorm: suppressed ? null : em, phoneNorm: suppressed ? null : ph, socialNorm: so,
      status: suppressed ? "opted_out" : em ? "new" : "needs_info", duplicateOf: maybe?.id ?? null,
    }).returning();
    flagged = Boolean(maybe) || suppressed;
    if (maybe) await logProspect(row.id, "possible_duplicate", "Same name or business in the same city as an existing prospect — check before outreach.", c.contributorUserId);
    if (suppressed) await logProspect(row.id, "note", "On the do-not-contact list — kept for records only.", null);
  }
  await logProspect(row.id, "added", `Entered by ${c.contributorName} (Lead Contributor, ${how.method === "manual" ? "manual entry" : "invitation link"}).${base.source ? ` Source: ${base.source}.` : ""}`, c.contributorUserId);
  try {
    await notifyAdmins({
      kind: "lead", title: row.conflictNote ? "Lead attribution conflict to review" : flagged ? "New lead to review (possible duplicate)" : "New lead from a Lead Contributor",
      body: `${row.name}${row.category ? ` • ${row.category}` : ""}${row.city ? ` • ${row.city}` : ""} — entered by ${c.contributorName}`, href: `/admin/outreach/prospects/${row.id}`,
    }, [c.recruiterId]);
  } catch (e) { console.error("lead notify", e); }
  return row;
}

/** A usable invitation link (active, not expired, contributor still active) or why not. */
export async function openLeadInvite(token: string) {
  if (!leadLinkShape(token)) return { error: "This link isn't valid." } as const;
  const inv = await db.query.leadInvites.findFirst({ where: eq(leadInvites.token, token) });
  if (!inv) return { error: "This link isn't valid." } as const;
  if (inv.status === "submitted") return { done: true } as const;
  const c = await db.query.leadContributors.findFirst({ where: eq(leadContributors.id, inv.contributorId) });
  if (inv.status === "revoked" || !c || c.status !== "active" || !c.userId) return { error: "This link is no longer active." } as const;
  if (inv.expiresAt.getTime() <= Date.now()) return { error: "This link has expired." } as const;
  return { invite: inv, contributor: c } as const;
}

/**
 * Registration: a contributor lead keeps Avy's referral attribution. If the new professional has no partner yet, it's
 * set to the lead's recruiter; if they joined through a different partner's code, nothing is overwritten — the lead
 * is flagged for Avy's review.
 */
export async function keepContributorAttribution(userId: string, lead: typeof prospects.$inferSelect) {
  if (!lead.enteredBy || !lead.recruiterId) return;
  const p = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, userId) });
  if (!p) return;
  if (!p.referredBy) {
    await db.update(professionalProfiles).set({ referredBy: lead.recruiterId }).where(and(eq(professionalProfiles.userId, userId), sql`${professionalProfiles.referredBy} is null`));
    await logProspect(lead.id, "attribution_kept", `Registered — referral attribution kept with the ${CONTRIBUTOR_REFERRAL_CODE} code.`, null);
  } else if (p.referredBy !== lead.recruiterId) {
    const note = `Registered through ${nameOf(await who(p.referredBy))}'s referral code. Their attribution was kept — not overwritten.`;
    await db.update(prospects).set({ conflictNote: note, conflictAt: new Date(), conflictReviewedAt: null, conflictReviewedBy: null, updatedAt: new Date() }).where(eq(prospects.id, lead.id));
    await logProspect(lead.id, "attribution_conflict", note, null);
    await notifyAdmins({ kind: "lead", title: "Lead attribution conflict to review", body: `${lead.name} registered with another partner's code.`, href: `/admin/outreach/prospects/${lead.id}` }, [lead.recruiterId]);
  }
}

/** Contributor records and outcomes: only the lead's recruiter (Avy) and the main owner. */
export async function canSeeContributorLeads(userId: string, role: string, recruiterId: string | null) {
  if (role !== "OWNER") return false;
  if (recruiterId === userId) return true;
  const { mainOwnerId } = await import("./partner");
  return (await mainOwnerId()) === userId;
}
