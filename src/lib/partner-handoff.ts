import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, partnerPages, professionalProfiles } from "@/db";
import { buildTarget, newClaimToken, CLAIM_DAYS } from "@/lib/build-mode";
import { sendEmail, emailEnabled } from "@/lib/email";
import { logActivity } from "@/lib/log";
import { SITE_URL } from "@/lib/public/site";

/**
 * Partners an owner adds by hand (Admin → Partner pages → Add a partner). Their account is made the same way as
 * "Build a profile", then the owner sends ONE of three links — all are the same one-time claim link
 * (/pro/claim/<token>, 14 days), they differ in what happens after the partner creates their password:
 *   setup   — they set up their whole profile themselves (normal setup pages, then submit for review)
 *   finish  — the owner started it, they finish the rest (same as setup, from wherever the owner stopped)
 *   approve — the owner finished everything; they review their page and tap Approve → live, share link shown
 */
export type HandoffMode = "setup" | "finish" | "approve";
export const HANDOFF_MODES: HandoffMode[] = ["setup", "finish", "approve"];

export const HANDOFF: Record<HandoffMode, { button: string; admin: string; subject: string; heading: (first: string) => string; lines: string[]; cta: string; claimIntro: string }> = {
  setup: {
    button: "Send link: they set up their profile",
    admin: "They set up everything themselves",
    subject: "Set up your Nearest Partner page",
    heading: (f) => `${f}, your Nearest Partner page is waiting.`,
    lines: ["You've been added as a Nearest Partner. Create a password, then set up your profile — your photo, services, prices, hours and portfolio — and your partner page with your links, videos and shop."],
    cta: "Set up my profile",
    claimIntro: "You've been added as a Nearest Partner. Create a password, then set up your profile and your partner page.",
  },
  finish: {
    button: "Send link: they finish setting up",
    admin: "You started it — they finish",
    subject: "Finish your Nearest Partner page",
    heading: (f) => `${f}, your Nearest Partner page is almost ready.`,
    lines: ["We started your profile and partner page for you, as you discussed. Create a password, then finish the steps that are left — everything we added is already saved."],
    cta: "Finish my profile",
    claimIntro: "We started your profile and partner page for you. Create a password, then finish the steps that are left.",
  },
  approve: {
    button: "Send link: they review and approve",
    admin: "You finished it — they approve",
    subject: "Your Nearest Partner page is ready to approve",
    heading: (f) => `${f}, your Nearest Partner page is ready.`,
    lines: ["We set up your profile and partner page for you, as you discussed. Create a password, look everything over, then tap Approve — your page goes live and your link is ready to share.", "You can change anything after you approve."],
    cta: "Review and approve my page",
    claimIntro: "We set up your profile and partner page for you. Create a password, look it over, then approve it — your page goes live and your link is ready to share.",
  },
};

export const isHandoffMode = (m: string): m is HandoffMode => (HANDOFF_MODES as string[]).includes(m);

/** The partner-page row for a partner an owner added (null for partners who applied on their own). */
export async function addedPartner(userId: string) {
  const row = await db.query.partnerPages.findFirst({ where: eq(partnerPages.userId, userId) });
  return row?.addedBy ? row : null;
}

/** Partners sent a setup/finish link use the normal setup pages instead of the "approve" welcome screen. */
export async function selfSetupPartner(userId: string) {
  const row = await addedPartner(userId);
  return Boolean(row && (row.handoff === "setup" || row.handoff === "finish"));
}

/** Emails (and returns) one of the three links. Sending again replaces the earlier link. */
export async function sendPartnerHandoff(opts: { userId: string; mode: HandoffMode; byUserId: string; byName?: string | null; email?: boolean }): Promise<{ error: string } | { ok: true; link: string; emailed: boolean; email: string }> {
  const t = await buildTarget(opts.userId);
  if (!t) return { error: "They already created their password — they sign in at usenearest.com/pro/sign-in." };
  const page = await addedPartner(opts.userId);
  if (!page) return { error: "This isn't a partner you added." };
  { const { activeHold } = await import("@/lib/enrollment-holds"); if (await activeHold({ userId: opts.userId })) return { error: "They're on enrollment hold (no sign-up within the time limit). Release them in People → Enrollment holds first, then send a new link." }; }
  if (opts.mode === "approve") {
    const { setupSteps } = await import("@/lib/pro");
    const left = (await setupSteps(opts.userId)).filter((s) => !s.done && !s.optional && s.key !== "identity");
    if (left.length) return { error: `To send the approve link, finish these steps first: ${left.map((s) => s.label).join(", ")}. Or send the "finish setting up" link instead.` };
    const { builtEnrollmentQuote } = await import("@/lib/enroll");
    const q = await builtEnrollmentQuote(t.p);
    if (!q.ok) return { error: q.reason.replace(/^Your city/, "Their city").replace(/Join the waitlist and we'll tell you/, "They'd join the waitlist —") };
  }
  const { token, hash } = newClaimToken();
  const expires = new Date(Date.now() + CLAIM_DAYS * 86400_000);
  const [row] = await db.update(professionalProfiles).set({ claimTokenHash: hash, claimSentAt: new Date(), claimExpiresAt: expires })
    .where(and(eq(professionalProfiles.userId, opts.userId), isNull(professionalProfiles.claimedAt))).returning();
  if (!row) return { error: "They already created their password — they sign in at usenearest.com/pro/sign-in." };
  await db.update(partnerPages).set({ handoff: opts.mode, handoffSentAt: new Date(), updatedAt: new Date() }).where(eq(partnerPages.userId, opts.userId));
  const link = `${SITE_URL}/pro/claim/${token}`;
  const c = HANDOFF[opts.mode];
  const r = opts.email === false ? { sent: false } : await sendEmail({
    to: t.u.email, subject: c.subject, eyebrow: "Nearest Partner", heading: c.heading(t.u.firstName ?? "Hi"),
    lines: [
      ...c.lines,
      "Your password just needs 8 or more characters. After that, sign in any time at usenearest.com/pro/sign-in with your email and password, or have a sign-in code emailed to you.",
      `This link works once and expires on ${expires.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/Chicago" })}.`,
    ],
    button: { label: c.cta, url: link },
  });
  await logActivity({ actorUserId: opts.byUserId, action: `partner.handoff_${opts.mode}`, targetType: "partner_page", targetId: opts.userId, after: { emailed: r.sent, copied: opts.email === false } });
  return { ok: true, link, emailed: r.sent || false, email: t.u.email ?? "" };
}

export const emailOn = () => emailEnabled();
