import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, campaignEntries, campaignChecks, campaignEvents, studentProfiles, users, bookings } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { CampaignClock } from "@/components/CampaignClock";
import { requireAdmin } from "@/lib/admin";
import { CLOCK_LABEL, PLATFORM_LABEL, STATUS_LABEL, effectiveStatus, evidenceFor, finalProof, fmtWhen, getCampaign, missingEvidence, campaignEligibility } from "@/lib/campaign";
import { needsGuardian } from "@/lib/guardian";
import { schoolArea } from "@/lib/student";
import { recordProfileCheck, requestCorrection, approveEntry, rejectEntry, cancelEntry, decideLinkChange, releaseEntryPlace } from "@/app/admin/campaign-actions";

export const metadata = { title: "Campaign participant" };
export const dynamic = "force-dynamic";

const field = { width: "100%", borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "8px 10px", font: "inherit" } as const;
const EVENT_LABEL: Record<string, string> = {
  enrolled: "Joined — place reserved", waitlist_placed: "Place reserved from the waitlist", started: "Clock started", final_proof: "Final screenshot received",
  ready: "Ready for final review", correction_requested: "Correction requested", correction_done: "Student marked correction done", approved: "Approved",
  rejected: "Not approved", cancelled: "Cancelled", place_released: "Place released", link_change_requested: "Link change requested",
  link_change_approved: "Link change approved", link_change_denied: "Link change denied", flagged: "Flagged for review",
  reward_booked: "Reward booking requested", reward_redeemed: "Reward redeemed", reward_restored: "Reward returned",
};

