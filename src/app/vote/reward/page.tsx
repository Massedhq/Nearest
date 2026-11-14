import Link from "next/link";
import { getViewer } from "@/lib/viewer";
import { mySpin } from "@/lib/reward-wheel";
import { GrantedCard } from "@/components/GrantedCard";

export const metadata = { title: "Your GRANTED reward", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Opened from the hold email: the held reward and the two ways to add it to an account. */
export default async function RewardPage() {
  const [viewer, s] = await Promise.all([getViewer(), mySpin()]);
  const signedIn = viewer?.user?.accountType === "student";
  const live = s && s.status === "held" && s.holdUntil.getTime() > Date.now();
  return (
    <div className="scr">
      <div className="body" style={{ gap: 14, maxWidth: 480, margin: "0 auto", width: "100%" }}>
        {s ? <GrantedCard label={s.label} kind={s.kind} /> : null}
        <span className="small" style={{ textAlign: "center" }}>{!s ? "We couldn't find a held reward on this device." : s.status === "assigned" ? "This reward is already on an account." : live ? `Held for you until ${s.holdUntil.toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.` : "This reward's hold has ended."}</span>
        {live && (signedIn
          ? <Link className="btn" href="/cards">Add it to my account</Link>
          : <><Link className="btn" href="/sign-up">Create my account</Link><Link className="btn ghost" href="/sign-in?redirect_url=/cards">I already have an account</Link></>)}
      </div>
    </div>
  );
}
