import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export default async function Welcome() {
  const { userId } = await auth();
  if (userId) redirect("/go");
  return (
    <div className="scr">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 22px" }}>
        <Image src="/brand/nearest-wordmark.png" alt="Nearest" width={380} height={253} priority style={{ width: "100%", maxWidth: 380, height: "auto" }} />
        <p className="disp" style={{ fontSize: 24, textAlign: "center", margin: "-8px 0 0", fontStyle: "italic" }}>Find who&apos;s available near you.</p>
        <p className="muted small" style={{ textAlign: "center", margin: "14px 0 0", maxWidth: 290 }}>
          Book, pay and finish your appointment in one place.
        </p>
      </div>
      <div className="body" style={{ flex: "none", gap: 12 }}>
        <Link className="btn" href="/sign-up">Create account</Link>
        <Link className="btn ghost" href="/sign-in">Sign in</Link>
        <p className="xs muted" style={{ textAlign: "center", margin: "6px 0 0" }}>By continuing you agree to the Nearest Terms and Privacy Policy.</p>
      </div>
    </div>
  );
}
