import Image from "next/image";
import Link from "next/link";
import { BENEFIT_EXAMPLE, PUBLISH_CONSENT, STATEMENT_EXAMPLE, explainerEmbed, getExplainerUrl, openInvite, PERSONAL_DISCLAIMER } from "@/lib/supporters";
import { SupporterForm } from "@/components/SupporterForm";
import { WalkthroughVideo } from "@/components/WalkthroughVideo";
import { walkthroughPublished } from "@/lib/walkthrough";

export const metadata = { title: "Share your perspective", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Public: an invited educator/supporter shares a statement. No Nearest account needed. */
export default async function SupporterInvite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const open = await openInvite(token);
  const video = "error" in open ? null : explainerEmbed(await getExplainerUrl());
  const showWalkthrough = !("error" in open) && await walkthroughPublished();
  return (
    <div className="scr">
      <div className="body" style={{ gap: 18 }}>
        <Image src="/brand/nearest-wordmark.png" alt="Nearest" width={190} height={127} style={{ alignSelf: "center", height: "auto" }} />
        <h1 className="disp h1">Share your perspective</h1>
        {"error" in open ? (
          <div className="card warn small" style={{ gap: 6 }}><span className="b">{open.error}</span><Link className="link small" href="/">Go to Nearest</Link></div>
        ) : (
          <>
            <p className="small muted p" style={{ margin: 0 }}>Nearest invited you to share your opinion of Nearest and how it could help students and parents, in your own words. Your statement is published on usenearest.com after a quick review. Your contact email stays private. No account needed.</p>
            {video && (
              <div className="col" style={{ gap: 6 }}>
                <span className="eyebrow">See what Nearest offers students and parents</span>
                {video.kind === "video"
                  ? <video src={video.src} controls playsInline preload="metadata" style={{ width: "100%", borderRadius: 14, background: "#0A0A0A" }} />
                  : <iframe src={video.src} title="Nearest explainer video" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen style={{ width: "100%", aspectRatio: "16 / 9", border: 0, borderRadius: 14 }} />}
              </div>
            )}
            {showWalkthrough && <WalkthroughVideo />}
            <p className="xs muted p" style={{ margin: 0 }}>{PERSONAL_DISCLAIMER}</p>
            <SupporterForm token={token} texts={{ statementExample: STATEMENT_EXAMPLE, benefitExample: BENEFIT_EXAMPLE, consent: PUBLISH_CONSENT }} />
          </>
        )}
      </div>
    </div>
  );
}
