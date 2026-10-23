import { DISCLOSURE_LINE, INVITE_HEADLINE, SCREENSHOT_RULE, creditLabel, inviteBody, invitePoints, redemptionTerms, rewardCreditCents, rewardIncludes, rewardTitle, type Campaign } from "@/lib/campaign";

/**
 * The campaign invitation and directions: the Nearest credit reward, how it works, redemption terms,
 * the seven "How to participate" steps, the screenshot rule and the key points. Shown after registration,
 * on the join screen, and kept on the campaign page for the whole campaign.
 */
export async function CampaignInvitation({ c, headline = true }: { c: Campaign; opensLabel?: string; headline?: boolean }) {
  const credit = creditLabel(await rewardCreditCents());
  const steps = (c.instructions ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <div className="col" style={{ gap: 12 }}>
      {headline && (
        <div className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Nearest launch campaign</span>
          <h1 className="disp h2" style={{ margin: 0 }}>{INVITE_HEADLINE}</h1>
          {c.graphicUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.graphicUrl} alt="The approved Nearest launch profile picture" width={96} height={96} style={{ borderRadius: 48, objectFit: "cover", border: "1px solid #2A2A2D" }} />
          )}
          <span className="small">{inviteBody(credit)}</span>
        </div>
      )}

      <div className="card" style={{ gap: 6 }}>
        <span className="eyebrow">Your reward</span>
        <span className="small b">{rewardTitle(credit)}</span>
        <span className="small"><span className="b">How it works:</span> {rewardIncludes(credit)}</span>
        <span className="small b" style={{ marginTop: 4 }}>Credit terms</span>
        {redemptionTerms(credit).map((t) => <span key={t} className="xs">• {t}</span>)}
      </div>

      <div className="card" style={{ gap: 6 }}>
        <span className="eyebrow">How to participate</span>
        {steps.map((s) => <span key={s} className="small">{s}</span>)}
        <span className="small" style={{ marginTop: 4 }}><span className="b">Screenshots:</span> {SCREENSHOT_RULE} This applies to your starting screenshot, each daily screenshot and your final screenshot.</span>
        <span className="small"><span className="b">Deadlines:</span> after your clock starts, each daily submission deadline is shown on your campaign dashboard.</span>
        <span className="small"><span className="b">Required disclosure</span> (you receive Nearest credit for taking part — add this to your bio): &ldquo;{DISCLOSURE_LINE}&rdquo;</span>
        <span className="xs muted">Never share your social media password — Nearest will never ask for it.</span>
      </div>

      <div className="card" style={{ gap: 4 }}>
        <span className="eyebrow">Good to know</span>
        {invitePoints(c).map((p) => <span key={p} className="small">• {p}</span>)}
      </div>
    </div>
  );
}
