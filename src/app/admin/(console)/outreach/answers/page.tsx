import { asc } from "drizzle-orm";
import { db, outreachAnswers } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { OutreachNav } from "@/components/OutreachNav";
import { requireAdmin } from "@/lib/admin";
import { getFlag } from "@/lib/settings";
import { getAiCopy } from "@/lib/outreach-ai";
import { saveAiCopy, addAnswer, deleteAnswer, setAiEnabled } from "@/app/admin/outreach-actions";

export const metadata = { title: "AI recruiter answers" };
const field = { width: "100%", borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "10px 12px", font: "inherit", lineHeight: 1.5 } as const;

/** Teach the AI recruiter: its playbook, what it must never say, its holding reply, and approved answers. */
export default async function OutreachAnswers() {
  const { role } = await requireAdmin();
  const [on, copy, answers] = await Promise.all([getFlag("outreach.ai_enabled"), getAiCopy(), db.select().from(outreachAnswers).orderBy(asc(outreachAnswers.createdAt))]);
  const keyOk = Boolean(process.env.ANTHROPIC_API_KEY), inboxOk = Boolean(process.env.RESEND_INBOUND_SECRET);
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="AI recruiter" />
      <OutreachNav at="answers" />
      <div className={`card ${keyOk && inboxOk && on ? "ok" : "warn"}`} style={{ gap: 6 }}>
        <span className="small b">{keyOk && inboxOk && on ? "The AI recruiter is answering replies." : "The AI recruiter isn't answering yet."}</span>
        <span className="xs">{keyOk ? "✓" : "✗"} AI key (ANTHROPIC_API_KEY in Vercel) • {inboxOk ? "✓" : "✗"} Incoming email (info@usenearest.com → Resend → RESEND_INBOUND_SECRET) • {on ? "✓ Turned on" : "✗ Turned off"}</span>
        <span className="xs muted">Until all three are ✓, replies go to Needs review for a person to answer.</span>
        {role === "OWNER" && <form action={setAiEnabled}><input type="hidden" name="on" value={on ? "0" : "1"} /><button className={on ? "btn ghost sm" : "btn sm"} type="submit">{on ? "Turn the AI off" : "Turn the AI on"}</button></form>}
      </div>
      <div className="card small" style={{ gap: 4 }}>
        <span>The AI only answers from: the <span className="b">How Nearest works professional guide</span> (always current), <span className="b">live spots and prices</span> for the prospect&apos;s city and category, the <span className="b">approved answers</span> below, and your playbook. Anything else goes to <span className="b">Needs review</span> — it never guesses.</span>
      </div>

      <ActionForm action={saveAiCopy} submitLabel="Save playbook">
        <div className="card" style={{ gap: 6 }}>
          <span className="eyebrow">Playbook — how to sell Nearest</span>
          <textarea name="playbook" defaultValue={copy.playbook} rows={16} maxLength={12000} required style={field} />
        </div>
        <div className="card" style={{ gap: 6 }}>
          <span className="eyebrow">Never say</span>
          <textarea name="never" defaultValue={copy.never} rows={7} maxLength={6000} required style={field} />
        </div>
        <div className="card" style={{ gap: 6 }}>
          <span className="eyebrow">Holding reply (sent when it needs a person)</span>
          <textarea name="holding" defaultValue={copy.holding} rows={3} maxLength={1000} required style={field} />
        </div>
      </ActionForm>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Approved answers ({answers.length})</span>
        <span className="xs muted">Questions the AI can now answer exactly your way. Answers you save from Needs review land here too.</span>
        {answers.map((a) => (
          <div key={a.id} className="card" style={{ gap: 4 }}>
            <span className="small b">{a.question}</span>
            <span className="small" style={{ whiteSpace: "pre-wrap" }}>{a.answer}</span>
            <form action={deleteAnswer}><input type="hidden" name="id" value={a.id} /><button className="link xs" type="submit">Remove</button></form>
          </div>
        ))}
        <ActionForm action={addAnswer} submitLabel="Add answer" buttonClass="btn sm" className="col g8">
          <input name="question" placeholder="Question (e.g. Can I bring my own clients?)" maxLength={500} style={field} aria-label="Question" />
          <textarea name="answer" placeholder="Approved answer" rows={3} maxLength={3000} style={field} aria-label="Answer" />
        </ActionForm>
      </div>
    </>
  );
}
