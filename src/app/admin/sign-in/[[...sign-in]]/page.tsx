import Image from "next/image";
import { SignIn } from "@clerk/nextjs";
import { clerkNoSignUpAppearance } from "@/lib/clerk-appearance";

export const metadata = { title: "Admin sign in" };

// Sign in only. Owner accounts are created in the Clerk dashboard (Users > Create user).
export default function AdminSignIn() {
  return (
    <div className="scr" style={{ justifyContent: "center" }}>
      <div className="body" style={{ flex: "none", alignItems: "center" }}>
        <Image src="/brand/nearest-monogram.png" alt="" width={84} height={84} />
        <h1 className="disp h2">Nearest Administration</h1>
        <div className="clerk-wrap">
          <SignIn routing="path" path="/admin/sign-in" forceRedirectUrl="/go" withSignUp={false} appearance={clerkNoSignUpAppearance} />
        </div>
      </div>
    </div>
  );
}
