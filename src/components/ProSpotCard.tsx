import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { reclaimMySpot } from "@/app/pro/spot-actions";
import { reclaimProblem } from "@/lib/no-membership";
import { MEMBERSHIP_ENABLED } from "@/lib/membership";
import type { professionalProfiles } from "@/db";

type P = typeof professionalProfiles.$inferSelect;

/**
 * Pro home, 30-day spot rule (no membership): a warning once a not-live profile is close to losing its spot, and a
 * Reclaim button after a spot was released (when the city still has room).
 */
export async function ProSpotCard({ profile: p }: { profile: P }) {
  if (MEMBERSHIP_ENABLED) return null;
  if (p.placementReleasedAt) {
    const problem = await reclaimProblem(p);
    return (
      <div className="card warn" style={{ gap: 8 }}>
        <span className="b">Your spot was released</span>
        <span className="small">Your profile wasn&apos;t live within 30 days of joining, so your city and category spot opened for another professional. Your account and profile are still here.</span>
        {problem ? (
          <><span className="small">{problem}</span><Link className="btn ghost sm" href="/pro/join" style={{ alignSelf: "flex-start" }}>Join the waitlist</Link></>
        ) : (
          <ActionForm action={reclaimMySpot} submitLabel="Reclaim my spot" buttonClass="btn sm"><span className="small">Your city still has room — reclaim your spot now, then go live within 30 days to keep it.</span></ActionForm>
        )}
      </div>
    );
  }
  if (p.spotWarnedAt) {
    const start = (p.spotClockAt ?? p.entryPaidAt ?? new Date()).getTime();
    const daysLeft = Math.max(1, Math.ceil((start + 30 * 86400_000 - Date.now()) / 86400_000));
    const waitingOnNearest = p.reviewStatus === "submitted" || p.identityStatus === "pending";
    if (waitingOnNearest) return null; // time Nearest spends reviewing never counts against them
    return (
      <div className="card warn" style={{ gap: 6 }}>
        <span className="b">Go live to keep your spot — about {daysLeft} day{daysLeft === 1 ? "" : "s"} left</span>
        <span className="small">Spots in each city are for professionals who are taking bookings. Finish what&apos;s left below and go live so your spot isn&apos;t released to another professional.</span>
      </div>
    );
  }
  return null;
}
