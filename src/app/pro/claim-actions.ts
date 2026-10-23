"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, users, professionalProfiles, prospects } from "@/db";
import { getViewer } from "@/lib/viewer";
import { hashClaimToken, isManagedClerkId, claimTarget } from "@/lib/build-mode";
import { logActivity } from "@/lib/log";
import type { FormState } from "@/components/ActionForm";

const clerkMsg = (e: unknown) => {
  const errs = (e as { errors?: { code?: string; longMessage?: string; message?: string }[] })?.errors;
  return { code: errs?.[0]?.code ?? "", text: errs?.[0]?.longMessage ?? errs?.[0]?.message ?? "" };
};

/**
 * Claim link → "Create a password". Creates their sign-in (their email is already confirmed — the link was sent
 * there), links it to the profile Nearest built, and returns a one-time sign-in ticket so they're signed straight in
 * without a code. Passwords only need 8 characters.
 */
export async function claimBuiltProfile(token: string, password: string): Promise<{ ticket?: string; error?: string; signIn?: string }> {
  const t = await claimTarget(token);
  if (!t) return { error: "This link has already been used or has expired. Ask the Nearest team member who set up your profile to send a new one." };
  if (typeof password !== "string" || password.length < 8) return { error: "Use at least 8 characters for your password." };
  if (password.length > 128) return { error: "That password is too long." };
  const email = (t.u.email ?? "").toLowerCase();
  if (!email) return { error: "This profile doesn't have an email address. Ask the Nearest team to fix it and send a new link." };

  const { clerkClient } = await import("@clerk/nextjs/server");
  const clerk = await clerkClient();
  let clerkId: string | null = null;
  try {
    const cu = await clerk.users.createUser({
      emailAddress: [email], password, skipPasswordChecks: true,
      firstName: t.u.firstName ?? undefined, lastName: t.u.lastName ?? undefined,
      unsafeMetadata: { door: "pro" },
    });
    clerkId = cu.id;
  } catch (e) {
    const { code, text } = clerkMsg(e);
    if (code === "form_identifier_exists" || /taken|exists/i.test(text)) {
      // They already have a Nearest sign-in with this email (the link proves they own it): use it, with this password.
      const found = await clerk.users.getUserList({ emailAddress: [email] });
      const existing = found.data[0];
      const mine = existing ? await db.query.users.findFirst({ where: eq(users.clerkUserId, existing.id) }) : null;
      if (!existing || (mine && mine.id !== t.u.id)) return { error: "This email already has its own Nearest account. Sign in with it and message Nearest support so we can connect your profile." };
      try { await clerk.users.updateUser(existing.id, { password, skipPasswordChecks: true }); } catch (e2) { console.error("claim update password", e2); return { error: "We couldn't save that password. Try a different one." }; }
      clerkId = existing.id;
    } else {
      console.error("claim create user", e);
      return { error: text || "We couldn't create your sign-in. Try again in a minute." };
    }
  }

  // Link the sign-in to the profile — once (two taps on the link can't both claim it).
  const [claimed] = await db.update(professionalProfiles).set({ claimedAt: new Date(), claimTokenHash: null })
    .where(and(eq(professionalProfiles.userId, t.u.id), isNull(professionalProfiles.claimedAt), eq(professionalProfiles.claimTokenHash, hashClaimToken(token)))).returning();
  if (!claimed) return { error: "This link was just used. Sign in with your email and password.", signIn: "/pro/sign-in" };
  await db.update(users).set({ clerkUserId: clerkId!, emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(users.id, t.u.id), sql`${users.clerkUserId} like 'managed\\_%'`));
  await logActivity({ actorUserId: t.u.id, action: "pro.claimed", targetType: "professional", targetId: t.u.id });
  try {
    const { notifyAdmins } = await import("@/lib/outreach");
    if (t.p.builtBy) await notifyAdmins({ kind: "registration", title: "Profile claimed", body: `${[t.u.firstName, t.u.lastName].filter(Boolean).join(" ")} set their password — next they accept the Terms and go live.`, href: `/admin/outreach/build/${t.u.id}` }, [t.p.builtBy]);
  } catch (e) { console.error("claim notify", e); }

  try {
    const st = await clerk.signInTokens.createSignInToken({ userId: clerkId!, expiresInSeconds: 600 });
    return { ticket: st.token };
  } catch (e) {
    console.error("claim sign-in token", e);
    return { error: "Your password is saved. Sign in with your email and password to finish.", signIn: "/pro/sign-in" };
  }
}

