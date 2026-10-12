import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { Icon } from "@/components/Icon";
import { Tabs } from "@/components/Tabs";
import { displayName, initials } from "@/lib/viewer";
import { requireStudent, schoolArea, isAlumni } from "@/lib/student";
import { headers } from "next/headers";
import { InviteFriends } from "@/components/InviteFriends";
import { ensureInviteCode, inviteSummary } from "@/lib/student-invites";
import { getViewer } from "@/lib/viewer";
import { DeleteMyAccount } from "@/components/DeleteMyAccount";
import { selfDeleteBlocker } from "@/lib/accounts";

export const metadata = { title: "Account" };

export default async function Account() {
  const { user: u, profile } = await requireStudent();
  const isOwner = (await getViewer())?.admin?.role === "OWNER";
  const area = profile.schoolId ? await schoolArea(profile.schoolId) : null;
  const verified = profile.verificationStatus === "verified";
  // Invite friends: verified students get their own link; both students get $5 when the friend is verified.
  const inviteCode = verified && u.accountType === "student" ? await ensureInviteCode(u.id) : null;
  const h = await headers();
  const inviteLink = inviteCode ? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}/?friend=${inviteCode}` : null;
  const invites = inviteCode ? await inviteSummary(u.id) : null;
  // Launch campaign entry point (not shown while the campaign is still a draft, unless they're already in it).
  const { getCampaign, entryFor, effectiveStatus, STATUS_LABEL } = await import("@/lib/campaign");
  const [camp, myEntry] = await Promise.all([getCampaign(), entryFor(u.id)]);
  const campaign = myEntry || camp.status !== "draft" ? { entry: Boolean(myEntry), label: myEntry ? STATUS_LABEL[effectiveStatus(myEntry)] : "", status: myEntry ? effectiveStatus(myEntry) : "", reward: camp.rewardTitle ?? "your free service", opens: camp.bookingOpensAt && camp.bookingOpensAt.getTime() > Date.now() ? camp.bookingOpensAt : null } : null;
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">Account</div><span className="sp" /></div>
      <div className="body">
        <div className="row">
          <div className="avatar lg">{initials(u)}</div>
          <div className="col g4">
            <span className="disp h2">{displayName(u)}</span>
            <span className={`badge${verified ? "" : " mute"}`}><Icon name="shield" size="s" /> {verified ? (isAlumni(profile) ? "Nearest Alumni" : "Verified Student") : profile.schoolEmailVerifiedAt ? "Temporary access — verification pending" : "Verification in progress"}</span>
            {area && <span className="xs muted">{area.school}{profile.graduationYear ? ` • Class of ${profile.graduationYear}` : ""}</span>}
          </div>
        </div>
        {campaign && (
          <Link className={`card${campaign.status === "approved" ? " ok" : ""}`} href="/campaign" style={{ textDecoration: "none", color: "inherit", gap: 4 }}>
            <span className="eyebrow">{campaign.status === "approved" ? "Your campaign reward" : "Nearest launch campaign"}</span>
            <span className="small">{campaign.status === "approved"
              ? `Approved — ${campaign.reward} is in your account. ${campaign.opens ? `Redeem it after booking opens ${campaign.opens.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "long", day: "numeric", year: "numeric" })}.` : "Book it from your campaign page."}`
              : campaign.entry ? `Your campaign: ${campaign.label}` : "Optional: complete the seven-day profile-picture promotion to qualify for one free eligible service."}</span>
            <span className="btn sm" style={{ alignSelf: "flex-start" }}>{campaign.status === "approved" ? "View my reward" : campaign.entry ? "Open my campaign" : "See the campaign directions"}</span>
          </Link>
        )}
        {inviteLink && invites && <InviteFriends link={inviteLink} joined={invites.joined} verified={invites.verified} available={invites.available} />}
        <div className="card small">
          <div className="row between"><span className="muted">Email</span><span>{u?.email ?? "—"}</span></div>
        </div>
        <div className="col" style={{ gap: 0 }}>
          <Link className="item" href="/bookings"><Icon name="cal" /><span className="grow">My appointments</span><Icon name="right" size="s" /></Link>
          {isOwner && <Link className="item" href="/workspace"><Icon name="switch" /><span className="grow">Switch workspace</span><Icon name="right" size="s" /></Link>}
          <Link className="item" href="/connections"><Icon name="users" /><span className="grow">Connections</span><Icon name="right" size="s" /></Link>
          <Link className="item" href="/favorites"><Icon name="heart" /><span className="grow">Favorites</span><Icon name="right" size="s" /></Link>
          <Link className="item" href="/credits"><Icon name="wallet" /><span className="grow">My credits</span><Icon name="right" size="s" /></Link>
          <Link className="item" href="/notifications"><Icon name="bell" /><span className="grow">Notifications</span><Icon name="right" size="s" /></Link>
          <Link className="item" href="/verify/access"><Icon name="hand" /><span className="grow">Communication preferences</span><Icon name="right" size="s" /></Link>
          <Link className="item" href="/guide"><Icon name="sparkle" /><span className="grow">How Nearest works</span><Icon name="right" size="s" /></Link>
          <Link className="item" href="/terms"><Icon name="file" /><span className="grow">Terms of Service</span><Icon name="right" size="s" /></Link>
          <Link className="item" href="/privacy"><Icon name="lock" /><span className="grow">Privacy Policy</span><Icon name="right" size="s" /></Link>
        </div>
        {!isOwner && <DeleteMyAccount blocked={await selfDeleteBlocker(u.id)} />}
        <SignOutButton redirectUrl="/"><button className="btn ghost" type="button">Sign out</button></SignOutButton>
      </div>
      <Tabs kind="student" active="Account" />
    </div>
  );
}
