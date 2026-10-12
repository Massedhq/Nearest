import { REWARD_DEFAULT_INCLUDES, DISCLOSURE_LINE, INVITE_HEADLINE, REDEMPTION_TERMS, SCREENSHOT_RULE, inviteBody, invitePoints, type Campaign } from "@/lib/campaign";

/**
 * The campaign invitation and directions: the configured free service, what it includes, redemption terms,
 * the seven "How to participate" steps, the screenshot rule and the key points. Shown after registration,
 * on the join screen, and kept on the campaign page for the whole campaign.
 */
export function CampaignInvitation({ c, opensLabel, headline = true }: { c: Campaign; opensLabel: string; headline?: boolean }) {
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
          <span className="small">{inviteBody(opensLabel)}</span>
        </div>
      )}

      <div className="card" style={{ gap: 6 }}>
        <span className="eyebrow">Your reward</span>
        <span className="small b">{c.rewardTitle || "One free service from a participating professional"}</span>
        <span className="small"><span className="b">What it includes:</span> {c.rewardIncludes || REWARD_DEFAULT_INCLUDES}</span>
        <span className="small b" style={{ marginTop: 4 }}>Redemption terms</span>
        {REDEMPTION_TERMS.map((t) => <span key={t} className="xs">• {t}</span>)}
        <span className="xs muted">Booking opens {opensLabel}.</span>
      </div>

      <div className="card" style={{ gap: 6 }}>
        <span className="eyebrow">How to participate</span>
        {steps.map((s) => <span key={s} className="small">{s}</span>)}
        <span className="small" style={{ marginTop: 4 }}><span className="b">Screenshots:</span> {SCREENSHOT_RULE} This applies to your starting screenshot, each daily screenshot and your final screenshot.</span>
        <span className="small"><span className="b">Deadlines:</span> after your clock starts, each daily submission deadline is shown on your campaign dashboard.</span>
        <span className="small"><span className="b">Required disclosure</span> (you receive a free service for taking part — add this to your bio): &ldquo;{DISCLOSURE_LINE}&rdquo;</span>
        <span className="xs muted">Never share your social media password — Nearest will never ask for it.</span>
      </div>

      <div className="card" style={{ gap: 4 }}>
        <span className="eyebrow">Good to know</span>
        {invitePoints(c).map((p) => <span key={p} className="small">• {p}</span>)}
      </div>
    </div>
  );
}
