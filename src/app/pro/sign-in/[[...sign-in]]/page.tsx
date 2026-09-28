import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import { NearestSignIn } from "@/components/NearestSignIn";
import { TopBar } from "@/components/TopBar";

export const metadata = { title: "Sign in" };

export default async function ProSignIn() {
  const { userId } = await auth();
  if (userId) redirect("/go"); // already signed in → straight to their account
  return (
    <div className="scr">
      <TopBar back="/pro" />
      <div className="body">
        <Image src="/brand/nearest-monogram.png" alt="" width={84} height={84} />
        <h1 className="disp h1">Welcome back</h1>
        <div className="lightbox"><NearestSignIn signUpHref="/pro/sign-up" signUpLabel="Join as a professional" /></div>
      </div>
    </div>
  );
}
