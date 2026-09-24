import Image from "next/image";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, professionalProfiles } from "@/db";
import { Icon } from "@/components/Icon";
import { Tabs } from "@/components/Tabs";
import { ComingSoon } from "@/components/ComingSoon";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Today" };

function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Chicago" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function ProHome() {
  const viewer = await getViewer();
  const u = viewer!.user!;
  const profile = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, u.id) });
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/Chicago" });
  return (
    <div className="scr">
      <div className="top" style={{ justifyContent: "space-between" }}>
        <Image src="/brand/nearest-monogram.png" alt="Nearest" width={48} height={48} />
        {viewer?.admin ? <Link className="chip" href="/workspace"><Icon name="switch" size="s" /> Switch workspace</Link> : <span />}
        <span className="iconbtn" aria-label="Notifications"><Icon name="bell" /></span>
      </div>
      <div className="body">
        <div><p className="eyebrow p">{today}</p><h1 className="disp h1">{greeting()}, {u.firstName}</h1></div>
        {profile?.cohort === "FOUNDING" && (
          <div className="card pearl"><span className="tag solid" style={{ background: "#0A0A0A", color: "#ECE8E1", alignSelf: "flex-start" }}>Founding Professional</span><span className="small">Your founding rate is locked to your account.</span></div>
        )}
        <div className="card">
          <span className="eyebrow">Get ready to go live</span>
          <div className="row small"><Icon name="check" size="s" /><span className="grow">Email verified</span><span className="tag ok">Done</span></div>
          <div className="row small"><Icon name="shield" size="s" /><span className="grow">Identity verification</span><span className="tag">Phase 2</span></div>
          <div className="row small"><Icon name="grid" size="s" /><span className="grow">Profile, services &amp; hours</span><span className="tag">Phase 2</span></div>
        </div>
        <button className="btn" type="button" disabled style={{ opacity: 0.5 }}><Icon name="plus" /> Create a model call</button>
        <ComingSoon title="Calendar, Available Today and model calls" phase="Phase 2" />
      </div>
      <Tabs kind="pro" active="Today" />
    </div>
  );
}
