import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { requirePro } from "@/lib/pro";
import { stripeEnabled } from "@/lib/stripe";
import { finalizeEntry, getEntryState, firstInStats, hasPaidEntry } from "@/lib/entry";
import { payEntry } from "./actions";

export const metadata = { title: "Join Nearest" };
export const dynamic = "force-dynamic";

/** Right after a professional creates their account: pay the entry rate, then straight into onboarding. */
export default async function Join({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session } = await searchParams;
  if (session && stripeEnabled()) {
    try { await finalizeEntry(session); } catch (e) { console.error("finalizeEntry", e); }
  }
  const { profile, viewer } = await requirePro({ allowUnpaid: true });
  if (viewer.admin?.role === "OWNER") redirect("/pro/home"); // owners never pay
  if (hasPaidEntry(profile)) redirect("/pro/home");

  const state = await getEntryState();
  const stats = state === "FIRST_IN_OPEN" ? await firstInStats() : null;

  return (
    <div className="scr">
      <TopBar title="Join Nearest" />
      <div className="body">
        {!stripeEnabled() && <div className="card warn small"><span>Payments aren&apos;t set up yet.</span></div>}

        {state === "FIRST_IN_OPEN" && (
          <>
            <span className="tag warn" style={{ alignSelf: "flex-start" }}>First In</span>
            <h1 className="disp h1">Join Nearest First In.</h1>
            <div className="card pearl">
              <span className="disp h2">$11/month</span>
              <span className="small">For your first 12 months.</span>
              <span className="xs muted">Your First In rate is locked to your account.</span>
            </div>
            {stats && !stats.open ? (
              <div className="card warn small"><span>First In is full.</span></div>
            ) : (
              <ActionForm action={payEntry} submitLabel="Pay $11 and continue"><input type="hidden" name="type" value="FIRST_IN" /></ActionForm>
            )}
            <p className="xs muted p">$11 is charged today, then $11 each month for your first 12 months. No commission on bookings.</p>
          </>
        )}

        {state === "FIRST_IN_CLOSED" && (
          <>
            <h1 className="disp h1">Enrollment is paused.</h1>
            <div className="card small"><span>First In is full. New professional enrollment opens again soon — we&apos;ll be ready for you.</span></div>
          </>
        )}

        {state === "NEXT_ENTRY_OPEN" && (
          <>
            <h1 className="disp h1">Choose your entry.</h1>
            <div className="acols even">
              <div className="card" style={{ gap: 12 }}>
                <span className="eyebrow">Professional + Student</span>
                <span className="disp h2">$16/month</span>
                <span className="small">For your first 12 months. Register one student to join with you.</span>
                <ActionForm action={payEntry} submitLabel="Pay $16 and continue">
                  <input type="hidden" name="type" value="PRO_STUDENT" />
                  <div className="grid2">
                    <div className="field"><label htmlFor="sf">Student first name</label><input id="sf" name="studentFirst" required /></div>
                    <div className="field"><label htmlFor="sl">Student last name</label><input id="sl" name="studentLast" required /></div>
                  </div>
                  <div className="field"><label htmlFor="se">Student email</label><input id="se" name="studentEmail" type="email" required /></div>
                  <div className="field"><label htmlFor="ss">Student&apos;s school (optional)</label><input id="ss" name="studentSchool" /></div>
                </ActionForm>
              </div>
              <div className="card" style={{ gap: 12 }}>
                <span className="eyebrow">General Entry</span>
                <span className="disp h2">$21/month</span>
                <span className="small">For your first 12 months. No student registration required.</span>
                <ActionForm action={payEntry} submitLabel="Pay $21 and continue"><input type="hidden" name="type" value="GENERAL" /></ActionForm>
              </div>
            </div>
            <p className="xs muted p">The first month is charged today. Your rate is locked to your account for your first 12 months. No commission on bookings.</p>
          </>
        )}
        <Link className="link small" href="/how-it-works?for=pro" style={{ textAlign: "center" }}>How Nearest works for professionals</Link>
      </div>
    </div>
  );
}
