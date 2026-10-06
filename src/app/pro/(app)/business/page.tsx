import Image from "next/image";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { Icon } from "@/components/Icon";
import { Tabs } from "@/components/Tabs";
import { DeleteMyAccount } from "@/components/DeleteMyAccount";
import { GoLiveCard } from "@/components/GoLiveCard";
import { requirePro } from "@/lib/pro";
import { initials } from "@/lib/viewer";
import { proStanding } from "@/lib/enforcement";
import { selfDeleteBlocker } from "@/lib/accounts";

export const metadata = { title: "My business" };

// Matches the "My business" mockup: status first, then everything a pro manages.
const LINKS: [string, string, string][] = [
  ["eye", "Public profile", "/pro/setup/review"],
  ["user", "Profile & photo", "/pro/setup/profile?edit=1"],
  ["grid", "Services & prices", "/pro/setup/services?edit=1"],
  ["camera", "Portfolio & social", "/pro/setup/portfolio?edit=1"],
  ["pin", "Location & travel radius", "/pro/setup/location?edit=1"],
  ["clock", "Hours", "/pro/setup/hours?edit=1"],
  ["hand", "Communication & accessibility", "/pro/setup/communication?edit=1"],
  ["id", "Professional status", "/pro/setup/credentials?edit=1"],
  ["card", "Subscription", "/pro/payments"],
  ["sparkle", "Model calls", "/pro/model-calls"],
  ["cal", "Appointments", "/pro/appointments"],
  ["star", "Client photos", "/pro/client-photos"],
  ["file", "How Nearest works", "/pro/guide"],
];

export default async function Business() {
  const { viewer, user, profile } = await requirePro();
  const [standing, blocked] = await Promise.all([proStanding(user.id), selfDeleteBlocker(user.id)]);
  const live = profile.reviewStatus === "approved" && profile.searchable && !profile.listingPausedAt && !profile.membershipPausedAt;
  const status = live ? ["Active • Searchable", "ok"] : profile.reviewStatus === "submitted" ? ["In review", "warn"] : profile.reviewStatus === "rejected" ? ["Changes needed", "bad"] : profile.reviewStatus === "approved" ? ["Approved • Offline", "warn"] : ["Setting up", ""];
  const fineCount = standing.fines.length;
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">My business</div><span className="sp" /></div>
      <div className="body">
        <div className="row">
          {profile.photoUrl ? <Image src={profile.photoUrl} alt="" width={84} height={84} style={{ borderRadius: 42, objectFit: "cover" }} /> : <div className="avatar lg">{initials(user)}</div>}
          <div className="col g4"><span className="disp h2">{profile.businessName ?? `${user.firstName} ${user.lastName}`}</span><span className={`tag ${status[1]}`} style={{ alignSelf: "flex-start" }}>{status[0]}</span></div>
        </div>
        <GoLiveCard profile={profile} />
        <div className="col" style={{ gap: 0 }}>
          {LINKS.map(([icon, text, href]) => (
            <Link key={href} className="item" href={href}><Icon name={icon} /><span className="grow">{text}</span><Icon name="right" size="s" /></Link>
          ))}
          <Link className="item" href="/pro/account-status"><Icon name="shield" /><span className="grow">Account status</span>{fineCount > 0 && <span className="tag warn">{fineCount} fine{fineCount === 1 ? "" : "s"}</span>}{standing.suspendedUntil && <span className="tag bad">Suspended</span>}<Icon name="right" size="s" /></Link>
          {viewer.admin && <Link className="item" href="/workspace"><Icon name="switch" /><span className="grow">Switch workspace</span><Icon name="right" size="s" /></Link>}
        </div>
        <DeleteMyAccount blocked={blocked} owner={Boolean(viewer.admin)} />
        <div className="card small">
          <div className="row between"><span className="muted">Email</span><span>{user.email}</span></div>
        </div>
        <SignOutButton redirectUrl="/pro"><button className="btn ghost" type="button">Sign out</button></SignOutButton>
      </div>
      <Tabs kind="pro" active="Business" />
    </div>
  );
}
