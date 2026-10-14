import Image from "next/image";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { StarRating } from "@/components/StarRating";
import { CopyText } from "@/components/CopyText";
import { Stars } from "@/components/Stars";
import { GOOGLE_REVIEW_URL, STATUS_LABEL, affiliationLine, canReviewOnGoogle, supporterByManageToken } from "@/lib/supporters";
import { answerSupporterRevision, requestSupporterCorrection, withdrawSupporter } from "@/app/supporter-actions";

export const metadata = { title: "Manage your statement", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const box = { border: "1px solid #2A2A2D", borderRadius: 12, padding: "10px 12px", background: "#0E0E10", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" as const };
const STATUS_TEXT: Record<string, string> = {
  submitted: "Received — Nearest is reviewing it.",
  needs_correction: "Nearest asked for a correction (see below).",
  approved: "Approved — it will be published shortly.",
  published: "Published on Nearest.",
  declined: "Nearest decided not to publish this statement.",
  withdrawn: "You withdrew this statement. It isn't shown anywhere.",
};

/** The supporter's private management page: status, corrections, permissions, wording approval, withdrawal. */
export default async function ManageSupporter({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await supporterByManageToken(token);
  const closed = s ? ["withdrawn", "declined"].includes(s.status) : true;
  return (
    <div className="scr">
      <div className="body" style={{ gap: 16 }}>
        <Image src="/brand/nearest-wordmark.png" alt="Nearest" width={190} height={127} style={{ alignSelf: "center", height: "auto" }} />
        <h1 className="disp h1">Your statement</h1>
        {!s ? (
          <div className="card warn small" style={{ gap: 6 }}><span className="b">This management link isn&apos;t valid.</span><Link className="link small" href="/">Go to Nearest</Link></div>
        ) : (
          <>
            <div className={`card ${s.status === "published" ? "ok" : s.status === "needs_correction" ? "warn" : ""}`} style={{ gap: 4 }}>
              <span className="row between"><span className="eyebrow">Status</span><span className="tag">{STATUS_LABEL[s.status]}</span></span>
              <span className="small">{STATUS_TEXT[s.status]}</span>
              {s.adminNote && ["needs_correction", "declined"].includes(s.status) && <span className="small"><span className="b">Nearest&apos;s note:</span> {s.adminNote}</span>}
            </div>

            {s.statementProposed && (
              <div className="card warn" style={{ gap: 8 }}>
                <span className="eyebrow">Nearest suggested different wording</span>
                <span className="xs muted">Nothing changes unless you approve it.</span>
                <span className="small b">Your wording</span><div style={box}>{s.statementCurrent}</div>
                <span className="small b">Suggested wording</span><div style={box}>{s.statementProposed}</div>
                <div className="grid2">
                  <ActionForm action={answerSupporterRevision} submitLabel="Approve new wording" buttonClass="btn sm" className="col"><input type="hidden" name="token" value={token} /><input type="hidden" name="answer" value="approve" /></ActionForm>
                  <ActionForm action={answerSupporterRevision} submitLabel="Keep my wording" buttonClass="btn ghost sm" className="col"><input type="hidden" name="token" value={token} /><input type="hidden" name="answer" value="decline" /></ActionForm>
                </div>
              </div>
            )}

            <div className="card" style={{ gap: 6 }}>
              <span className="eyebrow">What you submitted</span>
              <span className="small b">{s.name} — {affiliationLine(s)}</span>
              {s.rating ? <Stars value={s.rating} size={20} /> : null}
              <span className="xs muted">Your opinion of Nearest</span>
              <div style={box}>{s.statementCurrent}</div>
              {s.benefitCurrent && <><span className="xs muted">How Nearest could benefit students and parents</span><div style={box}>{s.benefitCurrent}</div></>}
              {s.statementCurrent !== s.statementOriginal && <details><summary className="link xs">Your original statement</summary><div style={{ ...box, marginTop: 6 }}>{s.statementOriginal}</div></details>}
            </div>

            {!closed && (
              <>
                <div className="card" style={{ gap: 8 }}>
                  <span className="eyebrow">Request a correction</span>
                  <span className="xs muted">Change your statement, title or organization, and/or tell Nearest what to fix. It goes back to review{s.status === "published" ? " and comes off the public page until approved" : ""}.</span>
                  <ActionForm action={requestSupporterCorrection} submitLabel="Send correction" buttonClass="btn sm" className="col g8">
                    <input type="hidden" name="token" value={token} />
                    <div className="field"><label>Your rating</label><StarRating defaultValue={s.rating ?? 0} required={false} /></div>
                    <div className="field"><label htmlFor="c-st">Your opinion of Nearest</label><textarea id="c-st" name="statement" defaultValue={s.statementCurrent} maxLength={1500} style={{ height: 140 }} /></div>
                    <div className="field"><label htmlFor="c-be">How Nearest could benefit students and parents</label><textarea id="c-be" name="benefit" defaultValue={s.benefitCurrent ?? ""} maxLength={1500} style={{ height: 120 }} /></div>
                    <div className="field"><label htmlFor="c-ti">Professional title</label><input id="c-ti" name="title" defaultValue={s.title} maxLength={120} /></div>
                    <div className="field"><label htmlFor="c-af">School or organization</label>
                      <select id="c-af" name="affiliationStatus" defaultValue={s.affiliationStatus}><option value="current">Currently with</option><option value="former">Previously with (not anymore)</option><option value="none">Not with a school or organization</option></select>
                      <input name="organization" defaultValue={s.organization} maxLength={160} placeholder="School or organization" />
                    </div>
                    <div className="field"><label htmlFor="c-msg">Message to Nearest (optional)</label><input id="c-msg" name="message" maxLength={1000} /></div>
                  </ActionForm>
                </div>

                {canReviewOnGoogle(s.relationships) && (
                  <div className="card" style={{ gap: 8 }}>
                    <span className="eyebrow">Post the same review on Google (optional)</span>
                    <span className="xs muted">Google only lets you post reviews yourself, from your own Google account. Copy your review below, then paste it on Nearest&apos;s Google review page with your stars.</span>
                    <CopyText text={[s.statementCurrent, s.benefitCurrent].filter(Boolean).join("\n\n")} label="Copy my review" />
                    <a className="btn ghost sm" href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer">Open Google reviews</a>
                  </div>
                )}

                <div className="card bad" style={{ gap: 8 }}>
                  <span className="eyebrow">Withdraw</span>
                  <span className="xs">Your statement is removed from Nearest&apos;s pages immediately and won&apos;t be published again.</span>
                  <ActionForm action={withdrawSupporter} submitLabel="Withdraw my statement" buttonClass="btn danger sm" className="col g8">
                    <input type="hidden" name="token" value={token} />
                    <label className="check xs"><input type="checkbox" name="confirm" required /><span>Yes, withdraw it.</span></label>
                  </ActionForm>
                </div>
              </>
            )}
            <span className="xs muted" style={{ textAlign: "center" }}>Keep this link private — anyone with it can manage your statement.</span>
          </>
        )}
      </div>
    </div>
  );
}
