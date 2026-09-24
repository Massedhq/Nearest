import Link from "next/link";
import { requirePro } from "@/lib/pro";
import { threadsFor } from "@/lib/threads";
import { fmtDate } from "@/lib/time";
import { Tabs } from "@/components/Tabs";

export const metadata = { title: "Messages" };

export default async function ProMessages() {
  const { user } = await requirePro();
  const rows = await threadsFor(user.id, "pro");
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">Messages</div><span className="sp" /></div>
      <div className="body">
        {rows.length === 0 && <p className="small muted p">Each booking gets its own thread here.</p>}
        <div className="col" style={{ gap: 0 }}>
          {rows.map((r) => (
            <Link key={r.id} className="item" href={`/pro/appointments/${r.id}/messages`}>
              <div className="avatar sm">{(r.first ?? "?")[0]}{(r.last ?? "")[0]}</div>
              <div className="grow" style={{ minWidth: 0 }}><div className="b">{r.first} {r.last?.[0]}.</div><div className="xs muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.serviceName} • {r.lastBody ?? "No messages yet"}</div></div>
              <span className="xs muted">{fmtDate(r.lastAt ? new Date(r.lastAt) : r.startsAt, { month: "short", day: "numeric" })}</span>
            </Link>
          ))}
        </div>
        <p className="xs muted p">Threads close 90 days after the appointment.</p>
      </div>
      <Tabs kind="pro" active="Messages" />
    </div>
  );
}
