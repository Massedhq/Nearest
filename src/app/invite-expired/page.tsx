import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "Invite expired" };

/** A personal outreach invite link older than 24 hours. */
export default function InviteExpired() {
  return (
    <div className="scr" style={{ justifyContent: "center" }}>
      <div className="body" style={{ flex: "none", maxWidth: 480, margin: "0 auto", width: "100%", alignItems: "center", textAlign: "center" }}>
        <Image src="/brand/nearest-monogram.png" alt="Nearest" width={64} height={64} />
        <h1 className="disp h2">This invite has expired.</h1>
        <p className="small muted p">Invite links are good for 24 hours. Reply to the email you received and we&apos;ll send you a fresh one.</p>
        <Link className="link small" href="/pro">Learn about Nearest for professionals</Link>
      </div>
    </div>
  );
}
