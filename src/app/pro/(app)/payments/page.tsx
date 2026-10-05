import { ENTRY, isManagedEntry, type EntryType } from "@/lib/entry";
import { duesStatus } from "@/lib/dues";
import { requirePro } from "@/lib/pro";
import { syncPro } from "@/lib/pro-stripe";
import { stripeEnabled, planCents } from "@/lib/stripe";
import { fmtDate, money } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { startMembership, startPayouts, finishMembership } from "@/app/pro/pay-actions";
import { submitProIdDocs } from "@/app/pro/id-actions";
import { IdCapture } from "@/components/IdCapture";
import { SubscriptionDetails } from "@/components/SubscriptionDetails";

export const metadata = { title: "Membership & payments" };

const SUB: Record<string, [string, string]> = {
  trialing: ["Active", "ok"], active: ["Active", "ok"], past_due: ["Past due", "bad"], unpaid: ["Unpaid", "bad"],
  canceled: ["Cancelled", "bad"], incomplete: ["Incomplete", "warn"], incomplete_expired: ["Expired", "bad"], paused: ["Paused", "warn"],
};

export default async function Payments({ searchParams }: { searchParams: Promise<{ sub?: string }> }) {
  const { profile: raw, viewer } = await requirePro();
  const owner = viewer.admin?.role === "OWNER"; // owners' own businesses have no membership fee
  const { sub } = await searchParams;
  if (sub && stripeEnabled()) { try { await finishMembership(sub); } catch (e) { console.error(e); } }
  const p = await syncPro(raw);
  if (!stripeEnabled()) {
    return (<div className="scr"><TopBar title="Membership & payments" back="/pro/business" /><div className="body"><div className="card warn small"><span>Payments aren&apos;t set up yet.</span></div></div></div>);
  }
  const subState = p.subscriptionStatus ? SUB[p.subscriptionStatus] ?? [p.subscriptionStatus, ""] : ["Not started", "warn"];
  const live = (owner || ["trialing", "active"].includes(p.subscriptionStatus ?? "")) && !p.membershipPausedAt && p.identityStatus === "verified";
  const rate = money(planCents(p.cohort));
  const managed = !owner && isManagedEntry(p.entryType); // Ambassador (free) or pay-from-bookings — no card, no Stripe subscription
  const dues = managed && p.entryType === "BOOKING_PAID" ? await duesStatus(p) : null;
  return (
    <div className="scr">
      <TopBar title="Membership & payments" back="/pro/business" />
      <div className="body">
        <div className={`card ${live ? "ok" : "warn"} small`}><span className="b">{live ? "You're all set to take bookings." : "Finish your membership and ID check to take bookings."}</span>{live && !p.payoutsEnabled && <span className="muted">Set up payouts whenever you're ready — anything you earn before then is held for you and sent automatically once you connect.</span>}{p.reviewStatus !== "approved" && <span className="muted">Your profile also needs Nearest&apos;s approval.</span>}</div>

        {owner ? (
          <div className="card">
            <div className="row between"><span className="eyebrow">Membership</span><span className="tag ok">Owner — free</span></div>
            <span className="disp h2">Nearest owner business</span>
            <span className="small">As a Nearest owner, your business has no entry fee and no monthly membership. Just finish your ID check and payouts below.</span>
            <span className="xs muted">Card-processing fees still come out of each student payment.</span>
          </div>
        ) : !p.subscriptionId && !managed ? (
          <div className="card">
            <div className="row between"><span className="eyebrow">Membership</span><span className="tag">Not yet activated</span></div>
            <span className="disp h2">{money(p.monthlyRateCents ?? 1100)}/month</span>
            <span className="small">Nothing to pay now. As agreed in your Professional Terms, your membership activates when you accept your first booking — you&apos;ll see an Activate &amp; accept button right on the request. Your 12-month rate starts that day.</span>
            {p.proTermsAcceptedAt && <span className="xs muted">Terms version {p.proTermsVersion} accepted {p.proTermsAcceptedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" })}.</span>}
          </div>
        ) : managed ? (
          <div className="card">
            <div className="row between"><span className="eyebrow">Membership</span><span className="tag ok">{p.entryType === "AMBASSADOR" ? "Free" : "Active"}</span></div>
            {p.entryType === "AMBASSADOR" ? (
              <>
                <span className="disp h2">Ambassador — free</span>
                <span className="small">Your account is free: no sign-up fee and no monthly membership. Thank you for bringing other professionals to Nearest.</span>
              </>
            ) : (
              <>
                <span className="disp h2">{money(dues!.rate)}/month, from your bookings</span>
                <span className="small">Nothing is charged to a card. Each month, Nearest keeps {money(dues!.rate)} from your booking earnings, then the rest of the month is all yours. A month with no bookings costs nothing.</span>
                <div className="bar"><i style={{ width: `${Math.round((dues!.collected / dues!.rate) * 100)}%` }} /></div>
                <span className="small b">{dues!.left === 0 ? `This month is covered — ${money(dues!.rate)} collected.` : `This month: ${money(dues!.collected)} of ${money(dues!.rate)} collected so far.`}</span>
              </>
            )}
            {p.entryPaidAt && <span className="xs muted">Joined {fmtDate(p.entryPaidAt, { month: "short", day: "numeric", year: "numeric" })}</span>}
            {p.membershipPausedAt && <span className="small b">Paused by Nearest — students can&apos;t book you while it&apos;s paused. Questions? hello@usenearest.com</span>}
            <span className="xs muted">No commission on bookings. Card-processing fees come out of each payment.</span>
          </div>
        ) : (
        <div className="card">
            <div className="row between"><span className="eyebrow">Membership</span><span className={`tag ${subState[1]}`}>{subState[0]}</span></div>
            <span className="disp h2">{p.entryType && p.entryType in ENTRY ? ENTRY[p.entryType as EntryType].label : "Standard"}</span>
            <span className="small">{money(p.monthlyRateCents ?? planCents(p.cohort))}/month{p.entryType ? " for your first 12 months — locked to your account" : ""}.</span>
            {p.entryPaidAt && <span className="xs muted">Joined {fmtDate(p.entryPaidAt, { month: "short", day: "numeric", year: "numeric" })}</span>}
            {p.membershipPausedAt ? (
              <span className="small b">Paused by Nearest — you won&apos;t be charged, and students can&apos;t book you while it&apos;s paused. Questions? hello@usenearest.com</span>
            ) : p.membershipEndsAt ? (
              <span className="small b">Ends {fmtDate(p.membershipEndsAt, { month: "short", day: "numeric", year: "numeric" })}. You won&apos;t be charged again.</span>
            ) : p.currentPeriodEnd && p.subscriptionStatus === "active" ? (
              <span className="xs muted">Renews {fmtDate(p.currentPeriodEnd, { month: "short", day: "numeric", year: "numeric" })}</span>
            ) : null}
            <span className="xs muted">No commission on bookings. Card-processing fees come out of each payment.</span>
            <form action={startMembership}><button className="btn sm" type="submit" style={{ width: "100%" }}>{p.subscriptionId && p.subscriptionStatus !== "canceled" ? "Manage billing" : "Restart membership"}</button></form>
          </div>
          )}
        {!owner && !managed && p.stripeCustomerId && <SubscriptionDetails customerId={p.stripeCustomerId} subscriptionId={p.subscriptionId} planLabel={p.entryType && p.entryType in ENTRY ? ENTRY[p.entryType as EntryType].label : "Standard"} standardCents={3000} />}

        <div className="card">
          <div className="row between"><span className="eyebrow">Identity</span><span className={`tag ${p.identityStatus === "verified" ? "ok" : p.identityStatus === "rejected" ? "bad" : "warn"}`}>{p.identityStatus === "verified" ? "Verified" : p.identityStatus === "pending" ? "Checking" : p.identityStatus === "rejected" ? "Try again" : "To do"}</span></div>
          {p.identityStatus === "verified" ? (
            <span className="small">Your ID is verified.</span>
          ) : (
            <>
              {p.identityStatus === "rejected" && <div className="card bad small" style={{ gap: 2 }}><span className="b">Please retake your ID photos</span><span>{p.identityNote ?? "We couldn't confirm your ID from those photos."}</span></div>}
              <span className="small">A photo of your driver&apos;s license or state ID, plus a live selfie. Nearest checks that they match — it&apos;s not a background check, your ID is never shown publicly, and the photos are deleted after review.</span>
              {p.identityStatus === "pending" ? (
                <>
                  <span className="small b">Thanks — we&apos;re checking your ID, usually within a day.</span>
                  <details><summary className="link small">Send new photos</summary><IdCapture action={submitProIdDocs} idName="gov_id" idLabel="Photo of your driver's license or state ID" idHint="Your name and photo clearly visible" submitLabel="Send new photos" /></details>
                </>
              ) : (
                <IdCapture action={submitProIdDocs} idName="gov_id" idLabel="Photo of your driver's license or state ID" idHint="Your name and photo clearly visible" submitLabel="Send for review" />
              )}
            </>
          )}
        </div>

        <div className="card">
          <div className="row between"><span className="eyebrow">Payouts</span><span className={`tag ${p.payoutsEnabled ? "ok" : "warn"}`}>{p.payoutsEnabled ? "Ready" : p.stripeAccountId ? "In progress" : "Not set up"}</span></div>
          <span className="small">Connect your bank so released payments reach you. Setup is handled securely by Stripe.</span>
          <form action={startPayouts}><button className="btn sm" type="submit" style={{ width: "100%" }}>{p.payoutsEnabled ? "Open payout dashboard" : p.stripeAccountId ? "Continue payout setup" : "Set up payouts"}</button></form>
        </div>
      </div>
    </div>
  );
}
