import { redirect } from "next/navigation";
import { getViewer, clerkContact } from "@/lib/viewer";
import { checkInvite, INVITE_MESSAGES } from "@/lib/invites";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { ProForm } from "./ProForm";
import { SignOutButton } from "@clerk/nextjs";

export const metadata = { title: "Finish your account" };

export default async function ProOnboarding({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/pro/sign-in");
  if (viewer.user && viewer.user.accountType !== "staff") redirect("/go");
  const { invite } = await searchParams;
  const c = await clerkContact();
  const code = invite ?? c?.invite ?? null;
  const check = code ? await checkInvite(code) : null;

  // An invitation creates a NEW professional account. If an owner is signed in on this device, stop them
  // so the pro business isn't attached to the owner's login (which shows "Partner • Owner" and the workspace chooser).
  if (viewer.admin) {
    const back = code ? `/pro/invite/${encodeURIComponent(code)}` : "/pro";
    return (
      <div className="scr">
        <TopBar title="Join Nearest as a Professional" />
        <div className="body">
          <div className="card warn" style={{ gap: 10, padding: 20 }}>
            <span className="b">You&apos;re signed in as a Nearest owner{c?.email ? ` (${c.email})` : ""}.</span>
            <span className="small">An invitation creates a new account for the professional. Sign out first, then open the invitation link again — or send the link to the professional to open on their own phone.</span>
          </div>
          <SignOutButton redirectUrl={back}><button className="btn" type="button">Sign out and continue</button></SignOutButton>
        </div>
      </div>
    );
  }

  return (
    <div className="scr">
      <TopBar title="Join Nearest as a Professional" />
      <div className="body">
        <div className="steps" aria-label="Step 2 of 2"><span className="on" /><span className="on" /></div>
        {check?.ok && (
          <div className="card ok small"><div className="row"><Icon name="check" /><span className="b grow">Founding Professional Invitation</span><span className="xs muted">{check.invite.code}</span></div></div>
        )}
        {check && !check.ok && <div className="card bad small"><span>{INVITE_MESSAGES[check.reason]}</span></div>}
        <div className="row small" style={{ gap: 8 }}>
          <span className={`tag ${c?.emailVerifiedAt ? "ok" : "warn"}`}><Icon name="mail" size="s" /> {c?.emailVerifiedAt ? "Email verified" : "Check email"}</span>
        </div>
        <h1 className="disp h2">Your details</h1>
        <ProForm firstName={c?.clerkUser.firstName ?? ""} lastName={c?.clerkUser.lastName ?? ""} invite={check?.ok ? check.invite.code : null} />
      </div>
    </div>
  );
}
