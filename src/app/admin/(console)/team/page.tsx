import { desc, eq } from "drizzle-orm";
import { db, users, adminMembers, activityLog } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { requireAdmin } from "@/lib/admin";
import { displayName } from "@/lib/viewer";

export const metadata = { title: "Team & Activity Log" };

const when = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
const show = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

export default async function Team() {
  await requireAdmin();
  const [members, log] = await Promise.all([
    db
      .select({ m: adminMembers, u: users })
      .from(adminMembers)
      .innerJoin(users, eq(users.id, adminMembers.userId))
      .orderBy(adminMembers.createdAt),
    db
      .select({ l: activityLog, first: users.firstName, last: users.lastName })
      .from(activityLog)
      .leftJoin(users, eq(users.id, activityLog.actorUserId))
      .orderBy(desc(activityLog.createdAt))
      .limit(100),
  ]);
  return (
    <>
      <AdminHead eyebrow="Individual logins — never shared" title="Team & Activity Log" />
      <div className="acols even">
        <div className="card" style={{ gap: 12 }}>
          <span className="eyebrow">Partners &amp; roles</span>
          <table className="tbl">
            <thead><tr><th>Person</th><th>Email</th><th>Role</th><th>Also</th></tr></thead>
            <tbody>
              {members.map(({ m, u }) => (
                <tr key={u.id}><td>{displayName(u) || "—"}</td><td>{u.email}</td><td><span className="tag">{m.role}</span></td><td>{u.accountType === "professional" ? "Professional" : "—"}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="xs muted p">Owners are added automatically on first sign-in when their email is in OWNER_EMAILS.</p>
        </div>
        <div className="card" style={{ gap: 12, overflowX: "auto" }}>
          <div className="row between"><span className="eyebrow">Activity log</span><span className="tag">Cannot be deleted</span></div>
          <table className="tbl">
            <thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Target</th><th>Before → After</th></tr></thead>
            <tbody>
              {log.length === 0 && <tr><td className="empty" colSpan={5}>Nothing logged yet.</td></tr>}
              {log.map(({ l, first, last }) => (
                <tr key={l.id}>
                  <td>{when(l.createdAt)}</td>
                  <td>{[first, last].filter(Boolean).join(" ") || "System"}</td>
                  <td>{l.action}</td>
                  <td className="num">{l.targetId}</td>
                  <td className="num">{l.before !== null || l.after !== null ? `${show(l.before)} → ${show(l.after)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
