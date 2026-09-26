import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { Icon } from "@/components/Icon";
import { Tabs } from "@/components/Tabs";
import { displayName, initials } from "@/lib/viewer";
import { requireStudent, schoolArea } from "@/lib/student";

export const metadata = { title: "Account" };

export default async function Account() {
  const { user: u, profile } = await requireStudent();
  const area = profile.schoolId ? await schoolArea(profile.schoolId) : null;
  const verified = profile.verificationStatus === "verified";
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">Account</div><span className="sp" /></div>
      <div className="body">
        <div className="row">
          <div className="avatar lg">{initials(u)}</div>
          <div className="col g4">
            <span className="disp h2">{displayName(u)}</span>
            <span className={`badge${verified ? "" : " mute"}`}><Icon name="shield" size="s" /> {verified ? "Verified Student" : "Verification in progress"}</span>
            {area && <span className="xs muted">{area.school}{profile.reverifyBy ? ` • Reverify by ${profile.reverifyBy}` : ""}</span>}
          </div>
        </div>
        <div className="card small">
          <div className="row between"><span className="muted">Email</span><span>{u?.email ?? "—"}</span></div>
        </div>
        <div className="col" style={{ gap: 0 }}>
          <Link className="item" href="/bookings"><Icon name="cal" /><span className="grow">My appointments</span><Icon name="right" size="s" /></Link>
          <Link className="item" href="/favorites"><Icon name="heart" /><span className="grow">Favorites</span><Icon name="right" size="s" /></Link>
          <Link className="item" href="/credits"><Icon name="wallet" /><span className="grow">My credits</span><Icon name="right" size="s" /></Link>
          <Link className="item" href="/notifications"><Icon name="bell" /><span className="grow">Notifications</span><Icon name="right" size="s" /></Link>
          <Link className="item" href="/verify/access"><Icon name="hand" /><span className="grow">Communication preferences</span><Icon name="right" size="s" /></Link>
          <Link className="item" href="/terms"><Icon name="file" /><span className="grow">Terms of Service</span><Icon name="right" size="s" /></Link>
          <Link className="item" href="/privacy"><Icon name="lock" /><span className="grow">Privacy Policy</span><Icon name="right" size="s" /></Link>
        </div>
        <SignOutButton redirectUrl="/"><button className="btn ghost" type="button">Sign out</button></SignOutButton>
      </div>
      <Tabs kind="student" active="Account" />
    </div>
  );
}
