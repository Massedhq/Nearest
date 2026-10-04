import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, adminNotifications } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { requireAdmin } from "@/lib/admin";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

/** Admin bell: newest first. Opening this page marks them read (history is kept). */
export default async function Notifications() {
  const { user } = await requireAdmin();
  const list = await db.select().from(adminNotifications).where(eq(adminNotifications.userId, user.id)).orderBy(desc(adminNotifications.createdAt)).limit(200);
  await db.update(adminNotifications).set({ readAt: new Date() }).where(and(eq(adminNotifications.userId, user.id), isNull(adminNotifications.readAt)));
  return (
    <>
      <AdminHead eyebrow="Admin" title="Notifications" />
      <div className="card" style={{ gap: 0, padding: "4px 14px" }}>
        {list.length === 0 && <span className="small muted" style={{ padding: 12 }}>Nothing yet. New registrations, completed profiles, full markets and imports needing review show up here.</span>}
        {list.map((n) => {
          const inner = (
            <div className="col g4" style={{ padding: "10px 0", borderTop: "1px solid #1C1C1F" }}>
              <div className="row between"><span className="b small">{!n.readAt && <span style={{ color: "#E3C58A" }}>● </span>}{n.title}</span><span className="xs muted">{n.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}</span></div>
              {n.body && <span className="small muted">{n.body}</span>}
            </div>
          );
          return n.href ? <Link key={n.id} href={n.href} style={{ textDecoration: "none", color: "inherit" }}>{inner}</Link> : <div key={n.id}>{inner}</div>;
        })}
      </div>
    </>
  );
}
