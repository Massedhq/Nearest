"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { db, users, adminMembers } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { validName } from "@/lib/validate";
import { logActivity } from "@/lib/log";
import type { FormState } from "@/components/ActionForm";
import { PAYOUT_METHODS } from "@/lib/payout-methods";
import { redirect } from "next/navigation";
import { stripe, origin, stripeEnabled } from "@/lib/stripe";


/** Your own name — saved in Nearest and on your sign-in (Clerk) so they always match. */
export async function saveMyName(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const first = String(form.get("firstName") ?? "").trim();
  const last = String(form.get("lastName") ?? "").trim();
  if (!validName(first) || !validName(last)) return { error: "Enter your first and last name." };
  await db.update(users).set({ firstName: first, lastName: last, updatedAt: new Date() }).where(eq(users.id, user.id));
  try {
    await (await clerkClient()).users.updateUser(user.clerkUserId, { firstName: first, lastName: last });
  } catch (e) {
    console.error("Clerk name update failed", e);
  }
  await logActivity({ actorUserId: user.id, action: "profile.name", targetType: "owner", targetId: user.email ?? user.id, before: `${user.firstName} ${user.lastName}`, after: `${first} ${last}` });
  revalidatePath("/admin", "layout");
  return { ok: "Saved." };
}

/** Where you want your Sales Track payouts sent. Only you and the main owner can see it. */
export async function saveMyPayout(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const method = String(form.get("method") ?? "");
  const handle = String(form.get("handle") ?? "").trim().slice(0, 120);
  const note = String(form.get("note") ?? "").trim().slice(0, 300);
  if (!PAYOUT_METHODS.includes(method)) return { error: "Choose how you want to be paid." };
  if (!handle) return { error: "Add where to send it (for example your Zelle email or phone, or $cashtag)." };
  if (/\d{9,19}/.test(handle.replace(/[\s-]/g, ""))) {
    return { error: "Don't enter account or card numbers here. To be paid to a bank account or debit card, use Connect payout account above — Stripe keeps those numbers secure." };
  }
  await db.update(adminMembers).set({ payoutMethod: method, payoutHandle: handle, payoutNote: note || null }).where(eq(adminMembers.userId, user.id));
  await logActivity({ actorUserId: user.id, action: "profile.payout_details", targetType: "owner", targetId: user.email ?? user.id, after: method });
  revalidatePath("/admin", "layout");
  return { ok: "Payout details saved." };
}

/**
 * Bank account or debit card payouts through Stripe. The partner enters routing/account numbers or a debit card
 * in Stripe's secure form (Stripe checks the name matches). Nearest never sees or stores the numbers.
 */
/** Turns Stripe's error into plain steps. */
function explainStripe(e: unknown) {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/signed up for Connect|Connect.*not.*enabled|connect/i.test(m) && /sign(ed)? up|enable|activate/i.test(m)) {
    return "Stripe Connect isn't turned on yet. In Stripe: Connect → Get started, choose Marketplace, then finish the platform profile. Then try again.";
  }
  if (/platform profile|responsibilit|review.*requirements|loss liabilit/i.test(m)) {
    return "Stripe needs your Connect platform profile finished. In Stripe: Settings → Connect → Platform profile — answer the questions (Marketplace, Express accounts). Then try again.";
  }
  if (/No such account/i.test(m)) return "The saved Stripe account no longer exists (often from switching between test and live keys). Tap Connect payout account again to start fresh.";
  if (/api key|Invalid API Key|authentication/i.test(m)) return "Stripe rejected the key. Check STRIPE_SECRET_KEY in Vercel (and redeploy).";
  return `Stripe said: ${m}`;
}

export async function connectPartnerPayout(_: FormState, form: FormData): Promise<FormState> {
  void form;
  const { user } = await requireAdmin();
  if (!stripeEnabled()) return { error: "Stripe isn't set up yet (STRIPE_SECRET_KEY is missing)." };
  let url: string;
  try {
    const base = await origin();
    const me = await db.query.adminMembers.findFirst({ where: eq(adminMembers.userId, user.id) });
    let acct = me?.stripeAccountId ?? null;
    // An account saved under test keys doesn't exist under live keys (and vice versa) — start over if so.
    if (acct) {
      try { await stripe().accounts.retrieve(acct); } catch (e) {
        if (/No such account/i.test((e as Error).message)) {
          acct = null;
          await db.update(adminMembers).set({ stripeAccountId: null, stripePayoutsEnabled: false, payoutDestination: null }).where(eq(adminMembers.userId, user.id));
        } else throw e;
      }
    }
    if (!acct) {
      const a = await stripe().accounts.create({
        type: "express", country: "US", email: user.email ?? undefined, business_type: "individual",
        capabilities: { transfers: { requested: true } }, metadata: { partnerUserId: user.id, kind: "nearest_partner" },
      });
      acct = a.id;
      await db.update(adminMembers).set({ stripeAccountId: acct }).where(eq(adminMembers.userId, user.id));
      await logActivity({ actorUserId: user.id, action: "profile.payout_stripe_started", targetType: "owner", targetId: user.email ?? user.id });
    }
    if (me?.stripePayoutsEnabled && me.stripeAccountId === acct) {
      url = (await stripe().accounts.createLoginLink(acct)).url; // manage bank account or debit card on Stripe
    } else {
      url = (await stripe().accountLinks.create({ account: acct, refresh_url: `${base}/admin/profile`, return_url: `${base}/admin/profile?stripe=return`, type: "account_onboarding" })).url;
    }
  } catch (e) {
    console.error("Partner Stripe connect failed", e);
    await logActivity({ actorUserId: user.id, action: "profile.payout_stripe_failed", targetType: "owner", targetId: user.email ?? user.id, after: (e as Error).message });
    return { error: explainStripe(e) };
  }
  redirect(url); // outside try so Next.js can perform the redirect
}
