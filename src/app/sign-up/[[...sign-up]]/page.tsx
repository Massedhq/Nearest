import Image from "next/image";
import { SignUp } from "@clerk/nextjs";
import { TopBar } from "@/components/TopBar";
import { getFlag } from "@/lib/settings";
import { clerkLightAppearance } from "@/lib/clerk-appearance";

export const metadata = { title: "Create account" };

export default async function StudentSignUp() {
  const open = await getFlag("status.student_registration");
  return (
    <div className="scr light">
      <TopBar title="Welcome to Nearest" back="/" />
      <div className="body">
        <Image src="/brand/nearest-wordmark-dark.png" alt="Nearest" width={150} height={100} style={{ alignSelf: "center", height: "auto" }} />
        <div className="steps" aria-label="Step 1 of 2"><span className="on" /><span /></div>
        <h1 className="disp h2" style={{ textAlign: "center" }}>Create your account</h1>
        {open ? (
          <>
            <p className="muted small p" style={{ textAlign: "center" }}>We&apos;ll email you a 6-digit code to verify your account. Your email is never shown publicly.</p>
            <div className="clerk-wrap">
              <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/onboarding" unsafeMetadata={{ door: "student" }} appearance={clerkLightAppearance} />
            </div>
          </>
        ) : (
          <div className="card warn"><span className="b">Registration is closed right now.</span><span className="small muted">Check back soon.</span></div>
        )}
      </div>
    </div>
  );
}
