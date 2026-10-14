import "server-only";
import { createHash, randomBytes } from "crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, supporters, supporterEvents, supporterInvites } from "@/db";

/**
 * Educator / supporter endorsements. Collected inside Nearest through an admin-shared invitation link, reviewed by hand,
 * and shown publicly only when Published AND the supporter gave the needed permissions. Kept completely separate from
 * student appointment reviews and professional ratings.
 */

export const SUPPORTER_STATUSES = ["invited", "submitted", "needs_correction", "approved", "published", "declined", "withdrawn"] as const;
export const STATUS_LABEL: Record<string, string> = {
  invited: "Invited", submitted: "Submitted", needs_correction: "Needs correction", approved: "Approved",
  published: "Published", declined: "Declined", withdrawn: "Withdrawn",
};

export const EXPERIENCE_LABEL: Record<string, string> = {
  walkthrough: "Saw a walkthrough of Nearest",
  website: "Reviewed the Nearest website",
  platform_use: "Used the Nearest platform",
  other: "Other experience",
};
const PUBLIC_EXPERIENCE: Record<string, string> = { walkthrough: "saw a walkthrough of Nearest", website: "reviewed the Nearest website" };
export const RELATIONSHIP_LABEL: Record<string, string> = {
  compensation: "Received compensation from Nearest",
  benefit: "Received a benefit (free service, credit, gift or similar)",
  employment: "Works for or with Nearest",
  other: "Other relationship with Nearest",
};

export const GOOGLE_REVIEW_URL = "https://g.page/r/CTVQM3aF8rY4ECE/review";
/** Google doesn't allow reviews from people with a paid/benefit/employment tie to the business — no Google button for them. */
export const canReviewOnGoogle = (relationships: string[] | null | undefined) => !(relationships ?? []).some((r) => ["compensation", "benefit", "employment"].includes(r));
export const EXPLAINER_SETTING = "supporters.explainer_video";
export const STATEMENT_EXAMPLE = "Example: \"As a counselor, I talk with students who want help with hair, nails or lashes before big events. Nearest gives them a safe, verified way to find licensed professionals near school, and I like that parents can see who their student is booking.\"";
export const BENEFIT_EXAMPLE = "Example: \"Students save time and money with after-school appointments close by, and parents get peace of mind knowing every professional is ID-checked.\"";
export const PUBLISH_CONSENT = "I agree that Nearest may publish my statements with my name, professional title, school or organization (as I described it above) and my photo if I uploaded one, on usenearest.com. I can correct or withdraw it anytime with my private link.";
export function affiliationLine(s: { title: string; organization: string; affiliationStatus: string }) {
  if (s.affiliationStatus === "none" || !s.organization) return s.title;
  return s.affiliationStatus === "former" ? `${s.title} · formerly with ${s.organization}` : `${s.title}, ${s.organization}`;
}

/** Video shown at the top of the supporter form: an uploaded MP4 or a YouTube/Vimeo link. */
export function explainerEmbed(url: string | null | undefined): { kind: "video" | "iframe"; src: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    const yt = u.hostname.includes("youtu.be") ? u.pathname.slice(1) : u.hostname.includes("youtube.com") ? (u.searchParams.get("v") ?? u.pathname.split("/").pop()) : null;
    if (yt && /^[A-Za-z0-9_-]{6,20}$/.test(yt)) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt}` };
    const vm = u.hostname.includes("vimeo.com") ? u.pathname.split("/").filter(Boolean).pop() : null;
    if (vm && /^\d+$/.test(vm)) return { kind: "iframe", src: `https://player.vimeo.com/video/${vm}` };
    if (u.hostname.endsWith(".public.blob.vercel-storage.com")) return { kind: "video", src: url };
  } catch { /* not a link */ }
  return null;
}
export async function getExplainerUrl() {
  const { platformSettings } = await import("@/db");
  const row = await db.query.platformSettings.findFirst({ where: eq(platformSettings.key, EXPLAINER_SETTING) });
  return typeof row?.value === "string" ? row.value : null;
}

export const PERSONAL_DISCLAIMER = "Personal endorsements reflect individual views, not school or district endorsements.";
export const INVITE_DAYS_DEFAULT = 14;
export const PORTRAIT_MAX_BYTES = 4 * 1024 * 1024;

export const newToken = () => randomBytes(24).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(`supporter:${t}`).digest("hex");
export const tokenShape = (t: string) => /^[A-Za-z0-9_-]{20,64}$/.test(t);

export const appUrl = () => process.env.APP_URL || "https://www.usenearest.com";
export const inviteLink = (token: string) => `${appUrl()}/supporters/invite/${token}`;
export const manageLink = (token: string) => `${appUrl()}/supporters/manage/${token}`;

