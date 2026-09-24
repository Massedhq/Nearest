import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { checkInvite, INVITE_MESSAGES } from "@/lib/invites";
import { getFlag } from "@/lib/settings";

export const metadata = { title: "Founding invitation" };

const fmt = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" });

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const check = await checkInvite(decodeURIComponent(code));
  const regOpen = await getFlag("status.pro_registration");

  if (!check.ok) {
    return (
      <div className="scr">
        <div className="top"><span className="sp" /><div className="t xs muted">nearest.com/pro • invitation link</div><span className="sp" /></div>
        <div className="body">
          <Image src="/brand/nearest-monogram.png" alt="" width={96} height={96} />
          <h1 className="disp h2">Invitation unavailable</h1>
          <div className="card bad"><span>{INVITE_MESSAGES[check.reason]}</span></div>
          <div style={{ flex: 1 }} />
          {regOpen && <Link className="btn ghost" href="/pro/sign-up">Register without an invitation</Link>}
        </div>
      </div>
    );
  }

  const { invite, city } = check;
  const days = Math.max(0, Math.ceil((invite.expiresAt.getTime() - Date.now()) / 86400000));
  const accept = `/pro/sign-up?invite=${encodeURIComponent(invite.code)}`;
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t xs muted">nearest.com/pro • invitation link</div><span className="sp" /></div>
      <div className="body">
        <Image src="/brand/nearest-monogram.png" alt="" width={96} height={96} />
        <span className="tag warn" style={{ alignSelf: "flex-start" }}><Icon name="sparkle" size="s" /> Founding Professional Invitation</span>
        <h1 className="disp h1">You&apos;re invited to join Nearest&apos;s founding 750.</h1>
        <div className="card">
          <div className="row between small"><span className="muted">Invitation code</span><span className="b num">{invite.code}</span></div>
          <div className="row between small"><span className="muted">City</span><span className="b">{city}</span></div>
          <div className="row between small"><span className="muted">Expires</span><span className="b">{fmt(invite.expiresAt)} — {days} {days === 1 ? "day" : "days"}</span></div>
        </div>
        <div className="card pearl">
          <span className="disp h2">30 days free</span>
          <span className="small">Then $10/month for your first 12 months.</span>
          <span className="xs muted">Your founding rate is locked to your account.</span>
        </div>
        <div style={{ flex: 1 }} />
        <Link className="btn" href={accept}>Accept invitation</Link>
        {regOpen && <Link className="btn ghost" href="/pro/sign-up">Register without an invitation</Link>}
      </div>
    </div>
  );
}
