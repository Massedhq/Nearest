import { CampaignCountdown } from "./CampaignCountdown";
import { CLOCK_DISCLAIMER, CLOCK_LABEL, dayWindows, finalProof, fmtWhen, type Entry, type Evidence } from "@/lib/campaign";

const STATE: Record<string, { label: string; cls: string }> = {
  submitted: { label: "Submitted", cls: "ok" },
  open: { label: "Open now", cls: "warn" },
  upcoming: { label: "Upcoming", cls: "" },
  missing: { label: "Missing", cls: "bad" },
};

const Thumb = ({ e }: { e: Evidence }) => (
  <a href={`/api/campaign/evidence/${e.id}`} target="_blank" rel="noopener noreferrer" className="row xs" style={{ gap: 6, textDecoration: "none", color: "inherit" }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`/api/campaign/evidence/${e.id}`} alt={`Screenshot uploaded ${fmtWhen(e.uploadedAt)}`} width={36} height={36} style={{ objectFit: "cover", borderRadius: 6, border: "1px solid #2A2A2D" }} />
    <span>Uploaded {fmtWhen(e.uploadedAt)}{e.kind === "start" ? " (starting screenshot)" : ""}</span>
  </a>
);

/**
 * The seven-day clock: start, required completion, live countdown, seven daily windows, every screenshot's
 * server-recorded upload time, and the final-proof status. Shared by the student dashboard and the admin record.
 */
export function CampaignClock({ entry, evidence, audience }: { entry: Entry; evidence: Evidence[]; audience: "student" | "admin" }) {
  const now = new Date();
  if (!entry.startedAt || !entry.completesAt) {
    return (
      <div className="card" style={{ gap: 6 }}>
        <span className="eyebrow">Seven-day clock — {CLOCK_LABEL}</span>
        <span className="small">{audience === "student" ? "Not started. Your 168 hours start the moment Nearest accepts your profile link and starting screenshot — downloading the picture or reserving your place doesn't start it." : "Not started — the student hasn't submitted a profile link and starting screenshot yet."}</span>
      </div>
    );
  }
  const windows = dayWindows(entry, evidence, now);
  const fp = finalProof(entry, evidence, now);
  return (
    <div className="card" style={{ gap: 10 }}>
      <span className="eyebrow">Seven-day clock — {CLOCK_LABEL}</span>
      <div className="grid2" style={{ gap: 8 }}>
        <div className="col g4"><span className="xs muted">Campaign start (server time)</span><span className="small b">{fmtWhen(entry.startedAt)}</span></div>
        <div className="col g4"><span className="xs muted">Required completion (start + 168 hours)</span><span className="small b">{fmtWhen(entry.completesAt)}</span></div>
      </div>
      <CampaignCountdown startedAt={entry.startedAt.toISOString()} completesAt={entry.completesAt.toISOString()} />

      <span className="eyebrow" style={{ marginTop: 4 }}>Daily evidence windows</span>
      <div className="col" style={{ gap: 8 }}>
        {windows.map((w) => (
          <div key={w.index} className="col" style={{ gap: 4, padding: "8px 0", borderTop: "1px solid #1C1C1F" }}>
            <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className="small b">Day {w.index}</span>
              <span className={`tag ${STATE[w.state].cls}`}>{STATE[w.state].label}</span>
            </div>
            <span className="xs muted">{fmtWhen(w.opensAt)} – {fmtWhen(w.closesAt)}{w.index === 1 ? " • the starting screenshot counts for Day 1" : ""}</span>
            {w.uploads.map((e) => <Thumb key={e.id} e={e} />)}
            {w.state === "missing" && <span className="xs" style={{ color: "#F2A38F" }}>No screenshot was received in this window.{audience === "admin" ? " Flagged for review — not an automatic disqualification." : " Nearest will see this during review."}</span>}
          </div>
        ))}
      </div>

      <div className="col" style={{ gap: 4, padding: "8px 0", borderTop: "1px solid #1C1C1F" }}>
        <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}>
          <span className="small b">Final proof</span>
          <span className={`tag ${fp.state === "submitted" ? "ok" : fp.state === "missing" ? "bad" : ""}`}>{fp.state === "submitted" ? "Submitted" : fp.state === "missing" ? "Missing" : "Not yet open"}</span>
        </div>
        <span className="xs muted">{fp.state === "not_yet" ? `Opens ${fmtWhen(entry.completesAt)} — at or after the full 168 hours.` : "A screenshot taken at or after the full 168 hours."}</span>
        {fp.uploads.map((e) => <Thumb key={e.id} e={e} />)}
      </div>
      <span className="xs muted">{CLOCK_DISCLAIMER}</span>
    </div>
  );
}
