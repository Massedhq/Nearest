import { desc, eq } from "drizzle-orm";
import { db, appeals } from "@/db";
import { requirePro } from "@/lib/pro";
import { proStanding, confirmFinePayment } from "@/lib/enforcement";
import { stripeEnabled } from "@/lib/stripe";
import { fmtDate, money } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { payFine } from "@/app/pro/fine-actions";
import { submitAppeal } from "@/app/appeal-actions";

export const metadata = { title: "Account status" };

export default async function AccountStatus({ searchParams }: { searchParams: Promise<{ fine_session?: string }> }) {
  const { user } = await requirePro();
  const { fine_session } = await searchParams;
  if (fine_session && stripeEnabled()) { try { await confirmFinePayment(fine_session); } catch (e) { console.error(e); } }
  const st = await proStanding(user.id);
  const myAppeals = await db.select().from(appeals).where(eq(appeals.userId, user.id)).orderBy(desc(appeals.createdAt)).limit(10);
  const clean = !st.suspendedUntil && st.fines.length === 0;
  return (
    <div className="scr">
      <TopBar title="Account status" back="/pro/business" />
      <div className="body">
        {clean && <div className="card ok"><div className="row"><Icon name="check" /><span className="b grow">Your account is in good standing.</span></div></div>}
        {st.suspendedUntil && (
          <div className="card bad"><div className="row"><Icon name="lock" /><span className="b grow">Suspended until {fmtDate(st.suspendedUntil, { month: "long", day: "numeric", year: "numeric" })}</span></div>
            <span className="small">Your profile is hidden from students during a suspension.</span></div>
        )}
        {st.fines.map((f) => {
          const overdue = f.dueAt.getTime() < Date.now();
          return (
            <div key={f.id} className={`card ${overdue ? "bad" : "warn"}`} style={{ padding: 20 }}>
              <div className="row"><Icon name="alert" /><span className="b grow">{money(f.amountCents)} Fine Outstanding</span></div>
              <p className="p small">
                {overdue ? "This fine is past due, so your profile is inactive and hidden from search until it's paid."
                  : `Payment required by ${fmtDate(f.dueAt, { month: "long", day: "numeric" })}. Unpaid fines make your profile inactive; a balance unpaid for 30 days may lead to account removal.`}
              </p>
              <span className="xs muted">{f.reason} • issued {fmtDate(f.createdAt)}</span>
              {stripeEnabled() && <form action={payFine}><input type="hidden" name="id" value={f.id} /><button className="btn gold" type="submit">Pay {money(f.amountCents)}</button></form>}
              <details><summary className="link small" style={{ cursor: "pointer" }}>Request review of this fine</summary>
                <ActionForm action={submitAppeal} submitLabel="Submit for review" buttonClass="btn ghost sm">
                  <input type="hidden" name="kind" value="pro_fine" /><input type="hidden" name="targetId" value={f.id} />
                  <div className="field"><label htmlFor={`ex_${f.id}`}>Why should we review this?</label><textarea id={`ex_${f.id}`} name="explanation" /></div>
                </ActionForm>
              </details>
            </div>
          );
        })}
        <div className="card">
          <div className="row between"><span className="b">Confirmed incidents</span><span className="b">{st.incidents} of {st.limit}</span></div>
          <div className="bar gold"><i style={{ width: `${Math.min(100, ((st.incidents % st.limit || (st.incidents ? st.limit : 0)) / st.limit) * 100)}%` }} /></div>
          <span className="xs muted">Every {st.limit === 3 ? "3rd" : `${st.limit}th`} confirmed incident suspends your account for 30 days.</span>
        </div>
        {st.suspendedUntil && (
          <details className="card"><summary className="b" style={{ cursor: "pointer" }}>Request review of this suspension</summary>
            <ActionForm action={submitAppeal} submitLabel="Submit for review" buttonClass="btn ghost sm">
              <input type="hidden" name="kind" value="pro_suspension" />
              <div className="field"><label htmlFor="exs">Why should we review this?</label><textarea id="exs" name="explanation" /></div>
            </ActionForm>
          </details>
        )}
        {myAppeals.length > 0 && <h3 className="eyebrow p">Your reviews</h3>}
        {myAppeals.map((a) => (
          <div key={a.id} className="item small"><span className="grow">{a.kind === "pro_fine" ? "Fine" : "Suspension"} • {fmtDate(a.createdAt)}</span><span className={`tag ${a.status === "overturned" ? "ok" : a.status === "upheld" ? "bad" : "warn"}`}>{a.status.replace("_", " ")}</span></div>
        ))}
      </div>
    </div>
  );
}
