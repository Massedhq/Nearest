import Link from "next/link";
import { Icon } from "./Icon";
import { fmtDate, fmtTime } from "@/lib/time";

type N = { id: string; kind: string; title: string; body: string | null; href: string | null; readAt: Date | null; createdAt: Date };
const ICON: Record<string, string> = { booked: "check", reminder: "clock", finish: "star", cancelled: "x", credit: "wallet", message: "msg", verified: "shield", verification: "shield", approved: "shield", review: "file", fine: "alert", appeal: "file" };

export function InboxList({ items }: { items: N[] }) {
  if (!items.length) return <p className="small muted p">No notifications yet.</p>;
  return (
    <div className="col" style={{ gap: 0 }}>
      {items.map((n) => {
        const inner = (
          <>
            <span className="iconbtn" style={n.readAt ? undefined : { borderColor: "#ECE8E1" }}><Icon name={ICON[n.kind] ?? "bell"} /></span>
            <div className="grow" style={{ minWidth: 0 }}><div className={`small ${n.readAt ? "" : "b"}`}>{n.title}</div>{n.body && <div className="xs muted">{n.body}</div>}</div>
            <span className="xs muted" style={{ whiteSpace: "nowrap" }}>{Date.now() - n.createdAt.getTime() < 86400000 ? fmtTime(n.createdAt) : fmtDate(n.createdAt, { month: "short", day: "numeric" })}</span>
          </>
        );
        return n.href ? <Link key={n.id} className="item" href={n.href}>{inner}</Link> : <div key={n.id} className="item">{inner}</div>;
      })}
    </div>
  );
}

export function Bell({ href, unread }: { href: string; unread: number }) {
  return (
    <Link className="iconbtn" href={href} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
      <Icon name="bell" />{unread > 0 && <span className="dotn" />}
    </Link>
  );
}
