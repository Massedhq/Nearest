import { eq } from "drizzle-orm";
import { db, adminMembers } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { mainOwnerId } from "@/lib/partner";
import { saveMyName, saveMyPayout, connectPartnerPayout } from "@/app/admin/profile-actions";
import { syncPartnerStripe } from "@/lib/partner-stripe";
import { stripeEnabled } from "@/lib/stripe";
import { Icon } from "@/components/Icon";
import { PAYOUT_METHODS } from "@/lib/payout-methods";

export const metadata = { title: "My profile" };

export default async function MyProfile({ searchParams }: { searchParams: Promise<{ stripe?: string }> }) {
  const { user } = await requireAdmin();
  const sp = await searchParams;
  if (sp.stripe === "return") { try { await syncPartnerStripe(user.id); } catch (e) { console.error(e); } }
  const [me, main] = await Promise.all([db.query.adminMembers.findFirst({ where: eq(adminMembers.userId, user.id) }), mainOwnerId()]);
  const isMain = main === user.id;
  return (
    <>
      <AdminHead eyebrow={user.email ?? ""} title="My profile" />
      <div className="acols even">
        <div className="card" style={{ gap: 12 }}>
          <span className="eyebrow">Your name</span>
          <ActionForm action={saveMyName} submitLabel="Save name" buttonClass="btn sm">
            <div className="grid2">
              <div className="field"><label htmlFor="firstName">First name</label><input id="firstName" name="firstName" defaultValue={user.firstName ?? ""} required /></div>
              <div className="field"><label htmlFor="lastName">Last name</label><input id="lastName" name="lastName" defaultValue={user.lastName ?? ""} required /></div>
            </div>
          </ActionForm>
          <span className="xs muted">Saved in Nearest and on your sign-in. Your email is changed from your sign-in account.</span>
        </div>
        <div className="card" style={{ gap: 14 }}>
          <span className="eyebrow">Where to send your partner payouts</span>
          <span className="small muted">{isMain ? "You approve and send partner payouts. Connect yours so your own payout is sent the same way." : "Avy sends your payout here from Sales Track. Other partners can't see it."}</span>

          <div className={`card${me?.stripePayoutsEnabled ? " ok" : ""}`} style={{ gap: 10 }}>
            <div className="row"><Icon name="wallet" /><div className="col g4 grow"><span className="b">Bank account or debit card</span><span className="xs muted">Through Stripe — the same secure payouts professionals use</span></div></div>
            {me?.stripePayoutsEnabled ? (
              <div className="row small"><Icon name="check" size="s" /><span className="grow">Connected{me.payoutDestination ? `: ${me.payoutDestination}` : ""}</span></div>
            ) : me?.stripeAccountId ? (
              <span className="small">Started — finish the Stripe steps to turn on payouts.</span>
            ) : null}
            {stripeEnabled() ? (
              <form action={connectPartnerPayout}><button className="btn sm" type="submit">{me?.stripePayoutsEnabled ? "Change bank account or debit card" : me?.stripeAccountId ? "Finish connecting" : "Connect payout account"}</button></form>
            ) : (
              <span className="xs muted">Stripe isn&apos;t set up on this copy of Nearest yet.</span>
            )}
            <span className="xs muted">You&apos;ll enter your routing and account number (name on the account must match) or your debit card in Stripe&apos;s secure form. Nearest never sees or stores those numbers — only something like &ldquo;Chase ••••4417&rdquo;.</span>
          </div>

          <details>
            <summary className="link small" style={{ cursor: "pointer" }}>Or be paid another way (Zelle, Cash App, PayPal, Venmo, check)</summary>
            <div style={{ marginTop: 10 }}>
              <ActionForm action={saveMyPayout} submitLabel="Save" buttonClass="btn ghost sm">
                <div className="field"><label htmlFor="method">Method</label>
                  <select id="method" name="method" defaultValue={me?.payoutMethod ?? ""} required><option value="" disabled>Choose</option>{PAYOUT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
                </div>
                <div className="field"><label htmlFor="handle">Send to</label><input id="handle" name="handle" defaultValue={me?.payoutHandle ?? ""} placeholder="Zelle email or phone, $cashtag, PayPal email…" required /></div>
                <div className="field"><label htmlFor="note">Note (optional)</label><input id="note" name="note" defaultValue={me?.payoutNote ?? ""} placeholder="For example: name on the account" /></div>
              </ActionForm>
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
