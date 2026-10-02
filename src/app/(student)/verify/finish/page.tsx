import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudent, verifyStep } from "@/lib/student";
import { Icon } from "@/components/Icon";
import { VerifyExits } from "@/components/VerifyExits";
import { ActionForm } from "@/components/ActionForm";
import { sendSchoolCode, confirmSchoolCode, finishVerifyLater } from "@/app/verify-actions";

export const metadata = { title: "Finish verifying" };

/** Account created with a selfie: finish with the school ID, or a school email + 6-digit code (temporary access right away). */
export default async function FinishVerifying({ searchParams }: { searchParams: Promise<{ later?: string }> }) {
  const later = (await searchParams).later === "1";
  const { user, profile } = await requireStudent();
  const step = await verifyStep(user.id, profile);
  if (step !== "/verify/finish") redirect(step ?? "/home");
  const codeSent = Boolean(profile.schoolEmail && profile.schoolEmailCodeExpires && profile.schoolEmailCodeExpires.getTime() > Date.now());
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">Finish verifying</div><Link className="iconbtn" href="/account" aria-label="My account"><Icon name="user" /></Link></div>
      <div className="body">
        <h1 className="disp h1">Finish verifying</h1>
        {profile.verifyLaterAt
          ? <div className={`card ${later ? "ok" : ""} small`}><span><span className="b">Your account is set up.</span> Finish one of these whenever you&apos;re ready to start browsing and booking — we&apos;ll remind you.</span></div>
          : <p className="small muted p">Your account is created. Finish one of these to start browsing and booking.</p>}

        <div className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Fastest — your school email</span>
          <span className="small">We&apos;ll send a 6-digit code to your school email. Enter it and you get access right away while Nearest finishes reviewing.</span>
          <ActionForm action={sendSchoolCode} submitLabel={codeSent ? "Send a new code" : "Send my code"} buttonClass={codeSent ? "btn ghost sm" : "btn"}>
            <div className="field"><label htmlFor="se-email">School email</label><input id="se-email" name="email" type="email" required maxLength={120} defaultValue={profile.schoolEmail ?? ""} placeholder="you@yourschool.net" /></div>
          </ActionForm>
          {codeSent && (
            <ActionForm action={confirmSchoolCode} submitLabel="Confirm my school email">
              <div className="field"><label htmlFor="se-code">6-digit code sent to {profile.schoolEmail}</label><input id="se-code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></div>
            </ActionForm>
          )}
          <span className="xs muted">Personal emails like Gmail, Yahoo, AOL, Hotmail or Zoho can&apos;t be used.</span>
        </div>

        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">Or — your school ID</span>
          <span className="small">Have your school ID now? Take or upload a photo of it — your selfie is already saved.</span>
          <Link className="btn ghost" href="/verify/id">Upload my school ID</Link>
        </div>

        {!profile.verifyLaterAt && (
          <form action={finishVerifyLater} className="col" style={{ gap: 6 }}>
            <button className="btn ghost" type="submit">I&apos;ll finish verifying later</button>
            <span className="xs muted" style={{ textAlign: "center" }}>No school email or ID right now? Finish setting up your account, and come back to verify anytime.</span>
          </form>
        )}
        <VerifyExits />
      </div>
    </div>
  );
}
