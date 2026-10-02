import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { requireStudent } from "@/lib/student";
import { needsGuardian, sendGuardianInvite } from "@/lib/guardian";
import { fmtDate } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { resendGuardianEmail, changeGuardianEmail } from "@/app/guardian-actions";

export const metadata = { title: "Parent approval" };

/** Students 13–17 wait here until their parent or guardian approves by email. */
export default async function ParentApproval({ searchParams }: { searchParams: Promise<{ sent?: string; wait?: string }> }) {
  const { user, profile } = await requireStudent();
  if (!needsGuardian(user) || profile.guardianStatus === "approved") redirect("/home");
  // Students who signed up before parent emails existed get theirs now.
  if (!profile.guardianEmailSentAt && profile.guardianStatus !== "declined") await sendGuardianInvite(user, profile);
  const sp = await searchParams;
  const declined = profile.guardianStatus === "declined";
  return (
    <div className="scr">
      <TopBar title="Parent approval" />
      <div className="body">
        <h1 className="disp h1">{declined ? "Your parent didn't approve." : "Waiting for your parent to approve."}</h1>
        {declined ? (
          <div className="card bad small" style={{ gap: 6 }}>
            <span>Your parent or guardian declined, so you can&apos;t book on Nearest. If this was a mistake, they can email support@usenearest.com.</span>
          </div>
        ) : (
          <>
            <div className="card small" style={{ gap: 6 }}>
              <span>Because you&apos;re under 18, your parent or guardian has to approve Nearest before you can book. We emailed <span className="b">{profile.guardianEmail ?? "them"}</span>{profile.guardianEmailSentAt ? ` on ${fmtDate(profile.guardianEmailSentAt, { month: "short", day: "numeric" })}` : ""}.</span>
              <span className="muted">Ask them to check their inbox (and spam) for an email from Nearest and tap <span className="b">Review and approve</span>.</span>
            </div>
            {sp.sent && <div className="card ok small"><span>Sent again.</span></div>}
            {sp.wait && <div className="card warn small"><span>We just sent it — wait a couple of minutes before sending again.</span></div>}
            <form action={resendGuardianEmail}><button className="btn" type="submit" style={{ width: "100%" }}>Resend the email</button></form>
            <div className="card" style={{ gap: 8 }}>
              <span className="small b">Wrong email?</span>
              <ActionForm action={changeGuardianEmail} submitLabel="Send to this email instead" buttonClass="btn ghost sm">
                <div className="field"><label htmlFor="g-email">Parent or guardian email</label><input id="g-email" name="email" type="email" required maxLength={120} /></div>
              </ActionForm>
            </div>
            <p className="xs muted p">You can keep finishing your student verification in the meantime.</p>
          </>
        )}
        <SignOutButton redirectUrl="/"><button className="btn ghost" type="button">Sign out</button></SignOutButton>
      </div>
    </div>
  );
}
