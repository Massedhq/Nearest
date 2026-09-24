import { SignUp } from "@clerk/nextjs";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { checkInvite, INVITE_MESSAGES } from "@/lib/invites";
import { getFlag } from "@/lib/settings";

export const metadata = { title: "Join as a professional" };

export default async function ProSignUp({ searchParams }: { searchParams: Promise<{ invite?: string; ref?: string }> }) {
  const { invite, ref } = await searchParams;
  const check = invite ? await checkInvite(invite) : null;
  const regOpen = await getFlag("status.pro_registration");
  const code = check?.ok ? check.invite.code : null;
  const canSignUp = Boolean(code) || regOpen;
  const redirectTo = code ? `/pro/onboarding?invite=${encodeURIComponent(code)}` : "/pro/onboarding";

  return (
    <div className="scr">
      <TopBar title="Join Nearest as a Professional" back={code ? `/pro/invite/${code}` : "/pro"} />
      <div className="body">
        <div className="steps" aria-label="Step 1 of 2"><span className="on" /><span /></div>
        {code && (
          <div className="card ok small"><div className="row"><Icon name="check" /><span className="b grow">Founding Professional Invitation</span><span className="xs muted">Pricing applied</span></div></div>
        )}
        {check && !check.ok && <div className="card bad small"><span>{INVITE_MESSAGES[check.reason]}</span></div>}
        {canSignUp ? (
          <>
            <p className="muted small p">We&apos;ll email you a 6-digit code to verify your account. Your email is never shown to customers.</p>
            <div className="clerk-wrap">
              <SignUp routing="path" path="/pro/sign-up" signInUrl="/pro/sign-in" forceRedirectUrl={redirectTo} unsafeMetadata={{ door: "pro", invite: code ?? undefined, ref: ref?.slice(0, 20) || undefined }} />
            </div>
          </>
        ) : (
          <div className="card warn"><span className="b">Registration is closed.</span><span className="small muted">Professional registration is by invitation right now.</span></div>
        )}
      </div>
    </div>
  );
}
