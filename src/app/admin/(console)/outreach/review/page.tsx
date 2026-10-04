import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, prospects, prospectMessages, users } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { OutreachNav } from "@/components/OutreachNav";
import { requireAdmin } from "@/lib/admin";
import { outreachScope } from "@/lib/outreach";
import { replyToProspect } from "@/app/admin/outreach-actions";

export const metadata = { title: "Needs review" };
const field = { width: "100%", borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "10px 12px", font: "inherit", lineHeight: 1.5 } as const;

/** Replies the AI couldn't answer from approved information (or that came in while the AI is off). */
export default async function NeedsReview() {
  const { user } = await requireAdmin();
  const { isMain } = await outreachScope(user.id);
  const rows = await db.select({ p: prospects, who: users.firstName }).from(prospects).leftJoin(users, eq(users.id, prospects.recruiterId))
    .where(and(eq(prospects.status, "needs_review"), ...(isMain ? [] : [eq(prospects.recruiterId, user.id)]))).orderBy(desc(prospects.lastMessageAt)).limit(100);
  const ids = rows.map((r) => r.p.id);
  const lastIn = ids.length ? await db.select().from(prospectMessages).where(and(inArray(prospectMessages.prospectId, ids), eq(prospectMessages.direction, "in"))).orderBy(desc(prospectMessages.createdAt)) : [];
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title={`Needs review (${rows.length})`} />
      <OutreachNav at="review" />
      {rows.length === 0 && <div className="card small"><span>Nothing needs you right now.</span></div>}
      {rows.map(({ p, who }) => {
        const msg = lastIn.find((m) => m.prospectId === p.id);
        return (
          <div key={p.id} className="card" style={{ gap: 8 }}>
            <div className="row between" style={{ flexWrap: "wrap", gap: 6 }}>
              <Link className="b link" href={`/admin/outreach/prospects/${p.id}`}>{p.name}</Link>
              <span className="xs muted">{[p.category, p.city].filter(Boolean).join(" • ")}{isMain && who ? ` • ${who}` : ""}</span>
            </div>
            {p.reviewQuestion && <span className="small"><span className="b">Needs an answer:</span> {p.reviewQuestion}</span>}
            {msg && <div className="card small" style={{ whiteSpace: "pre-wrap" }}>{msg.body}</div>}
            <ActionForm action={replyToProspect} submitLabel="Send reply" buttonClass="btn sm" className="col g8">
              <input type="hidden" name="id" value={p.id} />
              <textarea name="body" rows={4} placeholder="Your reply (sent from you at Nearest)" maxLength={5000} style={field} aria-label="Reply" />
              <label className="check xs"><input type="checkbox" name="withLink" /><span>Add their personal invite link (24 hours)</span></label>
              <label className="check xs"><input type="checkbox" name="save" defaultChecked /><span>Save as an approved answer so the AI handles this next time</span></label>
              <input name="saveQuestion" defaultValue={p.reviewQuestion ?? ""} maxLength={500} style={field} aria-label="Question to save" />
            </ActionForm>
          </div>
        );
      })}
    </>
  );
}