/**
 * First sign-in to a profile Nearest built: accept the Professional Terms (same agreements as a professional who
 * sets up their own profile). Accepting puts them live right away — they can go offline any time from Today.
 */
export async function acceptBuiltProfile(_: FormState, form: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer?.user) redirect("/pro/sign-in");
  const user = viewer.user;
  const profile = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, user.id) });
  if (!profile?.builtBy || isManagedClerkId(user.clerkUserId)) redirect("/pro/home");
  if (profile.entryPaidAt) redirect("/pro/home");
  const { PRO_TERMS_VERSION } = await import("@/lib/pro-terms");
  if (form.get("acceptTerms") !== "on" || String(form.get("termsVersion")) !== PRO_TERMS_VERSION) return { error: "Scroll through and accept the Professional Terms to continue." };
  if (form.get("inviteReward") !== "on") return { error: "Please agree to honor the $5 student invite reward." };
  const protection = (await import("@/lib/insurance")).readProtection(form);
  if (protection && "error" in protection) return { error: protection.error };
  const { builtEnrollmentQuote } = await import("@/lib/enroll");
  const q = await builtEnrollmentQuote(profile); // First In while the 750 has room
  if (!q.ok) return { error: q.reason };
  const { headers } = await import("next/headers");
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64) || null;
  const now = new Date();
  const [row] = await db.update(professionalProfiles).set({
    entryType: q.type, monthlyRateCents: q.cents, entryPaidAt: now, cohort: q.type === "FIRST_IN" ? "FOUNDING" : "SECOND", entryHoldUntil: null,
    slotCityId: q.cityId, slotCategoryId: q.categoryId,
    proTermsVersion: PRO_TERMS_VERSION, proTermsAcceptedAt: now, proTermsIp: ip,
    // Nearest built and checked this profile with them, so accepting puts it live (no separate review).
    reviewStatus: "approved", submittedAt: now, approvedAt: now, reviewNote: null, searchable: true,
    claimedAt: profile.claimedAt ?? now, claimTokenHash: null,
    ...(protection && !("error" in protection) ? { insuranceChoice: protection.choice, insuranceInterest: protection.interest, insuranceChoiceAt: now } : {}),
  }).where(and(eq(professionalProfiles.userId, user.id), isNull(professionalProfiles.entryPaidAt))).returning();
  if (!row) redirect("/pro/home");
  await logActivity({ actorUserId: user.id, action: "pro.enrolled", targetType: "professional", targetId: user.id, after: { entryType: q.type, termsVersion: PRO_TERMS_VERSION, ip, builtBy: profile.builtBy, live: true } });
  try { await (await import("@/lib/outreach")).checkCapacity(row.slotCityId, row.slotCategoryId); } catch (e) { console.error(e); }
  try {
    const hit = await db.query.prospects.findFirst({ where: eq(prospects.registeredUserId, user.id) });
    const { logProspect, notifyAdmins } = await import("@/lib/outreach");
    if (hit && hit.status !== "profile_complete") {
      await db.update(prospects).set({ status: "profile_complete", updatedAt: now }).where(eq(prospects.id, hit.id));
      await logProspect(hit.id, "profile_complete", "Claimed the profile Nearest built and accepted the Terms — live.", null);
    }
    await notifyAdmins({ kind: "profile_complete", title: "Built profile is live", body: `${[user.firstName, user.lastName].filter(Boolean).join(" ")} accepted the Terms — their profile is live${row.identityStatus === "verified" ? "" : " once their ID is checked"}.`, href: `/admin/professionals/${user.id}` });
  } catch (e) { console.error("built accept notify", e); }
  revalidatePath("/pro", "layout");
  revalidatePath("/admin", "layout");
  redirect(row.identityStatus === "unverified" || row.identityStatus === "rejected" ? "/pro/setup/identity?welcome=1" : "/pro/home");
}
