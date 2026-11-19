import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { getViewer, destinationFor } from "@/lib/viewer";
import { assistantRows, assistViewer } from "@/lib/assistants";
import { startAssisting, stopAssisting } from "@/app/pro/assistant-actions";

export const metadata = { title: "Assistant", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "That invitation link isn't valid. Ask the professional for a new one.",
  email: "Sign in with the email the invitation was sent to.",
  removed: "That professional removed you as their assistant, or the invitation was cancelled.",
  expired: "That invitation has expired. Ask the professional to send a new one.",
  account: "This email already has a different kind of Nearest account. Ask the professional to invite another email.",
};

/** What an assistant can open while managing a partner. Each page re-checks access on the server. */
const TILES = [
  { href: "/pro/model-calls", title: "Model Calls", sub: "Post, edit or close" },
  { href: "/pro/model-calls/new", title: "Post a Model Call", sub: "Find models fast" },
  { href: "/pro/setup/services?edit=1", title: "Services & prices", sub: "Add, edit, photos, 360° videos" },
  { href: "/pro/setup/portfolio?edit=1", title: "Photos & looks", sub: "Portfolio, looks, featured" },
  { href: "/pro/partner", title: "Partner page", sub: "Headline, links, top services" },
  { href: "/pro/appointments", title: "Appointments", sub: "Start, finish, details" },
  { href: "/pro/messages", title: "Messages", sub: "Message clients" },
  { href: "/pro/calendar", title: "Calendar", sub: "See the schedule" },
];

/** Partner assistants' home: pick the business to manage, then jump to what they can do. */
export default async function AssistantHome({ searchParams }: { searchParams: Promise<{ e?: string; blocked?: string }> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  if (!viewer?.user) redirect("/sign-in?redirect_url=/pro/assistant");
  const err = sp.e ? ERRORS[sp.e] : null;
  if (viewer.user.accountType !== "staff" || viewer.admin) {
    if (err) return <Shell><div className="card warn"><span className="small">{err}</span></div></Shell>;
    redirect(await destinationFor(viewer));
  }
  const [rows, acting] = await Promise.all([assistantRows(viewer.user.id), assistViewer(viewer)]);
  const nameOf = (r: (typeof rows)[number]) => r.businessName || r.displayName || r.firstName || "Professional";
  const current = acting ? rows.find((r) => r.partnerId === acting.user!.id) : null;

  return (
    <Shell>
      {err && <div className="card warn"><span className="small">{err}</span></div>}
      {sp.blocked && <div className="card warn"><span className="small">Assistants can&apos;t open that part of the account (payouts, earnings, ID, Terms and account settings stay with the professional).</span></div>}
      {current ? (
        <>
          <div className="card" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {current.photoUrl ? <Image src={current.photoUrl} alt="" width={56} height={56} style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover" }} /> : null}
            <span className="col grow" style={{ gap: 2 }}><span className="xs muted">You&apos;re managing</span><span className="b">{nameOf(current)}</span></span>
            <form action={stopAssisting}><button className="btn ghost sm" type="submit">Stop</button></form>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {TILES.map((t) => (
              <Link key={t.href} href={t.href} className="card" style={{ gap: 4, textDecoration: "none", color: "inherit" }}>
                <span className="b">{t.title}</span><span className="xs muted">{t.sub}</span>
              </Link>
            ))}
          </div>
          <span className="xs muted">Every change you make shows in {nameOf(current)}&apos;s account as made by you. Payouts, earnings, ID, Terms and account settings stay with the professional.</span>
        </>
      ) : rows.length ? (
        <>
          <h2 className="disp h2" style={{ margin: 0 }}>Which business are you helping?</h2>
          {rows.map((r) => (
            <form key={r.id} action={startAssisting} className="card" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <input type="hidden" name="partnerId" value={r.partnerId} />
              {r.photoUrl ? <Image src={r.photoUrl} alt="" width={48} height={48} style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover" }} /> : null}
              <span className="b grow">{nameOf(r)}</span>
              <button className="btn sm" type="submit">Manage</button>
            </form>
          ))}
        </>
      ) : (
        !err && <div className="card"><span className="small">You&apos;re not an assistant for any business right now. When a professional invites you, open the link in their email.</span></div>
      )}
      {current && rows.length > 1 && (
        <details>
          <summary className="small" style={{ cursor: "pointer" }}>Switch business</summary>
          <div className="col" style={{ gap: 8, marginTop: 8 }}>
            {rows.filter((r) => r.partnerId !== current.partnerId).map((r) => (
              <form key={r.id} action={startAssisting} className="row between" style={{ alignItems: "center" }}>
                <input type="hidden" name="partnerId" value={r.partnerId} />
                <span className="small">{nameOf(r)}</span><button className="btn ghost sm" type="submit">Manage</button>
              </form>
            ))}
          </div>
        </details>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="scr">
      <div className="body" style={{ gap: 14, maxWidth: 520, margin: "0 auto", width: "100%" }}>
        <div className="row between" style={{ alignItems: "center" }}>
          <Image src="/brand/nearest-wordmark.png" alt="Nearest" width={120} height={36} style={{ objectFit: "contain" }} />
          <SignOutButton redirectUrl="/"><button className="btn ghost sm" type="button">Sign out</button></SignOutButton>
        </div>
        <span className="eyebrow">Assistant</span>
        {children}
      </div>
    </div>
  );
}
