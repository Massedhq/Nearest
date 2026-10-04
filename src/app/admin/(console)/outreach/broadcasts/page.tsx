import { desc } from "drizzle-orm";
import { db, broadcasts } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { OutreachNav } from "@/components/OutreachNav";
import { requireAdmin } from "@/lib/admin";
import { getTemplates } from "@/lib/outreach-mail";
import { createBroadcast, setBroadcastStatus } from "@/app/admin/outreach-actions";

export const metadata = { title: "Broadcasts" };
const field = { width: "100%", borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "10px 12px", font: "inherit", lineHeight: 1.5 } as const;
const sel = { ...field, height: 42, padding: "0 10px" } as const;

/** Send one email to a chosen audience. Separate from recruiting — it never changes anyone's outreach status. */
export default async function Broadcasts() {
  const { role } = await requireAdmin();
  const [list, { address }] = await Promise.all([db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt)).limit(30), getTemplates()]);
  const owner = role === "OWNER";
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="Broadcasts" />
      <OutreachNav at="broadcasts" />
      <div className="card small" style={{ gap: 4 }}>
        <span>Send one email to a group — an announcement, a reminder, an update. It comes from <span className="b">Nearest</span>, replies come back to Nearest, and every email has an unsubscribe link. Anyone who unsubscribed or is on do-not-contact is skipped. Broadcasts never change anyone&apos;s recruiting status.</span>
        {!address && <span style={{ color: "#E3C58A" }}>⚠ Add your mailing address on Templates first.</span>}
      </div>

      {owner ? (
        <div className="card" style={{ gap: 10 }}>
          <span className="eyebrow">New broadcast</span>
          <ActionForm action={createBroadcast} submitLabel="Count recipients and make a draft" buttonClass="btn sm" className="col g8">
            <div className="grid2" style={{ gap: 8 }}>
              <label className="xs muted">Send to
                <select name="kind" defaultValue="pros" style={sel}>
                  <option value="pros">Professionals</option>
                  <option value="prospects">Prospects (outreach)</option>
                  <option value="students">Students</option>
                </select>
              </label>
              <label className="xs muted">Professionals
                <select name="pros_status" defaultValue="all" style={sel}>
                  <option value="all">All who joined</option><option value="live">Live</option><option value="incomplete">Profile not finished</option><option value="waiting">Waiting for their city to open</option>
                </select>
              </label>
              <label className="xs muted">Prospects
                <select name="prospects_status" defaultValue="active" style={sel}>
                  <option value="active">Active (not joined, not opted out)</option><option value="contacted">Emailed, not joined</option><option value="no_response">No response</option><option value="registered">Joined</option>
                </select>
              </label>
              <label className="xs muted">Students
                <select name="students_status" defaultValue="verified" style={sel}><option value="verified">Verified</option><option value="all">All with an account</option></select>
              </label>
              <input name="city" placeholder="City (optional)" maxLength={80} style={sel} aria-label="City" />
              <input name="category" placeholder="Category (optional, pros & prospects)" maxLength={80} style={sel} aria-label="Category" />
            </div>
            <label className="check xs"><input type="checkbox" name="onlyMine" /><span>Prospects: only mine</span></label>
            <input name="subject" placeholder="Subject" maxLength={200} style={field} aria-label="Subject" />
            <textarea name="body" placeholder={"Message — {first_name} fills in their first name"} rows={8} maxLength={8000} style={field} aria-label="Message" />
          </ActionForm>
          <span className="xs muted">The first dropdown decides the audience; the matching status dropdown is used. Nothing sends yet — you&apos;ll see the exact count first.</span>
        </div>
      ) : <div className="card small"><span>Only owners can send broadcasts.</span></div>}

      {list.map((b) => (
        <div key={b.id} className={`card ${b.status === "draft" ? "warn" : b.status === "sent" ? "ok" : ""}`} style={{ gap: 6 }}>
          <div className="row between" style={{ gap: 6, flexWrap: "wrap" }}>
            <span className="b">{b.subject}</span>
            <span className="tag">{b.status === "draft" ? "Draft" : b.status === "sending" ? `Sending ${b.sent}/${b.recipients}` : b.status === "sent" ? `Sent to ${b.sent}` : "Cancelled"}</span>
          </div>
          <span className="xs muted">{b.label} • {b.recipients} recipient{b.recipients === 1 ? "" : "s"} • {b.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}</span>
          {b.status === "draft" && (
            <>
              <div className="card small" style={{ whiteSpace: "pre-wrap", background: "#fff", color: "#1a1a1a", borderColor: "#fff" }}>{b.body.replace(/\{first_name\}/g, "Christina")}</div>
              {owner && (
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <form action={setBroadcastStatus} className="row" style={{ gap: 8, alignItems: "center" }}>
                    <input type="hidden" name="id" value={b.id} /><input type="hidden" name="to" value="send" />
                    <label className="check xs"><input type="checkbox" name="confirm" required /><span>Send to {b.recipients}</span></label>
                    <button className="btn sm" type="submit">Send</button>
                  </form>
                  <form action={setBroadcastStatus}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="to" value="delete" /><button className="btn ghost sm" type="submit">Delete draft</button></form>
                </div>
              )}
            </>
          )}
          {b.status === "sending" && owner && <form action={setBroadcastStatus}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="to" value="cancel" /><button className="btn ghost sm" type="submit">Stop sending</button></form>}
          {b.status === "sending" && <span className="xs muted">Goes out in batches every 15 minutes.</span>}
        </div>
      ))}
    </>
  );
}
