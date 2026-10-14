import { and, eq, gt, sql } from "drizzle-orm";
import { db, supporters, supporterInvites } from "@/db";
import { hashToken, logSupporter, manageLink, newToken, openInvite, PORTRAIT_MAX_BYTES, EXPERIENCE_LABEL, RELATIONSHIP_LABEL } from "@/lib/supporters";

/**
 * Public: a supporter submits through their invitation link (no Nearest account). One submission per invitation —
 * the invitation is claimed in a single conditional update, so two submits at once can't both succeed.
 * The portrait (optional) is checked from its bytes and stored in Blob; only a reference is saved.
 */
export async function POST(req: Request) {
  let f: FormData;
  try { f = await req.formData(); } catch { return Response.json({ error: "Something went wrong reading the form. Try again." }, { status: 400 }); }
  const s = (k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
  const on = (k: string) => f.get(k) === "on";
  const token = s("token", 80);
  const open = await openInvite(token);
  if ("error" in open) return Response.json({ error: open.error }, { status: 410 });

  const name = s("name", 120), email = s("email", 160).toLowerCase(), title = s("title", 120);
  const affiliationStatus = s("affiliationStatus", 10);
  const organization = affiliationStatus === "none" ? "" : s("organization", 160);
  const statement = s("statement", 1500), benefit = s("benefit", 1500), experience = s("experience", 20), experienceOther = s("experienceOther", 300);
  const endorsementType = s("endorsementType", 20), orgAuthorityNote = s("orgAuthorityNote", 300);
  const relationships = f.getAll("relationships").map(String).filter((r) => r in RELATIONSHIP_LABEL);
  const relationshipNote = s("relationshipNote", 500);
  if (!name || !title) return Response.json({ error: "Enter your name and professional title." }, { status: 400 });
  if (!["current", "former", "none"].includes(affiliationStatus)) return Response.json({ error: "Tell us whether you're currently with a school or organization, were previously, or neither." }, { status: 400 });
  if (affiliationStatus !== "none" && !organization) return Response.json({ error: "Enter the school or organization." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Enter a valid contact email (kept private)." }, { status: 400 });
  if (statement.length < 20) return Response.json({ error: "Share your opinion of Nearest in your own words (at least a sentence)." }, { status: 400 });
  const rating = Number(f.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return Response.json({ error: "Choose your star rating (1 to 5)." }, { status: 400 });
  if (benefit.length < 20) return Response.json({ error: "Tell us how Nearest could benefit students and parents (at least a sentence)." }, { status: 400 });
  if (!(experience in EXPERIENCE_LABEL)) return Response.json({ error: "Tell us what you reviewed or experienced." }, { status: 400 });
  if (experience === "other" && !experienceOther) return Response.json({ error: "Describe what you reviewed or experienced." }, { status: 400 });
  if (!["personal", "organizational"].includes(endorsementType)) return Response.json({ error: "Choose personal or organizational endorsement." }, { status: 400 });
  if (endorsementType === "organizational" && affiliationStatus !== "current") return Response.json({ error: "Only someone currently with an organization can endorse on its behalf — choose personal endorsement." }, { status: 400 });
  if (endorsementType === "organizational" && (!on("orgAuthorityConfirmed") || !orgAuthorityNote)) return Response.json({ error: "For an organizational endorsement, confirm you're authorized and describe your authority — or choose personal endorsement." }, { status: 400 });
  if (f.get("relationshipAnswer") !== "none" && f.get("relationshipAnswer") !== "some") return Response.json({ error: "Tell us whether you have any relationship with Nearest." }, { status: 400 });
  if (f.get("relationshipAnswer") === "some" && !relationships.length) return Response.json({ error: "Choose the relationship you have with Nearest." }, { status: 400 });
  if (!on("confirmHonest")) return Response.json({ error: "Confirm the statement reflects your honest perspective." }, { status: 400 });
  if (!on("publishConsent")) return Response.json({ error: "Agree that Nearest may publish your statement — that's what this form is for." }, { status: 400 });

  // Optional portrait.
  let portraitUrl: string | null = null, portraitAccess: string | null = null;
  const file = f.get("portrait");
  if (file && typeof file !== "string" && file.size > 0) {
    if (file.size > PORTRAIT_MAX_BYTES) return Response.json({ error: "That photo is too large (4 MB max)." }, { status: 400 });
    if (!on("confirmPhoto")) return Response.json({ error: "Confirm you have permission to provide the photo." }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    const { sniffImage, storeEvidence } = await import("@/lib/campaign-storage");
    const mime = sniffImage(buf);
    if (!mime) return Response.json({ error: "Upload a JPG, PNG or WebP photo." }, { status: 400 });
    const stored = await storeEvidence(`supporters/${open.invite.id}`, buf, mime);
    portraitUrl = stored.url; portraitAccess = stored.access;
  }

  // Claim the invitation exactly once.
  const [claimed] = await db.update(supporterInvites).set({ status: "submitted", usedAt: new Date() })
    .where(and(eq(supporterInvites.id, open.invite.id), eq(supporterInvites.status, "invited"), gt(supporterInvites.expiresAt, sql`now()`))).returning();
  if (!claimed) {
    if (portraitUrl) (await import("@/lib/campaign-storage")).deleteEvidence(portraitUrl);
    return Response.json({ error: "This invitation has already been used." }, { status: 409 });
  }
  const manage = newToken();
  const [row] = await db.insert(supporters).values({
    inviteId: claimed.id, status: "submitted", manageTokenHash: hashToken(manage),
    name, email, title, organization, affiliationStatus, portraitUrl, portraitAccess,
    statementOriginal: statement, statementCurrent: statement, benefitCurrent: benefit, rating,
    experience, experienceOther: experience === "other" ? experienceOther : null,
    endorsementType, orgAuthorityNote: endorsementType === "organizational" ? orgAuthorityNote : null,
    orgAuthorityConfirmed: endorsementType === "organizational" && on("orgAuthorityConfirmed"),
    relationships: f.get("relationshipAnswer") === "some" ? relationships : [], relationshipNote: f.get("relationshipAnswer") === "some" ? relationshipNote || null : null,
    // Submitting = consent to publish (one agreement box). The individual flags stay so a withdrawal can switch everything off.
    permStatement: true, permName: true, permPortrait: Boolean(portraitUrl), permAffiliation: affiliationStatus !== "none",
    confirmHonest: true, confirmPhoto: Boolean(portraitUrl) && on("confirmPhoto"),
  }).returning();
  await db.update(supporterInvites).set({ supporterId: row.id }).where(eq(supporterInvites.id, claimed.id));
  await logSupporter(row.id, "supporter", "submitted", { permissions: { statement: row.permStatement, name: row.permName, portrait: row.permPortrait, affiliation: row.permAffiliation } });
  try {
    const { notifyAdmins } = await import("@/lib/outreach");
    await notifyAdmins({ kind: "supporter", title: "New supporter statement to review", body: `${name} — ${title}, ${organization}`, href: `/admin/supporters/${row.id}` });
  } catch (e) { console.error("supporter notify", e); }
  const { canReviewOnGoogle, GOOGLE_REVIEW_URL } = await import("@/lib/supporters");
  return Response.json({ ok: true, manageUrl: manageLink(manage), googleReviewUrl: canReviewOnGoogle(row.relationships) ? GOOGLE_REVIEW_URL : null });
}
