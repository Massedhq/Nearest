import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { desc, sql } from "drizzle-orm";
import { db, salesReps, repPayouts } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { ExpiryField } from "@/components/ExpiryField";
import { expiryLabel } from "@/lib/invite-expiry";
import { CopyText } from "@/components/CopyText";
import { requireAdmin } from "@/lib/admin";
import { mainOwnerId } from "@/lib/partner";
import { repLinks, repStats } from "@/lib/reps";
import { fmtDate } from "@/lib/time";
import { inviteRep, resendRepInvite, setRepStatus, payRep, reviewRepVerification } from "@/app/admin/rep-actions";

export const metadata = { title: "Sales Board" };

/** The main owner's sales team: invite reps, see who signed up through each rep's link. Nobody else can open this. */
export default async function SalesBoard() {
  const { user } = await requireAdmin();
  if ((await mainOwnerId()) !== user.id) notFound();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const reps = await db.select().from(salesReps).orderBy(desc(salesReps.createdAt));
  const stats = await repStats(reps.map((r) => r.id));
  const paidRows = await db.select({ repId: repPayouts.repId, cents: sql<number>`coalesce(sum(${repPayouts.amountCents}),0)::int` }).from(repPayouts).groupBy(repPayouts.repId);
  const paid = (id: string) => paidRows.find((p) => p.repId === id)?.cents ?? 0;
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
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Verified reps</span><span className="stat">{reps.filter((r) => r.status === "active" && r.verificationStatus === "approved").length}</span>{reps.some((r) => r.status === "active" && r.verificationStatus === "pending") && <span className="xs" style={{ color: "#E3C58A" }}>{reps.filter((r) => r.status === "active" && r.verificationStatus === "pending").length} waiting for your review</span>}</div>
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
            <ExpiryField id="rep-exp" label="Invitation expires" />
          </div>
        </ActionForm>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Your sales team</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Rep</th><th>Status</th><th>Agreement</th><th>Verification</th><th>Sign-ups</th><th>Pros (joined)</th><th>Students</th><th>This month</th><th>Payouts</th><th>Their links</th><th /></tr></thead>
            <tbody>
              {reps.length === 0 && <tr><td className="empty" colSpan={11}>No sales reps yet. Invite your first one above.</td></tr>}
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
                      <div className="xs muted">{r.acceptedAt ? `Since ${fmtDate(r.acceptedAt, { month: "short", day: "numeric" })}` : `Expires ${expiryLabel(r.inviteExpiresAt)}`}</div>
                    </td>
                    <td>
                      {r.agreedAt
                        ? <><span className="tag ok">Signed</span><div className="xs muted">{r.agreedName} • {fmtDate(r.agreedAt, { month: "short", day: "numeric", year: "numeric" })}</div><div className="xs muted">Version {r.agreementVersion}</div></>
                        : <span className="tag">Not yet</span>}
                    </td>
                    <td style={{ minWidth: r.verificationStatus === "pending" ? 300 : undefined }}>
                      {r.verificationStatus === "approved" && <><span className="tag ok">Verified</span>{r.verifiedAt && <div className="xs muted">{fmtDate(r.verifiedAt, { month: "short", day: "numeric", year: "numeric" })}</div>}</>}
                      {r.verificationStatus === "not_started" && <span className="tag">{r.userId ? "Not sent yet" : "After sign-up"}</span>}
                      {r.verificationStatus === "rejected" && <><span className="tag bad">Sent back</span><div className="xs muted">{r.verificationNote}</div></>}
                      {r.verificationStatus === "pending" && r.userId && (
                        <div className="col" style={{ gap: 8 }}>
                          <span className="tag warn">Needs your review</span>
                          <div className="grid2" style={{ gap: 6 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <a href={`/api/admin/id-doc/${r.userId}/gov_id`} target="_blank" rel="noreferrer"><img src={`/api/admin/id-doc/${r.userId}/gov_id`} alt={`${r.name}'s ID`} style={{ width: "100%", borderRadius: 8, border: "1px solid #2A2A2D" }} /></a>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <a href={`/api/admin/id-doc/${r.userId}/selfie`} target="_blank" rel="noreferrer"><img src={`/api/admin/id-doc/${r.userId}/selfie`} alt={`${r.name}'s selfie`} style={{ width: "100%", borderRadius: 8, border: "1px solid #2A2A2D" }} /></a>
                          </div>
                          <span className="xs muted">Check the name matches {r.agreedName ?? r.name}, the ID is current, and the selfie matches. Photos are deleted when you decide.</span>
                          <ActionForm action={reviewRepVerification} submitLabel="Approve" buttonClass="btn sm" className="col g4">
                            <input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="approve" />
                          </ActionForm>
                          <ActionForm action={reviewRepVerification} submitLabel="Send back" buttonClass="btn ghost sm" className="col g4">
                            <input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="reject" />
                            <input name="reason" placeholder="Reason (e.g. ID is blurry)" aria-label="Reason" maxLength={200} required style={{ height: 36, borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px" }} />
                          </ActionForm>
                        </div>
                      )}
                    </td>
                    <td className="num b">{s.total}</td>
                    <td className="num">{s.pros} ({s.prosJoined})</td>
                    <td className="num">{s.students}</td>
                    <td className="num">{s.thisMonth}</td>
                    <td>
                      {r.payoutsEnabled ? <span className="tag ok">{r.payoutDestination ?? "Connected"}</span> : <span className="tag">Not set up</span>}
                      <div className="xs muted">Paid ${(paid(r.id) / 100).toFixed(2)}</div>
                      {r.status === "active" && r.verificationStatus === "approved" && r.payoutsEnabled && (
                        <ActionForm action={payRep} submitLabel="Pay" buttonClass="btn sm" className="col g4">
                          <input type="hidden" name="id" value={r.id} />
                          <input name="amount" inputMode="decimal" placeholder="$ amount" aria-label={`Amount to pay ${r.name}`} required style={{ height: 36, borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px", width: 110 }} />
                          <input name="note" placeholder="Note (optional)" aria-label="Payment note" maxLength={140} style={{ height: 36, borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px", width: 140 }} />
                        </ActionForm>
                      )}
                    </td>
                    <td>
                      <div className="col" style={{ gap: 6 }}>
                        <div className="row" style={{ gap: 6 }}><span className="xs muted">Pros</span><CopyText text={links.pro} label="Copy" /></div>
                        <div className="row" style={{ gap: 6 }}><span className="xs muted">Students</span><CopyText text={links.student} label="Copy" /></div>
                      </div>
                    </td>
                    <td>
                      <div className="col" style={{ gap: 6, minWidth: 130 }}>
                        {r.status === "invited" && (
                          <ActionForm action={resendRepInvite} submitLabel="Resend invite" buttonClass="btn ghost sm" className="col g4"><input type="hidden" name="id" value={r.id} /><input name="expiresAt" type="datetime-local" required aria-label="New expiration" style={{ height: 36, borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 8px" }} /></ActionForm>
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
