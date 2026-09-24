import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { Icon } from "@/components/Icon";
import { Tabs } from "@/components/Tabs";
import { getViewer, displayName, initials } from "@/lib/viewer";

export const metadata = { title: "My business" };

export default async function Business() {
  const viewer = await getViewer();
  const u = viewer?.user;
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">My business</div><span className="sp" /></div>
      <div className="body">
        <div className="row">
          <div className="avatar lg">{initials(u)}</div>
          <div className="col g4"><span className="disp h2">{displayName(u)}</span><span className="tag" style={{ alignSelf: "flex-start" }}>Not yet searchable</span></div>
        </div>
        <div className="card small">
          <div className="row between"><span className="muted">Email</span><span>{u?.email}</span></div>
        </div>
        {viewer?.admin && <Link className="item" href="/workspace"><Icon name="switch" /><span className="grow">Switch workspace</span><Icon name="right" size="s" /></Link>}
        <SignOutButton redirectUrl="/pro"><button className="btn ghost" type="button">Sign out</button></SignOutButton>
      </div>
      <Tabs kind="pro" active="Business" />
    </div>
  );
}
