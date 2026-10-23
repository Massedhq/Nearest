import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db, campaignWaitlist, bookings } from "@/db";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { CampaignClock } from "@/components/CampaignClock";
import { CampaignUpload } from "@/components/CampaignUpload";
import { CampaignInvitation } from "@/components/CampaignInvitation";
import { requireStudent } from "@/lib/student";
import {
  AGREE_TEXT, SCREENSHOT_RULE, WAITLIST_NOTE, CAMPAIGN_KEY, DISCLOSURE_LINE, PLATFORM_LABEL, STATUS_LABEL, bookingOpensLabel, campaignEligibility, currentWindow, effectiveStatus, entryFor,
  evidenceFor, fmtWhen, getCampaign, missingEvidence, DAY_MS, MAX_UPLOADS_PER_WINDOW,
} from "@/lib/campaign";
import { dismissCampaignInvite, joinCampaign, joinCampaignWaitlist, leaveCampaignWaitlist, requestProfileChange, markCorrectionDone } from "@/app/campaign-actions";

export const metadata = { title: "Launch campaign" };
export const dynamic = "force-dynamic";

const box = { maxHeight: 220, overflowY: "auto" as const, border: "1px solid #2A2A2D", borderRadius: 12, padding: "10px 12px", background: "#0E0E10", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" as const };

/** The student's launch campaign: join → start (server-stamped) → seven daily windows → final proof → manual review → reward. */
export default async function CampaignPage({ searchParams }: { searchParams: Promise<{ step?: string; invite?: string }> }) {
  const sp = await searchParams;
  const { user, profile } = await requireStudent();
  const c = await getCampaign();
  let entry = await entryFor(user.id);
  if (entry?.rewardBookingId) { await (await import("@/lib/campaign-reward")).reconcileRewards(entry.id); entry = await entryFor(user.id); }
  const opensLabel = bookingOpensLabel(c);
  const bookingOpen = Boolean(c.bookingOpensAt && c.bookingOpensAt.getTime() <= Date.now());
  // Approved before the reward became credit? Add the credit now (once).
  if (entry && entry.status === "approved" && !entry.rewardBookingId) { await (await import("@/lib/campaign")).issueRewardCredit(entry.id); entry = await entryFor(user.id); }
  const credit = (await import("@/lib/campaign")).creditLabel(await (await import("@/lib/campaign")).rewardCreditCents());

  // ---------- Not enrolled: the invitation (JOIN THE CAMPAIGN / NOT NOW), then the agreement step ----------
  if (!entry) {
    const el = await campaignEligibility(user, profile, c);
    const wl = await db.query.campaignWaitlist.findFirst({ where: and(eq(campaignWaitlist.campaignKey, CAMPAIGN_KEY), eq(campaignWaitlist.studentId, user.id)) });
    const full = c.occupied >= c.capacity;
    const confirming = sp.step === "confirm" && c.status === "open" && el.state === "eligible" && !full;
    const notNow = <form action={dismissCampaignInvite}><button className="btn ghost" type="submit" style={{ width: "100%" }}>NOT NOW</button></form>;
    let action: React.ReactNode;
    if (c.status === "draft") action = <div className="card small"><span>The launch campaign isn&apos;t open yet. Check back soon.</span></div>;
    else if (c.status === "closed") action = <div className="card small"><span className="b">Enrollment is closed.</span></div>;
    else if (el.state === "incomplete") action = <div className="card warn small" style={{ gap: 8 }}><span className="b">Finish your registration and verification first</span><span>Students must be fully registered and verified before joining. Remaining step: {el.message}</span><Link className="btn sm" href={el.href} style={{ alignSelf: "flex-start" }}>Continue</Link>{notNow}</div>;
    else if (el.state === "pending") action = <div className="card small" style={{ gap: 8 }}><span className="b">Verification pending</span><span>Students must be fully registered and verified before joining. Remaining step: {el.message}</span><Link className="link small" href={el.href}>See status</Link>{notNow}</div>;
    else if (el.state === "outside") action = <div className="card small"><span>{el.message}</span></div>;
    else if (c.status === "paused") action = <div className="card small"><span className="b">The campaign is paused.</span><span>New students can&apos;t join while it&apos;s paused. Check back soon.</span></div>;
    else if (full) action = wl?.status === "waiting"
      ? <div className="card small" style={{ gap: 8 }}><span className="b">You&apos;re on the waitlist.</span><span>{WAITLIST_NOTE}</span><form action={leaveCampaignWaitlist}><button className="link xs" type="submit">Leave the waitlist</button></form></div>
      : <div className="card small" style={{ gap: 8 }}><span className="b">The campaign is full — all {c.capacity} places are taken.</span><span>{WAITLIST_NOTE}</span><form action={joinCampaignWaitlist}><button className="btn" type="submit" style={{ width: "100%" }}>JOIN THE WAITLIST</button></form>{notNow}</div>;
    else if (confirming) action = (
      <div className="card" style={{ gap: 10 }} id="join">
        <span className="eyebrow">Confirm your enrollment</span>
        <span className="small">{c.capacity - c.occupied} of {c.capacity} places left. Confirming reserves your place — your seven days don&apos;t start until Nearest accepts your profile link and starting screenshot.</span>
        <span className="small b">Campaign terms</span>
        <div style={box} tabIndex={0} role="region" aria-label="Campaign terms">{c.terms}</div>
        <ActionForm action={joinCampaign} submitLabel="Confirm my enrollment">
          <input type="hidden" name="termsVersion" value={c.termsVersion ?? ""} />
          <label className="check xs" style={{ alignItems: "flex-start" }}><input type="checkbox" name="agree" required /><span>{AGREE_TEXT}</span></label>
        </ActionForm>
        <Link className="link small" href="/campaign" style={{ textAlign: "center" }}>Back to the directions</Link>
      </div>
    );
    else action = (
      <div className="col" style={{ gap: 8 }} id="join">
        <span className="xs muted" style={{ textAlign: "center" }}>{c.capacity - c.occupied} of {c.capacity} places left</span>
        <Link className="btn" href="/campaign?step=confirm#join" style={{ textAlign: "center" }}>JOIN THE CAMPAIGN</Link>
        {notNow}
      </div>
    );
    return (
      <div className="scr">
        <TopBar title="Launch campaign" back={sp.invite ? "/home" : "/account"} />
        <div className="body">
          {confirming ? null : <CampaignInvitation c={c} opensLabel={opensLabel} />}
          {action}
        </div>
      </div>
    );
  }

  // ---------- Enrolled ----------
  const evidence = await evidenceFor(entry.id);
  const status = effectiveStatus(entry);
  const now = new Date();
  const missing = missingEvidence(entry, evidence, now);
  const win = currentWindow(entry, now);
  const winCount = win ? evidence.filter((e) => e.windowIndex === win).length : 0;
  const active = ["in_progress", "ready_for_review", "needs_correction"].includes(entry.status) && entry.startedAt;
  const rewardBooking = entry.rewardBookingId ? await db.query.bookings.findFirst({ where: eq(bookings.id, entry.rewardBookingId) }) : null;

  const statusLine: Record<string, string> = {
    reserved: "Your place is reserved. Set the Nearest picture as your profile picture, then submit your link and starting screenshot to start your seven days.",
    in_progress: "Your seven days are running. Upload one screenshot in each daily window.",
    ready_for_review: entry.finalProofAt ? "Seven days complete and final screenshot received. Nearest is doing your final review — this is not an approval yet." : "Seven days complete. Upload your final screenshot so Nearest can do your final review.",
    needs_correction: "Nearest asked for a correction — see the note below.",
    approved: `Approved! Your ${credit} Nearest credit is being added to your account.`,
    redeemed: entry.rewardBookingId ? "Your free service has been booked." : `Approved! ${credit} in Nearest credit was added to your account — use it toward any service you book.`,
    rejected: "Your participation wasn't approved.",
    cancelled: "Your campaign entry was cancelled.",
  };

  return (
    <div className="scr">
      <TopBar title="Launch campaign" back="/account" />
      <div className="body">
        <div className={`card ${status === "approved" || status === "redeemed" ? "ok" : status === "needs_correction" || status === "rejected" || status === "cancelled" ? "warn" : ""}`} style={{ gap: 6 }}>
          <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}><span className="eyebrow">Your campaign</span><span className="tag">{STATUS_LABEL[status] ?? status}</span></div>
          <span className="small">{statusLine[status]}</span>
          {status === "needs_correction" && entry.correctionNote && <span className="small"><span className="b">Nearest&apos;s feedback:</span> {entry.correctionNote}</span>}
          {(status === "rejected" || status === "cancelled") && entry.decisionNote && <span className="small"><span className="b">Reason:</span> {entry.decisionNote}</span>}
          <span className="xs muted">Reserved {fmtWhen(entry.reservedAt)}{entry.fromWaitlist ? " (from the waitlist)" : ""} • Booking opens {opensLabel}</span>
        </div>

        {status === "needs_correction" && (
          <div className="card" style={{ gap: 8 }}>
            <span className="eyebrow">Correction</span>
            <span className="small">Make the change Nearest asked for (you can upload another screenshot below), then let Nearest know. Your clock keeps running — it isn&apos;t reset.</span>
            <ActionForm action={markCorrectionDone} submitLabel="I've made the correction" buttonClass="btn sm" className="col g8">
              <input name="note" placeholder="Optional note for Nearest" maxLength={500} style={{ height: 40, borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px" }} aria-label="Note" />
            </ActionForm>
          </div>
        )}

        {["reserved", "in_progress", "needs_correction", "ready_for_review"].includes(entry.status) && (
          <div className="card" style={{ gap: 8 }}>
            <span className="eyebrow">The Nearest profile picture</span>
            {c.graphicUrl && (
              <div className="row" style={{ gap: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.graphicUrl} alt="The Nearest launch profile picture" width={88} height={88} style={{ borderRadius: 44, objectFit: "cover", border: "1px solid #2A2A2D" }} />
                <a className="btn sm" href={c.graphicUrl} download="nearest-profile-picture.png">Download the picture</a>
              </div>
            )}
            <span className="xs muted">Accepted on: {Object.values(PLATFORM_LABEL).join(", ")} — any one, no follower minimum. Nearest will never ask for your password.</span>
            <span className="small"><span className="b">Add this to your bio (required disclosure):</span> &ldquo;{DISCLOSURE_LINE}&rdquo;</span>
          </div>
        )}

        {entry.status === "reserved" && (
          <div className="card" style={{ gap: 8 }}>
            <span className="eyebrow">Start your seven days</span>
            <span className="small">After the Nearest picture is your profile picture, submit your profile link and a screenshot of your profile. Your 168 hours start the moment Nearest&apos;s server accepts them.</span>
            <CampaignUpload mode="start" label="Starting screenshot of your profile" hint={`JPG, PNG or WebP, up to 4 MB. ${SCREENSHOT_RULE}`} />
          </div>
        )}

        <CampaignClock entry={entry} evidence={evidence} audience="student" />

        {active && (
          <div className="card" style={{ gap: 8 }}>
            <span className="eyebrow">{win === 8 ? "Final proof" : `Today's screenshot — Day ${win}`}</span>
            <span className="small">{win === 8
              ? "Upload a final screenshot of your profile now that the full 168 hours have passed."
              : `This upload counts for Day ${win}, which closes ${fmtWhen(new Date(entry.startedAt!.getTime() + (win ?? 1) * DAY_MS))}. Nearest's server records the time — the window is decided when it arrives.`}</span>
            {winCount >= MAX_UPLOADS_PER_WINDOW
              ? <span className="xs muted">You&apos;ve sent {MAX_UPLOADS_PER_WINDOW} screenshots for this window.</span>
              : <CampaignUpload mode="evidence" label={win === 8 ? "Final screenshot" : `Day ${win} screenshot`} hint={`JPG, PNG or WebP, up to 4 MB. ${SCREENSHOT_RULE}`} />}
          </div>
        )}

        {entry.startedAt && missing.length > 0 && !["approved", "redeemed", "rejected", "cancelled"].includes(status) && (
          <div className="card warn small" style={{ gap: 4 }}>
            <span className="b">Outstanding</span>
            {missing.map((m) => <span key={m}>• {m}</span>)}
            <span className="xs muted">Missed windows are shown to Nearest during review. They don&apos;t reset your progress.</span>
          </div>
        )}

        {entry.profileUrl && (
          <div className="card" style={{ gap: 8 }}>
            <span className="eyebrow">Your social profile</span>
            <a className="link small" href={entry.profileUrl} target="_blank" rel="noopener noreferrer" style={{ wordBreak: "break-all" }}>{entry.profileUrl}</a>
            <span className="xs muted">{PLATFORM_LABEL[entry.platform ?? ""] ?? ""} • You can&apos;t switch accounts during the campaign without Nearest&apos;s review.</span>
            {entry.pendingProfileUrl
              ? <span className="small">Change requested to <span className="b">{entry.pendingProfileUrl}</span> — waiting for Nearest&apos;s review.</span>
              : active && (
                <details>
                  <summary className="link xs">Request a link correction</summary>
                  <ActionForm action={requestProfileChange} submitLabel="Send for review" buttonClass="btn sm" className="col g8">
                    <input name="profileUrl" type="url" placeholder="Correct profile link" required style={{ height: 40, borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px" }} aria-label="Correct profile link" />
                    <input name="reason" placeholder="Why it needs to change (e.g. typo)" required maxLength={500} style={{ height: 40, borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px" }} aria-label="Reason" />
                  </ActionForm>
                </details>
              )}
          </div>
        )}

        <div className="card" style={{ gap: 6 }}>
          <span className="eyebrow">Final review &amp; reward</span>
          {["approved", "redeemed"].includes(status) && !entry.rewardBookingId && <>
            <span className="small">{credit} in Nearest credit is in your account. It&apos;s taken off your total automatically when you pay for any service with any professional{bookingOpen ? "" : ` once booking opens ${opensLabel}`}.</span>
            <Link className="btn sm" href="/credits" style={{ alignSelf: "flex-start" }}>See my credit</Link>
          </>}
          {entry.rewardBookingId && rewardBooking && <><span className="small">{status === "redeemed" ? "Redeemed" : "Requested — waiting for the professional to accept"}: {rewardBooking.serviceName}</span><Link className="link small" href={`/bookings/${rewardBooking.id}`}>Open the booking</Link></>}
          {!["approved", "redeemed"].includes(status) && <span className="small">Nearest approves participation by hand after the full 168 hours and your final screenshot. Your {credit} Nearest credit is added only after approval.</span>}
        </div>

        <details className="card">
          <summary className="small b">Campaign directions, reward &amp; terms</summary>
          <div style={{ marginTop: 8 }}><CampaignInvitation c={c} opensLabel={opensLabel} headline={false} /></div>
          <span className="small b" style={{ marginTop: 8 }}>Campaign terms</span>
          <div style={{ ...box, marginTop: 8 }}>{c.terms}</div>
          <span className="xs muted">You agreed to terms version {entry.termsVersion ?? "—"} on {entry.termsAcceptedAt ? fmtWhen(entry.termsAcceptedAt) : "—"}.</span>
        </details>
      </div>
    </div>
  );
}