/** One participant: eligibility, social profile, the seven-day clock, profile checks, decisions and the full timeline. */
export default async function CampaignParticipant({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const e = await db.query.campaignEntries.findFirst({ where: eq(campaignEntries.id, id) });
  if (!e) notFound();
  const [u, p, c, evidence, checks, events] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, e.studentId) }),
    db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, e.studentId) }),
    getCampaign(),
    evidenceFor(e.id),
    db.select({ k: campaignChecks, by: users.firstName }).from(campaignChecks).leftJoin(users, eq(users.id, campaignChecks.adminId)).where(eq(campaignChecks.entryId, e.id)).orderBy(asc(campaignChecks.checkedAt)),
    db.select({ v: campaignEvents, by: users.firstName }).from(campaignEvents).leftJoin(users, eq(users.id, campaignEvents.actorId)).where(eq(campaignEvents.entryId, e.id)).orderBy(asc(campaignEvents.at)),
  ]);
  if (!u) notFound();
  const area = p?.schoolId ? await schoolArea(p.schoolId) : null;
  const el = await campaignEligibility(u, p, c);
  const status = effectiveStatus(e);
  const now = new Date();
  const missing = e.startedAt ? missingEvidence(e, evidence, now) : [];
  const fp = finalProof(e, evidence, now);
  const elapsed = Boolean(e.completesAt && now >= e.completesAt);
  const decidable = ["in_progress", "ready_for_review", "needs_correction"].includes(e.status);
  const rewardBooking = e.rewardBookingId ? await db.query.bookings.findFirst({ where: eq(bookings.id, e.rewardBookingId) }) : null;
  const minor = needsGuardian(u);

  type Item = { at: Date; kind: "evidence" | "check" | "event"; node: React.ReactNode };
  const timeline: Item[] = [
    ...evidence.map((x) => ({ at: x.uploadedAt, kind: "evidence" as const, node: (
      <a href={`/api/campaign/evidence/${x.id}`} target="_blank" rel="noopener noreferrer" className="row" style={{ gap: 10, textDecoration: "none", color: "inherit" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/campaign/evidence/${x.id}`} alt="" width={56} height={56} style={{ objectFit: "cover", borderRadius: 8, border: "1px solid #2A2A2D" }} />
        <span className="small"><span className="b">Screenshot — {x.kind === "start" ? "starting (Day 1)" : x.kind === "final" ? "final proof" : `Day ${x.windowIndex}`}</span><br /><span className="xs muted">Server-recorded upload • {(x.bytes / 1024).toFixed(0)} KB • tap to open</span></span>
      </a>) })),
    ...checks.map(({ k, by }) => ({ at: k.checkedAt, kind: "check" as const, node: (
      <span className="small"><span className="b">Profile check by {by ?? "admin"}:</span> {k.pictureVisible === true ? "Nearest picture visible" : k.pictureVisible === false ? "Nearest picture NOT visible" : "Couldn't view the profile"}{k.notes ? ` — ${k.notes}` : ""}</span>) })),
    ...events.map(({ v, by }) => ({ at: v.at, kind: "event" as const, node: (
      <span className="small"><span className="b">{EVENT_LABEL[v.kind] ?? v.kind}</span>{v.actorId ? ` by ${v.actorId === e.studentId ? "the student" : by ?? "admin"}` : " (system)"}{v.detail ? ` — ${v.detail}` : ""}</span>) })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <>
      <AdminHead eyebrow="Launch campaign participant" title={[u.firstName, u.lastName].filter(Boolean).join(" ") || "Student"} />
      <Link className="link small" href="/admin/campaign">← All participants</Link>

      <div className="card" style={{ gap: 6 }}>
        <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}><span className="eyebrow">Status</span><span className={`tag ${status === "ready_for_review" || status === "needs_correction" ? "warn" : status === "approved" || status === "redeemed" ? "ok" : status === "cancelled" || status === "rejected" ? "bad" : ""}`}>{STATUS_LABEL[status] ?? status}</span></div>
        {status === "ready_for_review" && <span className="small">168 hours have elapsed. This is <span className="b">not an approval</span> — review the evidence and approve manually.</span>}
        {e.flags && <span className="small" style={{ color: "#E3C58A" }}>⚑ {e.flags}</span>}
        {missing.length > 0 && <span className="small" style={{ color: "#F2A38F" }}>Missing evidence: {missing.join(", ")}</span>}
        {(e.decisionNote || e.correctionNote) && <span className="small">{e.correctionNote && status === "needs_correction" ? `Correction asked: ${e.correctionNote}` : e.decisionNote ? `Decision note: ${e.decisionNote}` : ""}</span>}
        {rewardBooking && <span className="small">Reward booking: <Link className="link" href={`/admin/bookings`}>{rewardBooking.serviceName}</Link> — {rewardBooking.status}</span>}
      </div>

      <div className="card" style={{ gap: 4 }}>
        <span className="eyebrow">Registration &amp; eligibility (checked live)</span>
        <span className="small">Student verification: <span className="b">{p?.verificationStatus ?? "none"}</span>{p?.verifiedAt ? ` (${fmtWhen(p.verifiedAt)})` : ""}</span>
        <span className="small">School: {area ? `${area.school} • ${area.city} • ${area.market ?? "—"}` : "—"}</span>
        <span className="small">Parent/guardian consent: {minor ? <span className="b">{p?.guardianStatus === "approved" ? "Approved" : p?.guardianStatus ?? "Not yet"}</span> : "Not required (18+)"}</span>
        <span className="small">Currently eligible: <span className="b">{el.state === "eligible" ? "Yes" : `No — ${"message" in el ? el.message : ""}`}</span></span>
        <span className="xs muted">Joined {fmtWhen(e.reservedAt)}{e.fromWaitlist ? " from the waitlist" : ""} • Terms version {e.termsVersion ?? "—"} accepted {e.termsAcceptedAt ? fmtWhen(e.termsAcceptedAt) : "—"}</span>
      </div>

      <div className="card" style={{ gap: 8 }}>
        <span className="eyebrow">Social profile</span>
        {e.profileUrl ? (
          <>
            <span className="small" style={{ wordBreak: "break-all" }}>{PLATFORM_LABEL[e.platform ?? ""] ?? ""} • {e.profileUrl}</span>
            <a className="btn sm" href={e.profileUrl} target="_blank" rel="noopener noreferrer nofollow" style={{ alignSelf: "flex-start" }}>Open social profile</a>
          </>
        ) : <span className="small muted">No link yet — the student hasn&apos;t started.</span>}
        {e.pendingProfileUrl && (
          <div className="card warn" style={{ gap: 6 }}>
            <span className="small"><span className="b">Link change requested</span> {e.pendingProfileAt ? fmtWhen(e.pendingProfileAt) : ""}: {e.pendingProfileUrl}</span>
            <span className="xs">Reason: {e.pendingProfileReason}</span>
            <a className="link xs" href={e.pendingProfileUrl} target="_blank" rel="noopener noreferrer nofollow">Open the requested profile</a>
            <div className="row" style={{ gap: 8 }}>
              <ActionForm action={decideLinkChange} submitLabel="Approve change" buttonClass="btn sm" className="row"><input type="hidden" name="id" value={e.id} /><input type="hidden" name="version" value={e.version} /><input type="hidden" name="decision" value="approve" /></ActionForm>
              <ActionForm action={decideLinkChange} submitLabel="Deny" buttonClass="btn ghost sm" className="row"><input type="hidden" name="id" value={e.id} /><input type="hidden" name="version" value={e.version} /><input type="hidden" name="decision" value="deny" /></ActionForm>
            </div>
          </div>
        )}
        {e.profileUrl && (
          <details>
            <summary className="small b" style={{ cursor: "pointer" }}>Record profile check</summary>
            <ActionForm action={recordProfileCheck} submitLabel="Record profile check" buttonClass="btn sm" className="col g8">
              <input type="hidden" name="id" value={e.id} />
              <span className="xs muted">Open the profile, look, then record what you saw. Your name and the server time are saved.</span>
              <label className="check small"><input type="radio" name="visible" value="yes" required /> <span>Nearest picture visible</span></label>
              <label className="check small"><input type="radio" name="visible" value="no" /> <span>Nearest picture NOT visible</span></label>
              <label className="check small"><input type="radio" name="visible" value="cant" /> <span>Couldn&apos;t view the profile (private / not found)</span></label>
              <textarea name="notes" rows={2} maxLength={1000} placeholder="Notes (optional)" style={field} aria-label="Notes" />
            </ActionForm>
          </details>
        )}
      </div>

      <CampaignClock entry={e} evidence={evidence} audience="admin" />

      {decidable && (
        <div className="card" style={{ gap: 12 }}>
          <span className="eyebrow">Decision — manual review</span>
          <span className="xs muted">{CLOCK_LABEL}. Approval requires the full 168 hours, a final screenshot taken at or after 168 hours, the student still eligible, and your review. Screenshots support the review; they don&apos;t prove the picture was never changed.</span>
          <ActionForm action={approveEntry} submitLabel={elapsed ? "Approve participation" : "Approve (available after 168 hours)"} buttonClass="btn sm" className="col g8">
            <input type="hidden" name="id" value={e.id} /><input type="hidden" name="version" value={e.version} />
            {!elapsed && <span className="xs" style={{ color: "#E3C58A" }}>The 168 hours end {e.completesAt ? fmtWhen(e.completesAt) : "after the student starts"}.</span>}
            {fp.state !== "submitted" && elapsed && <span className="xs" style={{ color: "#F2A38F" }}>Final screenshot missing — approval is blocked until it arrives.</span>}
            {missing.filter((m) => !m.startsWith("Final")).length > 0 && <label className="check xs"><input type="checkbox" name="ackMissing" /><span>I reviewed the missing evidence ({missing.filter((m) => !m.startsWith("Final")).join(", ")})</span></label>}
            <input name="note" placeholder="Note (optional)" maxLength={1000} style={field} aria-label="Approval note" />
          </ActionForm>
          <ActionForm action={requestCorrection} submitLabel="Request correction" buttonClass="btn ghost sm" className="col g8">
            <input type="hidden" name="id" value={e.id} /><input type="hidden" name="version" value={e.version} />
            <textarea name="note" rows={2} maxLength={1000} placeholder="What the student needs to fix" required style={field} aria-label="Correction note" />
          </ActionForm>
          <ActionForm action={rejectEntry} submitLabel="Don't approve" buttonClass="btn ghost sm" className="col g8">
            <input type="hidden" name="id" value={e.id} /><input type="hidden" name="version" value={e.version} />
            <textarea name="reason" rows={2} maxLength={1000} placeholder="Reason (the student sees this)" required style={field} aria-label="Reason" />
            <label className="check xs"><input type="checkbox" name="release" /><span>Release this place to the waitlist</span></label>
          </ActionForm>
        </div>
      )}
      {["reserved", "in_progress", "ready_for_review", "needs_correction"].includes(e.status) && (
        <details className="card">
          <summary className="small b">Cancel this entry</summary>
          <ActionForm action={cancelEntry} submitLabel="Cancel entry" buttonClass="btn ghost sm" className="col g8">
            <input type="hidden" name="id" value={e.id} /><input type="hidden" name="version" value={e.version} />
            <textarea name="reason" rows={2} maxLength={1000} placeholder="Reason (recorded and shown to the student)" required style={field} aria-label="Cancellation reason" />
            <label className="check xs"><input type="checkbox" name="release" /><span>Release this unearned place to the waitlist</span></label>
          </ActionForm>
        </details>
      )}
      {["cancelled", "rejected"].includes(e.status) && !e.placeReleased && !e.approvedAt && (
        <ActionForm action={releaseEntryPlace} submitLabel="Release this place" buttonClass="btn ghost sm" className="row"><input type="hidden" name="id" value={e.id} /></ActionForm>
      )}

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Timeline — screenshots, profile checks and actions</span>
        {timeline.length === 0 && <span className="small muted">Nothing yet.</span>}
        {timeline.map((t, i) => (
          <div key={i} className="row" style={{ gap: 12, alignItems: "flex-start", borderTop: i ? "1px solid #1C1C1F" : undefined, paddingTop: i ? 10 : 0 }}>
            <span className="xs muted" style={{ width: 150, flex: "none" }}>{fmtWhen(t.at)}</span>
            <div className="grow">{t.node}</div>
          </div>
        ))}
      </div>
    </>
  );
}
