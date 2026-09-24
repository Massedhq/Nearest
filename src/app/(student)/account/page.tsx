import { SignOutButton } from "@clerk/nextjs";
import { Icon } from "@/components/Icon";
import { Tabs } from "@/components/Tabs";
import { getViewer, displayName, initials } from "@/lib/viewer";

export const metadata = { title: "Account" };

export default async function Account() {
  const viewer = await getViewer();
  const u = viewer?.user;
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">Account</div><span className="sp" /></div>
      <div className="body">
        <div className="row">
          <div className="avatar lg">{initials(u)}</div>
          <div className="col g4">
            <span className="disp h2">{displayName(u)}</span>
            <span className="badge mute"><Icon name="shield" size="s" /> Student verification arrives in Phase 3</span>
          </div>
        </div>
        <div className="card small">
          <div className="row between"><span className="muted">Email</span><span>{u?.email ?? "—"}</span></div>
        </div>
        <SignOutButton redirectUrl="/"><button className="btn ghost" type="button">Sign out</button></SignOutButton>
      </div>
      <Tabs kind="student" active="Account" />
    </div>
  );
}
