import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { requireStudent } from "@/lib/student";
import { restartVerification } from "@/app/verify-actions";
import { Icon } from "@/components/Icon";

export const metadata = { title: "Verification" };

export default async function VerifyStatus() {
  const { profile, user } = await requireStudent();
  const minor = (await import("@/lib/guardian")).needsGuardian(user);
  if (profile.verificationStatus === "verified") redirect("/home");
  if (profile.verificationStatus === "unverified") redirect("/verify");
  const rejected = profile.verificationStatus === "rejected";
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">Verification</div><span className="sp" /></div>
      <div className="body" style={{ alignItems: "center", textAlign: "center" }}>
        {minor && profile.guardianStatus !== "approved" && (
          <Link className="card warn small" href="/verify/parent" style={{ textDecoration: "none", color: "inherit", width: "100%" }}>
            <span className="b">{profile.guardianStatus === "declined" ? "Your parent declined" : "Waiting for your parent to approve"}</span>
            <span className="muted">Because you&apos;re under 18, your parent or guardian also has to approve by email. Tap to resend or change their email.</span>
          </Link>
        )}
        <div style={{ width: 104, height: 104, borderRadius: 52, border: "2px solid #ECE8E1", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 40 }}>
          <Icon name={rejected ? "alert" : "clock"} size="xl" />
        </div>
        <h1 className="disp h1">{rejected ? "We couldn't verify you yet" : "Verification in review"}</h1>
        {rejected ? (
          <>
            <p className="muted p">{profile.reviewNote ?? "Your photos didn't show enough to confirm your school."}</p>
            <form action={restartVerification} style={{ width: "100%" }}><button className="btn" type="submit">Try again</button></form>
          </>
        ) : (
          <>
            <p className="muted p">A Nearest team member is checking your school ID. This usually takes less than a day. Check back here anytime.</p>
            <div className="card small" style={{ textAlign: "left", width: "100%" }}>
              <div className="row"><Icon name="check" size="s" /> School selected</div>
              <div className="row"><Icon name="check" size="s" /> School ID and selfie submitted</div>
              <div className="row"><Icon name="clock" size="s" /> Review</div>
            </div>
          </>
        )}
        <div style={{ flex: 1 }} />
        <SignOutButton redirectUrl="/"><button className="link small" type="button">Sign out</button></SignOutButton>
      </div>
    </div>
  );
}
