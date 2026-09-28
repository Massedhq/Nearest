import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import { NearestSignIn } from "@/components/NearestSignIn";

export const metadata = { title: "Admin sign in" };

// Sign in only. Owner accounts are created in the Clerk dashboard (Users > Create user).
export default async function AdminSignIn() {
  const { userId } = await auth();
  if (userId) redirect("/go"); // already signed in → straight to their account
  return (
    <div className="scr" style={{ justifyContent: "center" }}>
      <div className="body" style={{ flex: "none", alignItems: "center" }}>
        <Image src="/brand/nearest-monogram.png" alt="" width={84} height={84} />
        <h1 className="disp h2">Nearest Administration</h1>
        <div className="lightbox" style={{ width: "100%", maxWidth: 420 }}><NearestSignIn signUpHref="/admin/sign-up" signUpLabel="Create your owner login" /></div>
      </div>
    </div>
  );
}
