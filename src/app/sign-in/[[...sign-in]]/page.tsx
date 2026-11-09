import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import { NearestSignIn } from "@/components/NearestSignIn";
import { TopBar } from "@/components/TopBar";

export const metadata = { title: "Sign in" };

/** Only the sales-rep, Lead Contributor and partner booking pages may send someone back after sign-in; everyone else goes to /go as before. */
function repNext(raw: string | undefined) {
  // Partner pages too: someone booking a partner signs in and goes straight back to that booking (2026-11-09).
  if (raw && /^\/link\/[a-z0-9-]{2,40}(\/[A-Za-z0-9/?&=%,._-]*)?$/.test(raw)) return raw;
  return raw && /^\/(rep(\/|$|\?)|api\/rep\/accept\?token=[0-9a-f]{48}$|leads$|api\/leads\/accept\?token=[0-9a-f]{48}$)/.test(raw) ? raw : "/go";
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string }> }) {
  const next = repNext((await searchParams).redirect_url);
  const { userId } = await auth();
  if (userId) redirect(next); // already signed in → straight to their account
  return (
    <div className="scr">
      <TopBar back="/" />
      <div className="body">
        <Image src="/brand/nearest-monogram.png" alt="" width={84} height={84} />
        <h1 className="disp h1">Welcome back</h1>
        <div className="lightbox"><NearestSignIn signUpHref="/sign-up" afterSignIn={next} /></div>
      </div>
    </div>
  );
}
