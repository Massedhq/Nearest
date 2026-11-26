import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, teamAssistants, users } from "@/db";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import type { FieldActor } from "@/lib/team";
import { MAX_TEAM_ASSISTANTS } from "@/lib/team";
import { inviteTeamAssistant, resendTeamAssistant, removeTeamAssistant, createAssistantLogin, resetAssistantPassword, saveAssistantSigner } from "@/app/field-actions";
import { viewAsAssistant } from "@/app/task-actions";
import { minutesToday } from "@/lib/field-tasks";
import { TimeBar } from "./TaskViews";

/** Owners: invite and remove their own assistants, and see what each one did lately. The main owner sees every owner's. */
export async function TeamView({ actor }: { actor: FieldActor }) {
  const rows = await db.select({ a: teamAssistants, owner: users.firstName }).from(teamAssistants).innerJoin(users, eq(users.id, teamAssistants.ownerId))
    .where(and(inArray(teamAssistants.status, ["invited", "active"]), actor.scope ? eq(teamAssistants.ownerId, actor.user.id) : sql`true`))
    .orderBy(desc(teamAssistants.createdAt));
  const ids = rows.map((r) => r.a.userId).filter((x): x is string => !!x);
  const recent = ids.length ? (await db.execute(sql`select l.action, l.created_at as at, l.after, u.first_name as who from activity_log l join users u on u.id = l.actor_user_id
    where l.actor_user_id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) order by l.created_at desc limit 40`)).rows as { action: string; at: string; after: Record<string, unknown> | null; who: string | null }[] : [];
  const mins = await minutesToday(ids);
  const minHours = (await (await import("@/lib/field-goals")).fieldGoals()).minHours;
  const label = (a: string) => a.replace(/^field\./, "").replace(/^vouchers\./, "cards ").replace(/^live\./, "").replace(/_/g, " ");
  return (
    <div className="col" style={{ gap: 18 }}>
      <section className="card" style={{ gap: 12 }}>
        <span className="eyebrow">Add an assistant — set her password</span>
        <span className="xs muted">They get their own login and work only your outreach and your area: tasks and reports, organizations, calls and emails, meetings and drop-offs, card requests (you approve), pop-ups, professional sign-ups, video educators, ad prep (you approve), training and the live vote map. They never see money, students, card numbers or codes, settings, or anyone else&apos;s area. Up to {MAX_TEAM_ASSISTANTS}.</span>
        <ActionForm action={createAssistantLogin} submitLabel="Create her login">
          <div className="grid2">
            <div className="field"><label>Name she goes by</label><input name="name" required maxLength={80} placeholder="Nicky" /></div>
            <div className="field"><label>Her email (she signs in with it)</label><input name="email" type="email" required maxLength={160} placeholder="info@usenearest.com" /></div>
            <div className="field"><label>Password (10+ characters — or leave empty and one is made)</label><input name="password" type="text" autoComplete="new-password" minLength={10} maxLength={128} /></div>
            <div className="field"><label>Legal name (for signing agreements)</label><input name="legalName" maxLength={120} placeholder="Nicole Corbin" /></div>
            <div className="field"><label>Department / title</label><input name="title" maxLength={120} placeholder="Outreach &amp; Marketing Department" /></div>
          </div>
          <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="canSign" /> Allowed to sign video educator agreements for Nearest</label>
          <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="sendEmail" defaultChecked /> Email her the sign-in link, email and password</label>
        </ActionForm>
        <details><summary className="link xs">Or email her an invitation link instead</summary>
          <div style={{ marginTop: 10 }}>
            <ActionForm action={inviteTeamAssistant} submitLabel="Send invitation" buttonClass="btn ghost sm">
              <div className="grid2">
                <div className="field"><label>Name</label><input name="name" required maxLength={80} /></div>
                <div className="field"><label>Their email (they sign in with it)</label><input name="email" type="email" required maxLength={160} placeholder="name@usenearest.com" /></div>
              </div>
            </ActionForm>
          </div>
        </details>
      </section>
      <section className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Assistants</span>
        {rows.length === 0 ? <span className="small muted">No assistants yet.</span> : rows.map(({ a, owner }) => (
          <div key={a.id} className="col fsep" style={{ gap: 8, paddingBottom: 12 }}>
            <div className="row between" style={{ flexWrap: "wrap" }}>
              <span className="b">{a.name} <span className="xs muted">· {a.email}{actor.scope === null ? ` · works for ${owner}` : ""}{a.legalName ? ` · ${a.legalName}` : ""}{a.title ? `, ${a.title}` : ""}</span></span>
              <span className={`tag ${a.status === "active" ? "ok" : "warn"}`}>{a.status === "active" ? "Active" : a.inviteExpiresAt.getTime() < Date.now() ? "Invitation expired" : "Invited"}</span>
            </div>
            {a.status === "active" && <TimeBar time={a.userId ? mins.get(a.userId) : undefined} goal={minHours} />}
            <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
              {a.status === "active" && <form action={viewAsAssistant}><input type="hidden" name="id" value={a.id} /><button className="link xs b">See {a.name.split(" ")[0]}&apos;s screen</button></form>}
              {a.status === "invited" && <form action={resendTeamAssistant}><input type="hidden" name="id" value={a.id} /><button className="link xs">Send a new link</button></form>}
              <form action={removeTeamAssistant}><input type="hidden" name="id" value={a.id} /><ConfirmSubmit label="Remove" ask={`Remove ${a.name}? Their access ends right away. Everything they logged stays.`} /></form>
            </div>
            {a.status === "active" && (
              <details><summary className="link xs">Password and signing</summary>
                <div className="grid2" style={{ marginTop: 10, alignItems: "start" }}>
                  <ActionForm action={resetAssistantPassword} submitLabel="Set new password" buttonClass="btn ghost sm">
                    <input type="hidden" name="id" value={a.id} />
                    <div className="field"><label>New password (empty = make one)</label><input name="password" type="text" autoComplete="new-password" maxLength={128} /></div>
                    <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="sendEmail" defaultChecked /> Email it to her with the sign-in link</label>
                  </ActionForm>
                  <ActionForm action={saveAssistantSigner} submitLabel="Save signing" buttonClass="btn ghost sm">
                    <input type="hidden" name="id" value={a.id} />
                    <div className="field"><label>Legal name</label><input name="legalName" maxLength={120} defaultValue={a.legalName ?? ""} /></div>
                    <div className="field"><label>Department / title</label><input name="title" maxLength={120} defaultValue={a.title ?? ""} /></div>
                    <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="canSign" defaultChecked={a.canSign} /> Can sign video educator agreements for Nearest</label>
                  </ActionForm>
                </div>
              </details>
            )}
          </div>
        ))}
      </section>
      <section className="card" style={{ gap: 10 }}>
        <span className="eyebrow">What your assistants did lately</span>
        {recent.length === 0 ? <span className="small muted">Nothing yet.</span> : (
          <table className="tbl"><tbody>{recent.map((r, i) => (
            <tr key={i}><td className="small">{new Date(r.at).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
              <td className="small b">{r.who}</td><td className="small">{label(r.action)}{r.after && typeof r.after === "object" && ("name" in r.after || "place" in r.after) ? ` — ${String(r.after.name ?? r.after.place)}` : ""}</td></tr>
          ))}</tbody></table>
        )}
      </section>
    </div>
  );
}
