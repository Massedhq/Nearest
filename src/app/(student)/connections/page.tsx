import Link from "next/link";
import Image from "next/image";
import { TopBar } from "@/components/TopBar";
import { ConnectSearch } from "@/components/ConnectSearch";
import { CopyText } from "@/components/CopyText";
import { requireVerifiedStudent } from "@/lib/student";
import { ensureUsername, myConnections, sharedWithMe, shortName } from "@/lib/connections";
import { answerRequest, removeConnectionAction } from "@/app/connection-actions";
import { fmtDate } from "@/lib/time";

export const metadata = { title: "Connections" };
export const dynamic = "force-dynamic";

export default async function Connections() {
  const { user } = await requireVerifiedStudent();
  const [username, mine, shared] = await Promise.all([ensureUsername(user), myConnections(user.id), sharedWithMe(user.id)]);
  return (
    <div className="scr">
      <TopBar title="Connections" back="/account" />
      <div className="body">
        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">Your username</span>
          <div className="row between"><span className="disp h2">@{username ?? "—"}</span>{username && <CopyText text={`@${username}`} />}</div>
          <span className="xs muted">Share it with friends so they can find you and Connect.</span>
        </div>

        <div className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Connect</span>
          <ConnectSearch />
        </div>

        {(mine.incoming.length > 0 || mine.sent.length > 0) && (
          <div className="card" style={{ gap: 8 }}>
            <span className="eyebrow">Pending Connections</span>
            {mine.incoming.map((r) => (
              <div key={r.requestId} className="item">
                <span className="grow"><span className="b">{r.name}</span>{r.school && <span className="xs muted"> • {r.school}</span>}<span className="xs muted" style={{ display: "block" }}>Wants to connect</span></span>
                <form action={answerRequest}><input type="hidden" name="id" value={r.requestId} /><input type="hidden" name="accept" value="1" /><button className="btn sm" type="submit">Accept</button></form>
                <form action={answerRequest}><input type="hidden" name="id" value={r.requestId} /><input type="hidden" name="accept" value="0" /><button className="btn ghost sm" type="submit">Decline</button></form>
              </div>
            ))}
            {mine.sent.map((r) => (
              <div key={r.id} className="item"><span className="grow"><span className="b">{r.name}</span><span className="xs muted" style={{ display: "block" }}>Request sent</span></span>
                <form action={removeConnectionAction}><input type="hidden" name="otherId" value={r.id} /><button className="btn ghost sm" type="submit">Cancel</button></form>
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">My Connections ({mine.connected.length})</span>
          {mine.connected.length === 0 && <span className="small muted">No connections yet. Find a classmate above and tap Connect.</span>}
          {mine.connected.map((c) => (
            <div key={c.id} className="item">
              <span className="grow"><span className="b">{c.name}</span>{c.school && <span className="xs muted"> • {c.school}</span>}</span>
              <form action={removeConnectionAction}><input type="hidden" name="otherId" value={c.id} /><button className="btn ghost sm" type="submit">Remove</button></form>
            </div>
          ))}
        </div>

        {shared.length > 0 && (
          <div className="card" style={{ gap: 8 }}>
            <span className="eyebrow">Shared with you</span>
            {shared.map((s) => (
              <Link key={s.id} href={`/p/${s.proId}`} className="item" style={{ textDecoration: "none" }}>
                {s.photo ? <Image src={s.photo} alt="" width={40} height={40} style={{ borderRadius: 20, objectFit: "cover" }} /> : <span className="avatar" style={{ width: 40, height: 40 }}>{(s.business ?? "N")[0]}</span>}
                <span className="grow"><span className="b">{s.business ?? "Professional"}</span><span className="xs muted" style={{ display: "block" }}>From {shortName({ firstName: s.first, lastName: s.last })} • {fmtDate(s.at, { month: "short", day: "numeric" })}</span></span>
              </Link>
            ))}
          </div>
        )}
        <p className="xs muted p">Only students you&apos;ve connected with can send you professionals. Remove a connection anytime.</p>
      </div>
    </div>
  );
}
