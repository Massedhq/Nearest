import Image from "next/image";
import { SignIn } from "@clerk/nextjs";

export const metadata = { title: "Admin sign in" };

export default function AdminSignIn() {
  return (
    <div className="scr" style={{ justifyContent: "center" }}>
      <div className="body" style={{ flex: "none", alignItems: "center" }}>
        <Image src="/brand/nearest-monogram.png" alt="" width={84} height={84} />
        <h1 className="disp h2">Nearest Administration</h1>
        <div className="clerk-wrap">
          <SignIn routing="path" path="/admin/sign-in" signUpUrl="/admin/sign-up" forceRedirectUrl="/go" />
        </div>
      </div>
    </div>
  );
}
