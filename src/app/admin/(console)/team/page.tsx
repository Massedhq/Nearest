import { desc, eq } from "drizzle-orm";
import { db, users, adminMembers, activityLog } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { requireAdmin, activityVisibleTo, isMainOwner } from "@/lib/admin";
import { displayName, ownerAllowed } from "@/lib/viewer";
import { ActionForm } from "@/components/ActionForm";
import { restoreOwner, deleteActivity } from "@/app/admin/team-actions";
import { saveOwnerMenu } from "@/app/admin/owner-menu-actions";
import { extraMenu } from "@/lib/owner-menu";
import { ALL_MENU_ITEMS, SIMPLE_MENU } from "@/lib/owner-menu-items";

export const metadata = { title: "Team & Activity Log" };

const when = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
const show = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

export default async function Team() {
  const { user } = await requireAdmin();
  const visible = await activityVisibleTo(user.id); // other owners never see the main owner's activity
  const main = await isMainOwner(user.id); // only the main owner can delete log entries
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
      .where(visible)
      .orderBy(desc(activityLog.createdAt))
      .limit(100),
  ]);
  return (
    <>
      <AdminHead eyebrow="Individual logins — never shared" title="Team & Activity Log" />
      {main && <OwnerMenus members={members.filter((r) => r.m.role === "OWNER" && r.u.id !== user.id).map((r) => ({ id: r.u.id, name: displayName(r.u) || r.u.email || "Owner" }))} />}
      <div className="acols even">
        <div className="card" style={{ gap: 12 }}>
          <span className="eyebrow">Partners &amp; roles</span>
          <table className="tbl">
            <thead><tr><th>Person</th><th>Email</th><th>Role</th><th>Access</th></tr></thead>
            <tbody>
              {members.map(({ m, u }) => (
                <tr key={u.id} style={{ opacity: m.active && ownerAllowed(u, m.role) ? 1 : 0.55 }}>
                  <td>{displayName(u) || "—"}</td><td>{u.email}</td><td><span className="tag">{m.role}</span></td>
                  <td>
                    {m.active && ownerAllowed(u, m.role) ? <span className="tag ok">Active</span> : <span className="tag bad" title="Not in OWNER_EMAILS, or this is a professional/student account">No access</span>}
                    {u.accountType !== "staff" && (
                      <details style={{ marginTop: 6 }}>
                        <summary className="link small" style={{ cursor: "pointer" }}>Restore owner account</summary>
                        <div className="card warn small" style={{ gap: 8, marginTop: 6, minWidth: 240 }}>
                          <span>A professional sign-up was written onto this owner login. Restoring puts the owner&apos;s real name back from their login, removes the attached professional business, and reopens the invitation.</span>
                          <ActionForm action={restoreOwner} submitLabel="Restore owner account" buttonClass="btn sm"><input type="hidden" name="userId" value={u.id} /></ActionForm>
                        </div>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="xs muted p">Owners are added on first sign-in only when their email is in OWNER_EMAILS and the account isn&apos;t a professional or student account. Access is re-checked on every page.</p>
        </div>
        <div className="card" style={{ gap: 12, overflowX: "auto" }}>
          <form action={deleteActivity} className="col" style={{ gap: 12 }}>
          <div className="row between"><span className="eyebrow">Activity log</span>{main && log.length > 0 && <button className="btn ghost sm" type="submit" style={{ width: "auto", color: "#F2A38F" }}>Delete selected</button>}</div>
          <table className="tbl">
            <thead><tr>{main && <th />}<th>Time</th><th>Admin</th><th>Action</th><th>Target</th><th>Before → After</th></tr></thead>
            <tbody>
              {log.length === 0 && <tr><td className="empty" colSpan={main ? 6 : 5}>Nothing logged yet.</td></tr>}
              {log.map(({ l, first, last }) => (
                <tr key={l.id}>
                  {main && <td><input type="checkbox" name="id" value={l.id} aria-label="Select this entry" /></td>}
                  <td>{when(l.createdAt)}</td>
                  <td>{[first, last].filter(Boolean).join(" ") || "System"}</td>
                  <td>{l.action}</td>
                  <td className="num">{l.targetId}</td>
                  <td className="num">{l.before !== null || l.after !== null ? `${show(l.before)} → ${show(l.after)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </form>
        </div>
      </div>
    </>
  );
}

/**
 * Main owner: each other owner starts with the simple menu (only what they need to grow Nearest). Tick a page to add it
 * to their menu; untick to take it off. Your own pages (money, Nearest Cards, partner pages…) can't be added.
 */
async function OwnerMenus({ members }: { members: { id: string; name: string }[] }) {
  if (!members.length) return null;
  const extras = await Promise.all(members.map((m) => extraMenu(m.id)));
  const choices = ALL_MENU_ITEMS.filter((i) => !i.mainOnly && !SIMPLE_MENU.includes(i.href));
  const simple = ALL_MENU_ITEMS.filter((i) => SIMPLE_MENU.includes(i.href)).map((i) => i.label).join(", ");
  return (
    <div className="card" style={{ gap: 12 }} id="their-menu">
      <span className="eyebrow">Their menu</span>
      <span className="xs muted">Every other owner always has the simple menu: {simple}. Tick a page to add it to their menu (it shows right away); untick to take it off. Pages not on their menu are blocked for them.</span>
      {members.map((m, n) => (
        <details key={m.id} className="fsep" style={{ paddingTop: 8 }}>
          <summary className="b" style={{ cursor: "pointer" }}>{m.name} — {extras[n].length ? `${extras[n].length} extra page${extras[n].length > 1 ? "s" : ""}` : "simple menu only"}</summary>
          <ActionForm action={saveOwnerMenu} submitLabel={`Save ${m.name.split(" ")[0]}'s menu`}>
            <input type="hidden" name="userId" value={m.id} />
            <div className="grid2" style={{ gap: 6 }}>
              {choices.map((c) => (
                <label key={c.href} className="check small"><input type="checkbox" name="href" value={c.href} defaultChecked={extras[n].includes(c.href)} /> {c.label} <span className="xs muted">({c.section})</span></label>
              ))}
            </div>
          </ActionForm>
        </details>
      ))}
    </div>
  );
}
