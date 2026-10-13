import Image from "next/image";
import Link from "next/link";
import { openInvite, PERSONAL_DISCLAIMER } from "@/lib/supporters";
import { SupporterForm } from "@/components/SupporterForm";

export const metadata = { title: "Share your perspective", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Public: an invited educator/supporter shares a statement. No Nearest account needed. */
export default async function SupporterInvite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const open = await openInvite(token);
  return (
    <div className="scr">
      <div className="body" style={{ gap: 18 }}>
        <Image src="/brand/nearest-wordmark.png" alt="Nearest" width={190} height={127} style={{ alignSelf: "center", height: "auto" }} />
        <h1 className="disp h1">Share your perspective</h1>
        {"error" in open ? (
          <div className="card warn small" style={{ gap: 6 }}><span className="b">{open.error}</span><Link className="link small" href="/">Go to Nearest</Link></div>
        ) : (
          <>
            <p className="small muted p" style={{ margin: 0 }}>Nearest invited you to share why you support it, in your own words. Nearest reviews every statement by hand and publishes only what you give permission for. Your contact email stays private.</p>
            <p className="xs muted p" style={{ margin: 0 }}>{PERSONAL_DISCLAIMER}</p>
            <SupporterForm token={token} />
          </>
        )}
      </div>
    </div>
  );
}
