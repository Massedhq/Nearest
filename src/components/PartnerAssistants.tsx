import { ActionForm } from "@/components/ActionForm";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { inviteAssistant, removeAssistant, resendAssistant } from "@/app/pro/assistant-actions";
import { ASSIST_WORDS, MAX_ASSISTANTS, assistantActivity, partnerAssistantList } from "@/lib/assistants";
import { fmtDate, fmtTime } from "@/lib/time";

/** Business → Partner page → My assistants (the partner only — never shown to an assistant). */
export async function PartnerAssistants({ partnerId }: { partnerId: string }) {
  const [rows, activity] = await Promise.all([partnerAssistantList(partnerId), assistantActivity(partnerId)]);
  const shown = rows.filter((r) => r.status !== "removed");
  return (
    <div id="assistants" className="card" style={{ gap: 12 }}>
      <span className="b">My assistants</span>
      <span className="small muted">Add someone to help run your business. They get their own login and can post Model Calls, update services and prices, add photos and looks, edit this page, see appointments and message clients. They never see payouts, earnings, your ID, Terms or account settings. Remove them any time.</span>
      {shown.map((a) => (
        <div key={a.id} className="row between" style={{ gap: 8, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--line, #2A2A2E)", paddingTop: 10 }}>
          <span className="col" style={{ gap: 2 }}>
            <span className="small b">{a.name}</span>
            <span className="xs muted">{a.email} · {a.status === "active" ? "Active" : a.inviteExpiresAt.getTime() < Date.now() ? "Invitation expired" : "Invitation sent"}</span>
          </span>
          <span className="row" style={{ gap: 12, alignItems: "center" }}>
            {a.status === "invited" && <form action={resendAssistant}><input type="hidden" name="id" value={a.id} /><button className="link xs" type="submit">Send a new link</button></form>}
            <form action={removeAssistant}><input type="hidden" name="id" value={a.id} /><ConfirmSubmit label={a.status === "active" ? "Remove" : "Cancel invite"} ask="Sure?" /></form>
          </span>
        </div>
      ))}
      {shown.length < MAX_ASSISTANTS && (
        <ActionForm action={inviteAssistant} submitLabel="Send invitation" className="col g8" buttonClass="btn sm">
          <div className="grid2">
            <div className="field"><label htmlFor="as-name">Assistant&apos;s name</label><input id="as-name" name="name" maxLength={80} required /></div>
            <div className="field"><label htmlFor="as-email">Their email</label><input id="as-email" name="email" type="email" maxLength={160} required /></div>
          </div>
        </ActionForm>
      )}
      {activity.length > 0 && (
        <details>
          <summary className="small" style={{ cursor: "pointer" }}>What your assistants changed</summary>
          <div className="col" style={{ gap: 6, marginTop: 8 }}>
            {activity.map((x, i) => {
              const by = (x.after as { by?: string } | null)?.by ?? "Assistant";
              return <span key={i} className="xs"><span className="b">{by}</span> · {ASSIST_WORDS[x.action] ?? x.action.replace("assistant.", "").replace(/_/g, " ")} · <span className="muted">{fmtDate(x.at)} {fmtTime(x.at)}</span></span>;
            })}
          </div>
        </details>
      )}
    </div>
  );
}
