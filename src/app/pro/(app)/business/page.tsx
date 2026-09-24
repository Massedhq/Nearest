import Image from "next/image";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { Icon } from "@/components/Icon";
import { Tabs } from "@/components/Tabs";
import { requirePro } from "@/lib/pro";
import { initials } from "@/lib/viewer";

export const metadata = { title: "My business" };

const STATUS: Record<string, [string, string]> = {
  draft: ["Setting up", ""],
  submitted: ["In review", "warn"],
  approved: ["Approved", "ok"],
  rejected: ["Changes needed", "bad"],
};

const LINKS: [string, string, string][] = [
  ["card", "Membership, ID & payouts", "/pro/payments"],
  ["shield", "Account status", "/pro/account-status"],
  ["cal", "Appointments", "/pro/appointments"],
  ["eye", "Preview my profile", "/pro/setup/review"],
  ["user", "Profile & photo", "/pro/setup/profile?edit=1"],
  ["grid", "Services & prices", "/pro/setup/services?edit=1"],
  ["shield", "Licenses", "/pro/setup/credentials?edit=1"],
  ["camera", "Portfolio", "/pro/setup/portfolio?edit=1"],
  ["pin", "Location & travel radius", "/pro/setup/location?edit=1"],
  ["clock", "Hours", "/pro/setup/hours?edit=1"],
  ["hand", "Communication & accessibility", "/pro/setup/communication?edit=1"],
  ["sparkle", "Model calls", "/pro/model-calls"],
];

export default async function Business() {
  const { viewer, user, profile } = await requirePro();
  const [label, cls] = STATUS[profile.reviewStatus];
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">My business</div><span className="sp" /></div>
      <div className="body">
        <div className="row">
          {profile.photoUrl ? <Image src={profile.photoUrl} alt="" width={84} height={84} style={{ borderRadius: 42, objectFit: "cover" }} /> : <div className="avatar lg">{initials(user)}</div>}
          <div className="col g4"><span className="disp h2">{profile.businessName ?? `${user.firstName} ${user.lastName}`}</span><span className={`tag ${cls}`} style={{ alignSelf: "flex-start" }}>{label}</span></div>
        </div>
        <div className="col" style={{ gap: 0 }}>
          {LINKS.map(([icon, text, href]) => (
            <Link key={href} className="item" href={href}><Icon name={icon} /><span className="grow">{text}</span><Icon name="right" size="s" /></Link>
          ))}
          {viewer.admin && <Link className="item" href="/workspace"><Icon name="switch" /><span className="grow">Switch workspace</span><Icon name="right" size="s" /></Link>}
        </div>
        <div className="card small">
          <div className="row between"><span className="muted">Email</span><span>{user.email}</span></div>
        </div>
        <SignOutButton redirectUrl="/pro"><button className="btn ghost" type="button">Sign out</button></SignOutButton>
      </div>
      <Tabs kind="pro" active="Business" />
    </div>
  );
}
