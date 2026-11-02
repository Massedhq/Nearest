import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export const metadata = { title: "Add your Nearest Card", robots: { index: false, follow: false } };

/** Where the QR code on the back of every Nearest Card goes. Signed-in students go straight to Cards & activations. */
export default async function CardLanding() {
  const { userId } = await auth();
  if (userId) redirect("/cards");
  return (
    <div className="scr" style={{ justifyContent: "center" }}>
      <div className="body" style={{ flex: "none", maxWidth: 480, margin: "0 auto", width: "100%", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "center" }}><Image src="/brand/nearest-monogram.png" alt="Nearest" width={64} height={64} /></div>
        <h1 className="disp h2" style={{ textAlign: "center", margin: 0 }}>Add your Nearest Card</h1>
        <p className="small muted" style={{ textAlign: "center", margin: 0 }}>Your card has to be added to a Nearest student account before it can be used. Once it&apos;s saved on your account, it&apos;s safe even if you lose the card.</p>
        <div className="card small" style={{ gap: 8 }}>
          <span><span className="b">1.</span> Create your free student account (or sign in).</span>
          <span><span className="b">2.</span> Go to Account → Cards &amp; activations.</span>
          <span><span className="b">3.</span> Type the 16-digit number from the front and the code from the back, then tap Save card to my account.</span>
          <span><span className="b">4.</span> When you book, choose the card under &quot;Use a Nearest Card on this booking?&quot; — it&apos;s only used where you choose it.</span>
        </div>
        <Link className="btn" href="/sign-up">Create my student account</Link>
        <Link className="btn ghost" href="/sign-in">Sign in</Link>
        <p className="xs muted" style={{ textAlign: "center", margin: 0 }}>Nearest Cards are promotional and have no cash value. Each card works once. Questions? support@usenearest.com</p>
      </div>
    </div>
  );
}