/** A usable invitation (not used, not revoked, not expired) or the reason it can't be used. */
export async function openInvite(token: string) {
  if (!tokenShape(token)) return { error: "This invitation link isn't valid." } as const;
  const inv = await db.query.supporterInvites.findFirst({ where: eq(supporterInvites.token, token) });
  if (!inv) return { error: "This invitation link isn't valid." } as const;
  if (inv.status === "submitted") return { error: "This invitation has already been used. If you submitted it, use your private management link to make changes." } as const;
  if (inv.status === "revoked") return { error: "This invitation was cancelled." } as const;
  if (inv.expiresAt.getTime() <= Date.now()) return { error: "This invitation has expired. Ask Nearest for a new link." } as const;
  return { invite: inv } as const;
}

export async function supporterByManageToken(token: string) {
  if (!tokenShape(token)) return null;
  return (await db.query.supporters.findFirst({ where: eq(supporters.manageTokenHash, hashToken(token)) })) ?? null;
}

export async function logSupporter(supporterId: string, actor: "supporter" | "admin", kind: string, detail?: unknown, actorId?: string | null) {
  await db.insert(supporterEvents).values({ supporterId, actor, kind, detail: (detail ?? null) as object | null, actorId: actorId ?? null });
}

export type Supporter = typeof supporters.$inferSelect;

/** Problems that keep a record from being published (empty = it can be). display: an already-published record stays
 *  live (with its approved wording) while an admin's suggested change waits for the supporter. */
export function publishProblems(s: Supporter, opts: { display?: boolean } = {}) {
  const out: string[] = [];
  if (!["approved", "published"].includes(s.status)) out.push("Approve it first.");
  if (!s.permStatement) out.push("The supporter hasn't given permission to publish their statement.");
  if (!s.permName) out.push("The supporter hasn't given permission to publish their name and title.");
  if (s.statementProposed && !opts.display) out.push("Your wording change is waiting for the supporter's approval.");
  if (!s.confirmHonest) out.push("The supporter didn't confirm the statement is their honest perspective.");
  if (s.endorsementType === "organizational" && !s.orgAuthorityReviewedBy) out.push("Confirm the organizational authorization (or approve it as a personal endorsement).");
  return out;
}

/** Organizational label only with the supporter's confirmation AND an admin's review — affiliation alone never counts. */
export const isOrganizational = (s: Supporter) => s.endorsementType === "organizational" && s.orgAuthorityConfirmed && Boolean(s.orgAuthorityReviewedBy);

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "•";
}

export type PublicSupporter = {
  id: string; name: string; title: string; organization: string | null; affiliation: string; statement: string; benefit: string | null;
  portrait: boolean; initials: string; label: string; experience: string; prelaunch: boolean; disclosure: string | null;
};

/** What the public pages may show — published records, filtered by each permission. */
export async function publishedSupporters(): Promise<PublicSupporter[]> {
  const rows = await db.select().from(supporters).where(and(eq(supporters.status, "published"), eq(supporters.permStatement, true), eq(supporters.permName, true)))
    .orderBy(asc(supporters.sort), desc(supporters.publishedAt));
  return rows.filter((s) => s.statementPublished && publishProblems(s, { display: true }).length === 0).map((s) => {
    const org = isOrganizational(s);
    const rel = (s.relationships ?? []).filter((r) => r in RELATIONSHIP_LABEL);
    return {
      id: s.id, name: s.name, title: s.title,
      organization: s.affiliationStatus !== "none" && s.organization && (s.permAffiliation || org) ? s.organization : null,
      affiliation: s.permAffiliation || org ? affiliationLine(s) : s.title,
      statement: s.statementPublished!,
      benefit: s.benefitPublished || null,
      portrait: Boolean(s.permPortrait && s.portraitUrl),
      initials: initials(s.name),
      label: org ? `Endorsement on behalf of ${s.organization}` : "Personal endorsement",
      experience: s.experience === "platform_use" ? "Based on using Nearest" : `Prelaunch perspective — ${s.experience === "other" ? (s.experienceOther || "other experience") : PUBLIC_EXPERIENCE[s.experience]}`,
      prelaunch: s.experience !== "platform_use",
      disclosure: rel.length ? `Disclosure: ${rel.map((r) => RELATIONSHIP_LABEL[r].replace(/^./, (c) => c.toLowerCase())).join("; ")}${s.relationshipNote ? ` — ${s.relationshipNote}` : ""}.` : null,
    };
  });
}

/**
 * Placeholder profiles for development and Vercel preview deployments ONLY — never on the live site. They use initials,
 * are clearly labeled samples, and never use real-looking names, photos or statements.
 */
export function previewPlaceholders(): PublicSupporter[] {
  const live = process.env.VERCEL_ENV === "production" || (process.env.NODE_ENV === "production" && !process.env.VERCEL_ENV);
  if (live) return [];
  return ["Sample A", "Sample B", "Sample C"].map((n, i) => ({
    id: `sample-${i}`, name: `${n} (placeholder)`, title: "Educator title", organization: null, affiliation: "Educator title",
    statement: "Their approved statement about Nearest appears here.", benefit: null, portrait: false, initials: `S${String.fromCharCode(65 + i)}`,
    label: "Personal endorsement", experience: "Sample only", prelaunch: true, disclosure: null,
  }));
}
