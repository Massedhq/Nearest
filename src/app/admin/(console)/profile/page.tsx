import { eq } from "drizzle-orm";
import { db, adminMembers } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { mainOwnerId } from "@/lib/partner";
import { saveMyName, saveMyPayout } from "@/app/admin/profile-actions";
import { PAYOUT_METHODS } from "@/lib/payout-methods";

export const metadata = { title: "My profile" };

export default async function MyProfile() {
  const { user } = await requireAdmin();
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
        <div className="card" style={{ gap: 12 }}>
          <span className="eyebrow">Where to send your partner payouts</span>
          <span className="small muted">{isMain ? "You approve and send partner payouts. Add yours so your own payout is recorded the same way." : "Avy sees this on Sales Track when she sends your payout. Other partners can't see it."}</span>
          <ActionForm action={saveMyPayout} submitLabel="Save payout details" buttonClass="btn sm">
            <div className="field"><label htmlFor="method">Method</label>
              <select id="method" name="method" defaultValue={me?.payoutMethod ?? ""} required><option value="" disabled>Choose</option>{PAYOUT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
            </div>
            <div className="field"><label htmlFor="handle">Send to</label><input id="handle" name="handle" defaultValue={me?.payoutHandle ?? ""} placeholder="Zelle email or phone, $cashtag, PayPal email, or bank name + last 4" required /></div>
            <div className="field"><label htmlFor="note">Note (optional)</label><input id="note" name="note" defaultValue={me?.payoutNote ?? ""} placeholder="For example: name on the account" /></div>
          </ActionForm>
          <span className="xs muted">Never enter full bank account numbers here — share those privately.</span>
        </div>
      </div>
    </>
  );
}
