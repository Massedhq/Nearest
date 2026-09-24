import { requirePro } from "@/lib/pro";
import { syncPro } from "@/lib/pro-stripe";
import { stripeEnabled, planCents } from "@/lib/stripe";
import { fmtDate, money } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { startMembership, startIdentity, startPayouts, finishMembership } from "@/app/pro/pay-actions";

export const metadata = { title: "Membership & payments" };

const SUB: Record<string, [string, string]> = {
  trialing: ["Free trial", "ok"], active: ["Active", "ok"], past_due: ["Past due", "bad"], unpaid: ["Unpaid", "bad"],
  canceled: ["Cancelled", "bad"], incomplete: ["Incomplete", "warn"], incomplete_expired: ["Expired", "bad"], paused: ["Paused", "warn"],
};

export default async function Payments({ searchParams }: { searchParams: Promise<{ sub?: string }> }) {
  const { profile: raw } = await requirePro();
  const { sub } = await searchParams;
  if (sub && stripeEnabled()) { try { await finishMembership(sub); } catch (e) { console.error(e); } }
  const p = await syncPro(raw);
  if (!stripeEnabled()) {
    return (<div className="scr"><TopBar title="Membership & payments" back="/pro/business" /><div className="body"><div className="card warn small"><span>Payments aren&apos;t set up yet.</span></div></div></div>);
  }
  const subState = p.subscriptionStatus ? SUB[p.subscriptionStatus] ?? [p.subscriptionStatus, ""] : ["Not started", "warn"];
  const live = ["trialing", "active"].includes(p.subscriptionStatus ?? "") && p.identityStatus === "verified" && p.payoutsEnabled;
  const rate = money(planCents(p.cohort));
  return (
    <div className="scr">
      <TopBar title="Membership & payments" back="/pro/business" />
      <div className="body">
        <div className={`card ${live ? "ok" : "warn"} small`}><span className="b">{live ? "You're all set to take bookings." : "Finish these three to take bookings."}</span>{p.reviewStatus !== "approved" && <span className="muted">Your profile also needs Nearest&apos;s approval.</span>}</div>

        <div className="card">
          <div className="row between"><span className="eyebrow">Membership</span><span className={`tag ${subState[1]}`}>{subState[0]}</span></div>
          <span className="disp h2">{p.cohort === "FOUNDING" ? "Founding Professional" : p.cohort === "SECOND" ? "Early Professional" : "Standard"}</span>
          <span className="small">{p.subscriptionId ? `${rate}/month` : `30 days free, then ${rate}/month${p.cohort === "STANDARD" ? "" : " for your first 12 months"}.`}</span>
          {p.trialEndsAt && p.subscriptionStatus === "trialing" && <span className="xs muted">Trial ends {fmtDate(p.trialEndsAt, { month: "short", day: "numeric", year: "numeric" })}</span>}
          {p.currentPeriodEnd && p.subscriptionStatus === "active" && <span className="xs muted">Renews {fmtDate(p.currentPeriodEnd, { month: "short", day: "numeric", year: "numeric" })}</span>}
          <span className="xs muted">No commission on bookings. Card-processing fees come out of each payment.</span>
          <form action={startMembership}><button className="btn sm" type="submit" style={{ width: "100%" }}>{p.subscriptionId && p.subscriptionStatus !== "canceled" ? "Manage billing" : "Start my free 30 days"}</button></form>
        </div>

        <div className="card">
          <div className="row between"><span className="eyebrow">Identity</span><span className={`tag ${p.identityStatus === "verified" ? "ok" : p.identityStatus === "rejected" ? "bad" : "warn"}`}>{p.identityStatus}</span></div>
          <span className="small">Government photo ID plus a live selfie, checked by Stripe. This is identity verification, not a background check. Your ID is never shown publicly.</span>
          {p.identityStatus !== "verified" && <form action={startIdentity}><button className="btn sm" type="submit" style={{ width: "100%" }}><Icon name="face" size="s" /> {p.identityStatus === "rejected" ? "Try again" : p.identityStatus === "pending" ? "Continue verification" : "Verify my identity"}</button></form>}
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
