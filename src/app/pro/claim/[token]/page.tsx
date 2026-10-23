import Image from "next/image";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { SignOutButton } from "@clerk/nextjs";
import { db, users } from "@/db";
import { claimTarget } from "@/lib/build-mode";
import { ClaimProfileForm } from "@/components/ClaimProfileForm";

export const metadata = { title: "Claim your Nearest profile" };
export const dynamic = "force-dynamic";

/** Public: the link Nearest emails a professional whose profile it built for them. They only create a password. */
export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await claimTarget(token);
  const top = <div className="top"><span className="sp" /><div className="t xs muted">usenearest.com • your profile</div><span className="sp" /></div>;
  if (!t) {
    return (
      <div className="scr">
        {top}
        <div className="body">
          <Image src="/brand/nearest-monogram.png" alt="" width={84} height={84} />
          <h1 className="disp h2">This link has already been used or has expired</h1>
          <div className="card small"><span>If you already made your password, just sign in. Otherwise ask the Nearest team member who set up your profile to send you a new link.</span></div>
          <Link className="btn" href="/pro/sign-in">Sign in</Link>
        </div>
      </div>
    );
  }
  // Never claimed within 30 days → registration on hold until an owner releases it.
  const { activeHold, recordAttempt, CLOSED_MESSAGE, CLOSED_TITLE } = await import("@/lib/enrollment-holds");
  const held = await activeHold({ userId: t.u.id });
  if (held) {
    await recordAttempt(held, "claim_link", "Opened their claim link");
    return (
      <div className="scr">
        {top}
        <div className="body">
          <Image src="/brand/nearest-monogram.png" alt="" width={84} height={84} />
          <h1 className="disp h2">{CLOSED_TITLE}</h1>
          <div className="card small"><span>{CLOSED_MESSAGE}</span></div>
          <span className="xs muted">Your information is saved — you won&apos;t need to start over when enrollment opens for you.</span>
        </div>
      </div>
    );
  }
  const builder = t.p.builtBy ? await db.query.users.findFirst({ where: eq(users.id, t.p.builtBy), columns: { firstName: true } }) : null;
  const { userId } = await auth();
  return (
    <div className="scr">
      {top}
      <div className="body">
        <Image src="/brand/nearest-monogram.png" alt="" width={84} height={84} />
        <h1 className="disp h1">Welcome to Nearest, {t.u.firstName ?? "there"}.</h1>
        <p className="small p">{builder?.firstName ?? "The Nearest team"} set up your professional profile{t.p.businessName ? ` for ${t.p.businessName}` : ""}, as you discussed. Create a password to get in — then review and accept the Professional Terms, and your profile goes live for students near you.</p>
        {userId ? (
          <div className="card warn small" style={{ gap: 8 }}>
            <span>Someone is already signed in to Nearest in this browser. Sign out first, then open your link again — or open it on your own phone.</span>
            <SignOutButton redirectUrl={`/pro/claim/${token}`}><button className="btn sm" type="button">Sign out</button></SignOutButton>
          </div>
        ) : (
          <div className="lightbox"><ClaimProfileForm token={token} email={t.u.email ?? ""} /></div>
        )}
      </div>
    </div>
  );
}
