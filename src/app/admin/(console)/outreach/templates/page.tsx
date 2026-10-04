import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { OutreachNav } from "@/components/OutreachNav";
import { requireAdmin } from "@/lib/admin";
import { getTemplates, render, TEMPLATE_LABELS, REPLY_TO, type TemplateKey } from "@/lib/outreach-mail";
import { saveTemplates, sendTestOutreach } from "@/app/admin/outreach-actions";

export const metadata = { title: "Outreach templates" };

const SAMPLE = { first_name: "Christina", name: "Christina Lopez", city: "The Colony", category: "nails", recruiter: "Avy Evans", link: "https://www.usenearest.com/go/…", spots_left: "3" };
const field = { width: "100%", borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "10px 12px", font: "inherit", lineHeight: 1.5 } as const;

/** Edit exactly what Nearest emails to prospects: the first email and two follow-ups. */
export default async function OutreachTemplates() {
  const { user } = await requireAdmin();
  const { templates, address } = await getTemplates();
  const st = await (await import("@/lib/settings")).getSettings();
  const f1 = Number(st["outreach.follow1_days"] ?? 3), f2 = Number(st["outreach.follow2_days"] ?? 4);
  const keys: TemplateKey[] = ["first", "follow1", "follow2"];
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="Email templates" />
      <OutreachNav at="templates" />
      <div className="card small" style={{ gap: 4 }}>
        <span>These are the exact emails prospects receive. They come from <span className="b">your name at Nearest</span>, and replies go to <span className="b">{REPLY_TO}</span>. Every email automatically ends with your mailing address and an unsubscribe link.</span>
        <span className="muted">Fill-ins: <code>{"{first_name}"}</code> <code>{"{name}"}</code> <code>{"{city}"}</code> <code>{"{category}"}</code> <code>{"{recruiter}"}</code> <code>{"{spots_left}"}</code> and <code>{"{link}"}</code> — their personal invite, good for 24 hours (required in every email). Follow-ups go out {f1} days after the first email and {f1 + f2} days after it (change this in Rules &amp; Settings → Outreach), and stop if they join, unsubscribe or you pause them.</span>
      </div>
      <ActionForm action={saveTemplates} submitLabel="Save templates">
        {keys.map((k) => (
          <div key={k} className="card" style={{ gap: 8 }}>
            <span className="eyebrow">{TEMPLATE_LABELS[k]}</span>
            <label className="xs muted" htmlFor={`${k}_subject`}>Subject</label>
            <input id={`${k}_subject`} name={`${k}_subject`} defaultValue={templates[k].subject} maxLength={200} required style={field} />
            <label className="xs muted" htmlFor={`${k}_body`}>Message</label>
            <textarea id={`${k}_body`} name={`${k}_body`} defaultValue={templates[k].body} rows={14} maxLength={5000} required style={field} />
          </div>
        ))}
        <div className="card" style={{ gap: 6 }}>
          <span className="eyebrow">Mailing address (required by law)</span>
          <input name="address" defaultValue={address} placeholder="Nearest, 1234 Main St, Suite 100, Frisco, TX 75034" maxLength={300} required style={field} />
          <span className="xs muted">The CAN-SPAM Act requires a real postal address (a P.O. box or registered mailbox works). Emails won&apos;t send until this is filled in.</span>
        </div>
      </ActionForm>

      <span className="eyebrow p">Preview (saved version, with sample details)</span>
      {keys.map((k) => (
        <div key={k} className="card" style={{ gap: 8, background: "#fff", color: "#1a1a1a", borderColor: "#fff" }}>
          <span style={{ fontSize: 11, color: "#777" }}>{TEMPLATE_LABELS[k]} • From: {[user.firstName, user.lastName].filter(Boolean).join(" ") || "You"} at Nearest • Reply-to: {REPLY_TO}</span>
          <span style={{ fontWeight: 600 }}>{render(templates[k].subject, SAMPLE)}</span>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.55 }}>{render(templates[k].body, SAMPLE)}</div>
          <span style={{ fontSize: 11, color: "#888", borderTop: "1px solid #eee", paddingTop: 8 }}>{address || "⚠ Add your mailing address above"} • Unsubscribe</span>
          <ActionForm action={sendTestOutreach} submitLabel="Email me a test" buttonClass="btn sm" className="col g4"><input type="hidden" name="key" value={k} /></ActionForm>
        </div>
      ))}
    </>
  );
}
