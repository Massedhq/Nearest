import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { desc } from "drizzle-orm";
import { db, salesReps } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { CopyText } from "@/components/CopyText";
import { requireAdmin } from "@/lib/admin";
import { mainOwnerId } from "@/lib/partner";
import { repLinks, repStats } from "@/lib/reps";
import { fmtDate } from "@/lib/time";
import { inviteRep, resendRepInvite, setRepStatus } from "@/app/admin/rep-actions";

export const metadata = { title: "Sales Board" };

/** The main owner's sales team: invite reps, see who signed up through each rep's link. Nobody else can open this. */
export default async function SalesBoard() {
  const { user } = await requireAdmin();
  if ((await mainOwnerId()) !== user.id) notFound();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const reps = await db.select().from(salesReps).orderBy(desc(salesReps.createdAt));
  const stats = await repStats(reps.map((r) => r.id));
  const live = reps.filter((r) => r.status !== "removed");
  const sum = (k: "total" | "pros" | "prosJoined" | "students" | "thisMonth") => live.reduce((t, r) => t + (stats.get(r.id)?.[k] ?? 0), 0);
  const now = Date.now();

  return (
    <>
      <AdminHead eyebrow="Only you can see this" title="Sales Board" />
      <p className="small muted" style={{ maxWidth: 760 }}>
        Your sales team. Each rep gets their own links and a dashboard that shows who signed up through them. This is separate from partners, the Sales Track and professional invitations.
      </p>

      <div className="kpis k4">
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Active reps</span><span className="stat">{reps.filter((r) => r.status === "active").length}</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Sign-ups from reps</span><span className="stat">{sum("total")}</span><span className="xs muted">{sum("thisMonth")} this month</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Professionals</span><span className="stat">{sum("pros")}</span><span className="xs muted">{sum("prosJoined")} joined</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Students</span><span className="stat">{sum("students")}</span></div>
      </div>

      <div className="card" style={{ gap: 12, maxWidth: 620 }}>
        <span className="eyebrow">+ Invite a sales rep</span>
        <span className="xs muted">They&apos;ll get an email to create their account with this exact email address. Their dashboard opens right after.</span>
        <ActionForm action={inviteRep} submitLabel="Send invitation">
          <div className="grid2">
            <div className="field"><label htmlFor="rep-name">Name</label><input id="rep-name" name="name" required maxLength={80} /></div>
            <div className="field"><label htmlFor="rep-email">Email</label><input id="rep-email" name="email" type="email" required maxLength={120} /></div>
          </div>
        </ActionForm>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Your sales team</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Rep</th><th>Status</th><th>Sign-ups</th><th>Pros (joined)</th><th>Students</th><th>This month</th><th>Their links</th><th /></tr></thead>
            <tbody>
              {reps.length === 0 && <tr><td className="empty" colSpan={8}>No sales reps yet. Invite your first one above.</td></tr>}
              {reps.map((r) => {
                const s = stats.get(r.id)!;
                const links = repLinks(origin, r.code);
                const expired = r.status === "invited" && r.inviteExpiresAt.getTime() < now;
                return (
                  <tr key={r.id} style={r.status === "removed" ? { opacity: 0.55 } : undefined}>
                    <td><div className="b">{r.name}</div><div className="xs muted">{r.email}</div></td>
                    <td>
                      <span className={`tag ${r.status === "active" ? "ok" : r.status === "removed" ? "bad" : "warn"}`}>
                        {r.status === "active" ? "Active" : r.status === "removed" ? "Removed" : expired ? "Invite expired" : "Invited"}
                      </span>
                      <div className="xs muted">{r.acceptedAt ? `Since ${fmtDate(r.acceptedAt, { month: "short", day: "numeric" })}` : `Invited ${fmtDate(r.createdAt, { month: "short", day: "numeric" })}`}</div>
                    </td>
                    <td className="num b">{s.total}</td>
                    <td className="num">{s.pros} ({s.prosJoined})</td>
                    <td className="num">{s.students}</td>
                    <td className="num">{s.thisMonth}</td>
                    <td>
                      <div className="col" style={{ gap: 6 }}>
                        <div className="row" style={{ gap: 6 }}><span className="xs muted">Pros</span><CopyText text={links.pro} label="Copy" /></div>
                        <div className="row" style={{ gap: 6 }}><span className="xs muted">Students</span><CopyText text={links.student} label="Copy" /></div>
                      </div>
                    </td>
                    <td>
                      <div className="col" style={{ gap: 6, minWidth: 130 }}>
                        {r.status === "invited" && (
                          <ActionForm action={resendRepInvite} submitLabel="Resend invite" buttonClass="btn ghost sm" className="col g4"><input type="hidden" name="id" value={r.id} /></ActionForm>
                        )}
                        {r.status !== "removed"
                          ? <ActionForm action={setRepStatus} submitLabel="Remove" buttonClass="link small" className="col g4"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="to" value="removed" /></ActionForm>
                          : <ActionForm action={setRepStatus} submitLabel="Restore" buttonClass="link small" className="col g4"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="to" value="restore" /></ActionForm>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <span className="xs muted">Removing a rep closes their dashboard and stops their links from giving credit. People who already signed up through them stay counted.</span>
      </div>
    </>
  );
}
