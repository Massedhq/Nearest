import Image from "next/image";
import { OwnerSignUpForm } from "@/components/OwnerSignUpForm";

export const metadata = { title: "Create owner login" };

export default function OwnerSignUp() {
  return (
    <div className="scr" style={{ justifyContent: "center" }}>
      <div className="body" style={{ flex: "none", alignItems: "center" }}>
        <Image src="/brand/nearest-monogram.png" alt="" width={84} height={84} />
        <h1 className="disp h2">Nearest Administration</h1>
        <div className="lightbox" style={{ width: "100%", maxWidth: 420 }}><OwnerSignUpForm /></div>
      </div>
    </div>
  );
}
