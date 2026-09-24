import Link from "next/link";
import { requireVerifiedStudent } from "@/lib/student";
import { threadsFor } from "@/lib/threads";
import { fmtDate } from "@/lib/time";
import { Tabs } from "@/components/Tabs";

export const metadata = { title: "Messages" };

export default async function Messages() {
  const { user } = await requireVerifiedStudent();
  const rows = await threadsFor(user.id, "student");
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">Messages</div><span className="sp" /></div>
      <div className="body">
        {rows.length === 0 && <p className="small muted p">Messages with your professionals show up here after you book.</p>}
        <div className="col" style={{ gap: 0 }}>
          {rows.map((r) => (
            <Link key={r.id} className="item" href={`/bookings/${r.id}/messages`}>
              <div className="avatar sm">{(r.pro ?? "N").slice(0, 2).toUpperCase()}</div>
              <div className="grow" style={{ minWidth: 0 }}><div className="b">{r.pro}</div><div className="xs muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.serviceName} • {r.lastBody ?? "No messages yet"}</div></div>
              <span className="xs muted">{fmtDate(r.lastAt ? new Date(r.lastAt) : r.startsAt, { month: "short", day: "numeric" })}</span>
            </Link>
          ))}
        </div>
      </div>
      <Tabs kind="student" active="Messages" />
    </div>
  );
}
