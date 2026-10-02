import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudent, verifyStep } from "@/lib/student";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { sendSchoolCode, confirmSchoolCode } from "@/app/verify-actions";

export const metadata = { title: "Finish verifying" };

/** Account created with a selfie: finish with the school ID, or a school email + 6-digit code (temporary access right away). */
export default async function FinishVerifying() {
  const { user, profile } = await requireStudent();
  const step = await verifyStep(user.id, profile);
  if (step !== "/verify/finish") redirect(step ?? "/home");
  const codeSent = Boolean(profile.schoolEmail && profile.schoolEmailCodeExpires && profile.schoolEmailCodeExpires.getTime() > Date.now());
  return (
    <div className="scr">
      <TopBar title="Finish verifying" />
      <div className="body">
        <h1 className="disp h1">Finish verifying</h1>
        <p className="small muted p">Your account is created. Finish one of these to start browsing and booking.</p>

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
          <span className="small">Have your school ID now? Upload a photo of it with a new selfie.</span>
          <Link className="btn ghost" href="/verify/id">Upload my school ID</Link>
        </div>
      </div>
    </div>
  );
}
