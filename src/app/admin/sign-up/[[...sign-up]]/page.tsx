import Image from "next/image";
import { SignUp } from "@clerk/nextjs";

export const metadata = { title: "Owner sign up" };

// Only emails listed in OWNER_EMAILS become admins; anyone else is sent back to the public app.
export default function AdminSignUp() {
  return (
    <div className="scr" style={{ justifyContent: "center" }}>
      <div className="body" style={{ flex: "none", alignItems: "center" }}>
        <Image src="/brand/nearest-monogram.png" alt="" width={84} height={84} />
        <h1 className="disp h2">Create your owner login</h1>
        <p className="muted small p" style={{ textAlign: "center" }}>Use the email that&apos;s on the Nearest owner list.</p>
        <div className="clerk-wrap">
          <SignUp routing="path" path="/admin/sign-up" signInUrl="/admin/sign-in" forceRedirectUrl="/go" unsafeMetadata={{ door: "admin" }} />
        </div>
      </div>
    </div>
  );
}
