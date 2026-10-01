import Image from "next/image";
import { headers } from "next/headers";
import { SignOutButton } from "@clerk/nextjs";
import { getViewer } from "@/lib/viewer";
import { repForUser, repLinks, repRecent, repStats } from "@/lib/reps";
import { fmtDate } from "@/lib/time";
import { CopyText } from "@/components/CopyText";

export const metadata = { title: "Sales dashboard" };

const PROBLEMS: Record<string, string> = {
  invalid: "That invitation link isn't valid. Ask for a new one.",
  email: "You're signed in with a different email than the one your invitation was sent to. Sign out, then sign in or create your account with the invited email.",
  removed: "This sales account is no longer active.",
  expired: "This invitation has expired. Ask for a new one.",
};

/** A sales rep's own dashboard: their links and everyone who signed up through them. Nothing else in Nearest. */
export default async function RepDashboard({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const viewer = await getViewer();
  const rep = await repForUser(viewer?.user?.id);

  if (!rep) {
    return (
      <div className="scr" style={{ justifyContent: "center" }}>
        <div className="body" style={{ flex: "none", alignItems: "center" }}>
          <Image src="/brand/nearest-monogram.png" alt="" width={72} height={72} />
          <h1 className="disp h2">Sales dashboard</h1>
          <div className="card warn" style={{ width: "100%", maxWidth: 420 }}>
            <span className="small">{PROBLEMS[e ?? ""] ?? "This dashboard is for Nearest sales reps. Open the invitation link from your email to get started."}</span>
            {viewer && <SignOutButton redirectUrl="/"><button className="btn ghost" type="button">Sign out</button></SignOutButton>}
          </div>
        </div>
      </div>
    );
  }

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const links = repLinks(origin, rep.code);
  const [stats, recent] = await Promise.all([repStats([rep.id]), repRecent(rep.id)]);
  const s = stats.get(rep.id)!;

  return (
    <div className="scr">
      <div className="body" style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
        <div className="row between">
          <Image src="/brand/nearest-monogram.png" alt="Nearest" width={48} height={48} />
          <SignOutButton redirectUrl="/"><button className="btn ghost sm" type="button">Sign out</button></SignOutButton>
        </div>
        <p className="eyebrow p">Nearest sales team</p>
        <h1 className="disp h1">Hi, {rep.name.split(" ")[0]}</h1>

        <div className="kpis k4">
          <div className="card" style={{ gap: 4 }}><span className="xs muted">Total sign-ups</span><span className="stat">{s.total}</span><span className="xs muted">{s.thisMonth} this month</span></div>
          <div className="card" style={{ gap: 4 }}><span className="xs muted">Professionals</span><span className="stat">{s.pros}</span></div>
          <div className="card" style={{ gap: 4 }}><span className="xs muted">Professionals joined</span><span className="stat">{s.prosJoined}</span><span className="xs muted">Paid or active</span></div>
          <div className="card" style={{ gap: 4 }}><span className="xs muted">Students</span><span className="stat">{s.students}</span><span className="xs muted">{s.studentsVerified} verified</span></div>
        </div>

        <div className="card" style={{ gap: 12 }}>
          <span className="eyebrow">Your links</span>
          <span className="xs muted">Share these. Anyone who signs up within 30 days of tapping your link counts for you.</span>
          <div className="col" style={{ gap: 6 }}>
            <span className="small b">For professionals</span>
            <div className="row" style={{ gap: 8 }}><code className="small grow" style={{ wordBreak: "break-all" }}>{links.pro}</code><CopyText text={links.pro} /></div>
          </div>
          <div className="col" style={{ gap: 6 }}>
            <span className="small b">For students</span>
            <div className="row" style={{ gap: 8 }}><code className="small grow" style={{ wordBreak: "break-all" }}>{links.student}</code><CopyText text={links.student} /></div>
          </div>
        </div>

        <div className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Recent sign-ups</span>
          {recent.length === 0 && <span className="small muted">No sign-ups yet. Share your links to get started.</span>}
          {recent.map((r, i) => (
            <div key={i} className="row between" style={{ gap: 8, borderTop: i ? "1px solid #1C1C1F" : undefined, paddingTop: i ? 10 : 0 }}>
              <div className="col g4"><span className="small b">{r.who}</span><span className="xs muted">{r.kind} • {fmtDate(r.createdAt, { month: "short", day: "numeric" })}</span></div>
              <span className={`tag ${r.ok ? "ok" : ""}`}>{r.status}</span>
            </div>
          ))}
          <span className="xs muted">Students are shown without names to protect their privacy.</span>
        </div>
      </div>
    </div>
  );
}
