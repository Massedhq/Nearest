import Image from "next/image";
import { SignIn } from "@clerk/nextjs";
import { TopBar } from "@/components/TopBar";

export const metadata = { title: "Sign in" };

export default function ProSignIn() {
  return (
    <div className="scr">
      <TopBar back="/pro" />
      <div className="body">
        <Image src="/brand/nearest-monogram.png" alt="" width={84} height={84} />
        <h1 className="disp h1">Welcome back</h1>
        <div className="clerk-wrap">
          <SignIn routing="path" path="/pro/sign-in" signUpUrl="/pro/sign-up" forceRedirectUrl="/go" />
        </div>
      </div>
    </div>
  );
}
