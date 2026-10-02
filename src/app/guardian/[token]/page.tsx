import Image from "next/image";
import Link from "next/link";
import { profileByGuardianToken, ageFromDob } from "@/lib/guardian";
import { ActionForm } from "@/components/ActionForm";
import { approveGuardian, declineGuardian } from "@/app/guardian-actions";

export const metadata = { title: "Parent approval" };

/** Public page from the parent's email: approve (checkbox + typed name) or decline. */
export default async function GuardianApprove({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const hit = await profileByGuardianToken(token);
  const first = hit?.user.firstName ?? "Your student";
  const age = hit ? ageFromDob(hit.user.dateOfBirth) : null;
  const status = hit?.profile.guardianStatus;
  return (
    <div className="scr" style={{ justifyContent: "center" }}>
      <div className="body" style={{ flex: "none", maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <Image src="/brand/nearest-monogram.png" alt="Nearest" width={64} height={64} />
        <span className="eyebrow">Parent or guardian approval</span>
        {!hit ? (
          <div className="card warn small"><span>This link isn&apos;t valid anymore. If you need help, email support@usenearest.com.</span></div>
        ) : status === "approved" ? (
          <><h1 className="disp h2">Thank you — you&apos;ve approved {first}.</h1><p className="small muted p">{first} can now use Nearest. Questions anytime: support@usenearest.com.</p></>
        ) : status === "declined" ? (
          <><h1 className="disp h2">You declined.</h1><p className="small muted p">{first} can&apos;t book on Nearest. If this was a mistake, email support@usenearest.com.</p></>
        ) : (
          <>
            <h1 className="disp h2">{first}{age ? ` (age ${age})` : ""} wants to use Nearest.</h1>
            <div className="card small" style={{ gap: 6 }}>
              <span>Nearest is a booking platform where verified students book services with licensed, ID-checked professionals.</span>
              <span className="muted">Every student verifies with their school ID and a selfie. Addresses are shared only on the appointment day, payments are held until the service is finished, and phone numbers and emails are never shared. Some services are 18+ only and can&apos;t be booked by {first}.</span>
              <span className="muted">Please read the <Link className="link" href="/terms" target="_blank">Terms</Link> and <Link className="link" href="/privacy" target="_blank">Privacy Policy</Link>. As {first}&apos;s parent or guardian, you&apos;re responsible for their use of Nearest and payments made on their account.</span>
            </div>
            <ActionForm action={approveGuardian} submitLabel={`Approve ${first}`}>
              <input type="hidden" name="token" value={token} />
              <label className="check small" style={{ alignItems: "flex-start" }}><input type="checkbox" name="agree" required /><span>I am {first}&apos;s parent or legal guardian. I have read and agree to the Nearest Terms and Privacy Policy on their behalf, and I give permission for them to use Nearest.</span></label>
              <div className="field"><label htmlFor="g-name">Type your full name to sign</label><input id="g-name" name="name" autoComplete="name" required minLength={4} maxLength={120} placeholder="First and last name" /></div>
            </ActionForm>
            <form action={declineGuardian}><input type="hidden" name="token" value={token} /><button className="link small" type="submit">I don&apos;t approve / this wasn&apos;t me</button></form>
          </>
        )}
      </div>
    </div>
  );
}
