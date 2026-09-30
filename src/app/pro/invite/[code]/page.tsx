import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { checkInvite, INVITE_MESSAGES } from "@/lib/invites";
import { getFlag } from "@/lib/settings";

export const metadata = { title: "Nearest invitation" };

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
  const rate = `$${((invite.rateCents ?? 1500) / 100).toFixed(0)}`;
  const offer = invite.kind === "AMBASSADOR"
    ? { tag: "Ambassador Invitation", title: "You're invited to join Nearest as an Ambassador.", price: "Free", line: "No sign-up fee and no monthly membership.", note: "Share Nearest with other professionals and help them get on board." }
    : invite.kind === "BOOKING_PAID"
      ? { tag: "Special Invitation", title: "You're invited to join Nearest.", price: `${rate}/month`, line: "Nothing to pay up front — it's collected from your bookings.", note: `Once ${rate} is covered for the month, the rest is all yours. A month with no bookings costs nothing.` }
      : { tag: "First In Invitation", title: "You're invited to join Nearest First In.", price: "$11/month", line: "For your first 12 months.", note: "Your First In rate is locked to your account." };
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t xs muted">nearest.com/pro • invitation link</div><span className="sp" /></div>
      <div className="body">
        <Image src="/brand/nearest-monogram.png" alt="" width={96} height={96} />
        <span className="tag warn" style={{ alignSelf: "flex-start" }}><Icon name="sparkle" size="s" /> {offer.tag}</span>
        <h1 className="disp h1">{offer.title}</h1>
        <div className="card">
          <div className="row between small"><span className="muted">Invitation code</span><span className="b num">{invite.code}</span></div>
          {city && <div className="row between small"><span className="muted">City</span><span className="b">{city}</span></div>}
          <div className="row between small"><span className="muted">Expires</span><span className="b">{fmt(invite.expiresAt)} — {days} {days === 1 ? "day" : "days"}</span></div>
        </div>
        <div className="card pearl">
          <span className="disp h2">{offer.price}</span>
          <span className="small">{offer.line}</span>
          <span className="xs muted">{offer.note}</span>
        </div>
        <div style={{ flex: 1 }} />
        <Link className="btn" href={accept}>Accept invitation</Link>
        {regOpen && <Link className="btn ghost" href="/pro/sign-up">Register without an invitation</Link>}
      </div>
    </div>
  );
}
