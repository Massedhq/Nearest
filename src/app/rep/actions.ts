"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db, salesReps } from "@/db";
import { getViewer } from "@/lib/viewer";
import { repForUser } from "@/lib/reps";
import { REP_AGREEMENT_VERSION } from "@/lib/rep-agreement";
import { createPayoutAccount } from "@/lib/stripe-connect";
import { stripe } from "@/lib/stripe";
import { logActivity } from "@/lib/log";

type FormState = { error?: string; ok?: string };

/** Sign the Sales Ambassador Agreement (checkbox + typed full legal name) — required before the account is created. */
export async function signRepAgreement(_: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("token") ?? "");
  const name = String(form.get("signature") ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  if (form.get("agree") !== "on") return { error: "Check the box to agree to the Sales Ambassador Agreement." };
  if (name.length < 4 || !name.includes(" ")) return { error: "Type your full legal name (first and last) to sign." };
  if (!/^[0-9a-f]{48}$/.test(token)) return { error: "This invitation link isn't valid." };
  const rep = await db.query.salesReps.findFirst({ where: eq(salesReps.token, token) });
  if (!rep || rep.status !== "invited") return { error: "This invitation is no longer active." };
  if (rep.inviteExpiresAt.getTime() < Date.now()) return { error: "This invitation has expired. Ask for a new one." };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64) || null;
  await db.update(salesReps).set({
    agreementVersion: REP_AGREEMENT_VERSION, agreedAt: new Date(), agreedName: name,
    agreedIp: ip, agreedUserAgent: (h.get("user-agent") ?? "").slice(0, 300) || null,
  }).where(and(eq(salesReps.id, rep.id), eq(salesReps.status, "invited")));
  await logActivity({ actorUserId: null, action: "rep.agreement_signed", targetType: "sales_rep", targetId: rep.id, after: { name, version: REP_AGREEMENT_VERSION, ip } });
  revalidatePath(`/rep/join/${token}`);
  return { ok: "Signed." };
}

/** Rep's own payout setup through Stripe (bank account or debit card). */
export async function startRepPayouts() {
  const viewer = await getViewer();
  const rep = await repForUser(viewer?.user?.id);
  if (!viewer?.user || !rep) redirect("/rep");
  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  let url = "/rep?payout=error";
  try {
    let acct = rep.stripeAccountId;
    if (acct) {
      try { await stripe().accounts.retrieve(acct); } catch (e) {
        if (/No such account/i.test((e as Error).message)) {
          acct = null;
          await db.update(salesReps).set({ stripeAccountId: null, payoutsEnabled: false, payoutDestination: null }).where(eq(salesReps.id, rep.id));
        } else throw e;
      }
    }
    if (!acct) {
      const u = viewer.user;
      const a = await createPayoutAccount({ email: rep.email, metadata: { repId: rep.id, kind: "nearest_sales_rep" }, prefill: {
        firstName: u.firstName, lastName: u.lastName, email: rep.email, phone: u.phone,
        url: process.env.APP_URL || "https://usenearest.com", productDescription: "Sales ambassador referral payments from Nearest (usenearest.com).",
      } });
      acct = a.id;
      await db.update(salesReps).set({ stripeAccountId: acct }).where(eq(salesReps.id, rep.id));
    }
    url = rep.payoutsEnabled && rep.stripeAccountId === acct
      ? (await stripe().accounts.createLoginLink(acct)).url
      : (await stripe().accountLinks.create({ account: acct, refresh_url: `${base}/rep`, return_url: `${base}/rep?stripe=return`, type: "account_onboarding" })).url;
  } catch (e) {
    console.error("Rep Stripe connect failed", e);
  }
  redirect(url);
}
