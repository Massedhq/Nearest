import Image from "next/image";
import { Icon } from "@/components/Icon";
import { Tabs } from "@/components/Tabs";
import { ComingSoon } from "@/components/ComingSoon";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Explore" };

export default async function Home() {
  const viewer = await getViewer();
  return (
    <div className="scr">
      <div className="top" style={{ justifyContent: "space-between" }}>
        <Image src="/brand/nearest-monogram.png" alt="Nearest" width={48} height={48} />
        <span className="chip"><Icon name="pin" size="s" /> Frisco, TX</span>
        <span className="iconbtn" aria-label="Notifications"><Icon name="bell" /></span>
      </div>
      <div className="body">
        <p className="eyebrow p">Hi, {viewer?.user?.firstName}</p>
        <h1 className="disp h1">What do you need?</h1>
        <div className="search" aria-disabled="true"><Icon name="search" /><span>Search services</span></div>
        <div className="card pearl" style={{ padding: 22, gap: 6 }}>
          <div className="row between"><span className="disp h1">Model Calls</span><Icon name="right" /></div>
          <span className="small b">Model Calls near me</span>
        </div>
        <ComingSoon title="Search, Model Calls and booking" phase="Phase 3" />
      </div>
      <Tabs kind="student" active="Explore" />
    </div>
  );
}
