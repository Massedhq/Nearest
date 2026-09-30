import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getFlag } from "@/lib/settings";

export default async function ProLanding() {
  const { userId } = await auth();
  if (userId) redirect("/go");
  const open = await getFlag("status.pro_registration");
  return (
    <div className="scr">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 22px", gap: 10 }}>
        <Image src="/brand/nearest-wordmark.png" alt="Nearest" width={340} height={227} priority style={{ width: "100%", maxWidth: 340, height: "auto" }} />
        <span className="eyebrow">For professionals</span>
        <p className="muted small" style={{ textAlign: "center", margin: 0, maxWidth: 300 }}>
          Your calendar, clients, model calls and earnings in one place.
        </p>
      </div>
      <div className="body" style={{ flex: "none", gap: 12 }}>
        <Link className="btn" href="/pro/sign-in">Sign in</Link>
        {open && <Link className="btn ghost" href="/pro/sign-up">Register as a professional</Link>}
        <p className="xs muted" style={{ textAlign: "center", margin: "6px 0 0" }}>Have an invitation? Open the link your Nearest rep sent you.</p>
      </div>
    </div>
  );
}
