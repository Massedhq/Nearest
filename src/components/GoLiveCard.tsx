import Link from "next/link";
import { Icon } from "./Icon";
import { proReadiness } from "@/lib/live-check";
import { setGoLive } from "@/app/pro/actions";
import type { professionalProfiles } from "@/db";

type Profile = typeof professionalProfiles.$inferSelect;

/**
 * The professional's Go live switch (Today + Business).
 * Live → "Go offline". Ready but offline → "Go live". Not ready → exactly what's left, each linked.
 * Payouts are never on the list: pros show up in search without them; earnings are held until they connect.
 */
export async function GoLiveCard({ profile }: { profile: Profile }) {
  const left = await proReadiness(profile);
  const live = left.length === 0 && profile.searchable;

  if (live) {
    return (
      <div className="card ok" style={{ gap: 10 }}>
        <div className="row"><Icon name="check" /><div className="grow"><div className="b">You&apos;re live</div><div className="xs muted">Students can find and book you in search, Near Me and All professionals.</div></div></div>
        {!profile.payoutsEnabled && <span className="xs">Payouts aren&apos;t connected yet — that&apos;s okay. Anything you earn is held for you and sent once you <Link className="link xs" href="/pro/payments">connect your bank</Link>.</span>}
        <form action={setGoLive}><input type="hidden" name="on" value="0" /><button className="btn ghost sm" type="submit" style={{ width: "100%" }}>Go offline</button></form>
      </div>
    );
  }

  if (left.length === 0) {
    return (
      <div className="card pearl" style={{ gap: 10 }}>
        <div className="b">You&apos;re offline</div>
        <span className="small">Students can&apos;t see you right now. Go live to show up in search, Near Me and All professionals. No payout setup needed.</span>
        <form action={setGoLive}><input type="hidden" name="on" value="1" /><button className="btn dark" type="submit" style={{ width: "100%" }}>Go live</button></form>
      </div>
    );
  }

  return (
    <div className="card warn" style={{ gap: 10 }}>
      <div className="b">Not live yet</div>
      <span className="xs muted">Finish these and the Go live button turns on. Payouts aren&apos;t required.</span>
      <div className="col" style={{ gap: 6 }}>
        {left.map((x) => x.href
          ? <div key={x.label} className="row small" style={{ gap: 10 }}><span className="grow">{x.label}</span><Link className="btn sm" href={x.href} style={{ flex: "none" }}>Finish</Link></div>
          : <div key={x.label} className="row small"><Icon name="clock" size="s" /><span className="grow">{x.label}</span></div>)}
      </div>
      <button className="btn sm" type="button" disabled style={{ width: "100%", opacity: 0.5 }}>Go live</button>
    </div>
  );
}
