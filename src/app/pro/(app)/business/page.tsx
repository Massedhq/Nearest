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
import { SideSwitch } from "@/components/SideSwitch";
import { currentSide } from "@/lib/pro-side";
import { partnerApplyStatus } from "@/lib/partner-apply";

export const metadata = { title: "Menu" };

// The pro Menu (2026-11-22, owner). Student side = the "My business" mockup list. Partners on the Partner side get
// their own Partner menu with everything for the partner page one tap away; a switch at the top changes sides.
const PARTNER_LINKS: [string, string, string][] = [
  ["home", "Partner home", "/pro/home"],
  ["sparkle", "Model Calls", "/pro/model-calls"],
  ["grid", "Services & prices", "/pro/setup/services?edit=1"],
  ["camera", "Photos & looks", "/pro/setup/portfolio?edit=1"],
  ["cal", "Appointments", "/pro/appointments"],
  ["clock", "Calendar & hours", "/pro/calendar"],
  ["msg", "Messages", "/pro/messages"],
  ["store", "My shop", "/pro/partner/shop"],
  ["file", "Shop orders", "/pro/partner/orders"],
  ["wallet", "Earnings", "/pro/earnings"],
  ["user", "My assistants", "/pro/partner#assistants"],
  ["user", "Profile & photo", "/pro/setup/profile?edit=1"],
  ["pin", "Location & travel", "/pro/setup/location?edit=1"],
  ["card", "Fees & payouts", "/pro/payments"],
  ["file", "How Nearest works", "/pro/guide"],
];
const LINKS: [string, string, string][] = [
  ["eye", "Public profile", "/pro/setup/review"],
  ["user", "Profile & photo", "/pro/setup/profile?edit=1"],
  ["grid", "Services & prices", "/pro/setup/services?edit=1"],
  ["camera", "Portfolio & social", "/pro/setup/portfolio?edit=1"],
  ["pin", "Location & travel radius", "/pro/setup/location?edit=1"],
  ["clock", "Hours", "/pro/setup/hours?edit=1"],
  ["hand", "Communication & accessibility", "/pro/setup/communication?edit=1"],
  ["id", "Professional status", "/pro/setup/credentials?edit=1"],
  ["shield", "Professional Protection", "/pro/protection"],
  ["card", "Fees & payouts", "/pro/payments"],
  ["sparkle", "Model calls", "/pro/model-calls"],
  ["cal", "Appointments", "/pro/appointments"],
  ["star", "Client photos", "/pro/client-photos"],
  ["file", "How Nearest works", "/pro/guide"],
];

export default async function Business() {
  const { viewer, user, profile } = await requirePro();
  const [standing, blocked, partner] = await Promise.all([proStanding(user.id), selfDeleteBlocker(user.id), (await import("@/lib/partners")).partnerPageFor(user.id)]);
  const updateCount = (await import("@/lib/pro-updates")).pendingUpdates(profile, viewer.admin?.role === "OWNER" || (await (await import("@/lib/entry")).isOwnerBusiness(profile.userId))).length;
  const live = profile.reviewStatus === "approved" && profile.searchable && !profile.listingPausedAt && !profile.membershipPausedAt;
  const status = live ? ["Active • Searchable", "ok"] : profile.reviewStatus === "submitted" ? ["In review", "warn"] : profile.reviewStatus === "rejected" ? ["Changes needed", "bad"] : profile.reviewStatus === "approved" ? ["Approved • Offline", "warn"] : ["Setting up", ""];
  const fineCount = standing.fines.length;
  const { side, canSwitch } = await currentSide(user.id);
  const apply = partner ? null : await partnerApplyStatus(user.id, user.email);
  const partnerSide = Boolean(partner) && side === "partner";
  const partnerView = partner?.published && !partner.pausedAt && profile.slug ? `/link/${profile.slug}` : "/pro/partner-preview";
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">{partnerSide ? "Partner menu" : "My business"}</div><span className="sp" /></div>
      <div className="body">
        <div className="row">
          {profile.photoUrl ? <Image src={profile.photoUrl} alt="" width={84} height={84} style={{ borderRadius: 42, objectFit: "cover" }} /> : <div className="avatar lg">{initials(user)}</div>}
          <div className="col g4"><span className="disp h2">{profile.businessName ?? `${user.firstName} ${user.lastName}`}</span><span className={`tag ${status[1]}`} style={{ alignSelf: "flex-start" }}>{status[0]}</span></div>
        </div>
        <SideSwitch side={side} canSwitch={canSwitch} back="/pro/business" />
        {partnerSide ? (
          <>
            <div className="row" style={{ gap: 8 }}>
              <Link className="btn sm" href={partnerView} style={{ flex: 1 }}>View my partner page</Link>
              <Link className="btn ghost sm" href="/pro/partner" style={{ flex: 1 }}>Edit my partner page</Link>
            </div>
            <div className="col" style={{ gap: 0 }}>
              {PARTNER_LINKS.map(([icon, text, href]) => (
                <Link key={href} className="item" href={href}><Icon name={icon} /><span className="grow">{text}</span><Icon name="right" size="s" /></Link>
              ))}
            </div>
          </>
        ) : <GoLiveCard profile={profile} />}
        <div className="col" style={{ gap: 0 }}>
          {!partnerSide && LINKS.map(([icon, text, href]) => (
            <Link key={href} className="item" href={href}><Icon name={icon} /><span className="grow">{text}</span><Icon name="right" size="s" /></Link>
          ))}
          {partner && !partnerSide && <Link className="item" href="/pro/partner"><Icon name="link" /><span className="grow">Partner page</span>{partner && <span className={`tag ${partner.published && !partner.pausedAt ? "ok" : ""}`}>{partner.pausedAt ? "Paused" : partner.published ? "Live" : "Hidden"}</span>}<Icon name="right" size="s" /></Link>}
          <Link className="item" href="/pro/learn"><Icon name="school" /><span className="grow">Learn at Nearest</span><span className="tag warn">Coming soon</span><Icon name="right" size="s" /></Link>
          <Link className="item" href="/pro/updates"><Icon name="bell" /><span className="grow">Updates</span>{updateCount > 0 && <span className="tag warn">{updateCount} to review</span>}<Icon name="right" size="s" /></Link>
          <Link className="item" href="/pro/account-status"><Icon name="shield" /><span className="grow">Account status</span>{fineCount > 0 && <span className="tag warn">{fineCount} fine{fineCount === 1 ? "" : "s"}</span>}{standing.suspendedUntil && <span className="tag bad">Suspended</span>}<Icon name="right" size="s" /></Link>
          {viewer.admin && <Link className="item" href="/workspace"><Icon name="switch" /><span className="grow">Switch workspace</span><Icon name="right" size="s" /></Link>}
          {!partnerSide && !partner && apply && <Link className="item" href="/pro/become-partner"><Icon name="sparkle" /><span className="grow">Become a Nearest Partner</span><span className={`tag ${apply.eligible ? "ok" : ""}`}>{apply.pending ? "In review" : apply.eligible ? "You qualify" : `${Math.min(apply.completed, apply.min)} of ${apply.min} bookings`}</span><Icon name="right" size="s" /></Link>}
        </div>
        <DeleteMyAccount blocked={blocked} owner={Boolean(viewer.admin)} />
        <div className="card small">
          <div className="row between"><span className="muted">Email</span><span>{user.email}</span></div>
        </div>
        <SignOutButton redirectUrl="/pro"><button className="btn ghost" type="button">Sign out</button></SignOutButton>
      </div>
      <Tabs kind="pro" active="Menu" />
    </div>
  );
}
