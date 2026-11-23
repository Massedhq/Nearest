import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, teamAssistants, users, fieldTraining, educators, educatorContracts } from "@/db";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { TaskReportForm } from "./TaskReportForm";
import type { FieldActor } from "@/lib/team";
import { mayWork, ownerFirstName, withOwnerName } from "@/lib/team";
import { tasksFor, taskById, reportsFor, minutesToday, planSettings, TASK_STATUS, OUTCOMES, HOW, centralToday, addDays, dayLabel, hourLabel, type TaskRow } from "@/lib/field-tasks";
import { fieldPlaces, cardSupply, cardRequests } from "@/lib/field";
import { LESSONS, lessonById } from "@/lib/training";
import { AGREEMENT_FIELDS, AGREEMENT_SECTIONS, EDUCATOR_AGREEMENT_TITLE, NEAREST_PARTY } from "@/lib/educator-agreement";
import {
  addTask, editTask, deleteTask, startTask, sendToOwner, markHandled, approveTask, sendBackTask, savePlanSettings, makePlanNow, tickTraining, viewAsAssistant,
} from "@/app/task-actions";
import { fieldRequestCards } from "@/app/field-actions";
import { saveEducator, decideEducator, sendAgreement } from "@/app/educator-actions";

/**
 * Field tasks, reports, cards, video educators and training (2026-11-23) — shared by the owner (base "/admin/field") and
 * the assistant's white workspace (base "/outreach"). Lists are limited to the actor's scope; every action re-checks.
 */
const F = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="field"><label>{label}</label>{children}</div>;
const at = (d: string | Date) => new Date(d).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const KIND: Record<string, string> = { calls: "Calls", pros: "Professionals", popups: "Pop-ups", edu: "Video educators", ads: "Ads", training: "Training", general: "General" };
const SOURCE: Record<string, string> = { owner: "From your owner", assistant: "Added by assistant", ai: "AI plan" };
const statusTag = (s: string, boss?: string) => { const [k, l0] = TASK_STATUS[s] ?? ["", s]; const l = boss ? l0.replace("owner", boss) : l0; return <span className={`tag ${k === "ok" ? "ok" : k === "no" ? "bad" : k === "needs" || k === "done" ? "warn" : ""}`}>{l}</span>; };

/* ───────────── Time worked ───────────── */

export function TimeBar({ minutes, goal, name }: { minutes: number; goal: number; name?: string }) {
  const pct = Math.min(100, Math.round((minutes / (goal * 60)) * 100));
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="row between"><span className="small b">{name ? `${name} · ` : ""}{Math.floor(minutes / 60)}h {minutes % 60}m worked today</span><span className="xs muted">Goal {goal} hours</span></div>
      <div className="meter" aria-hidden><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/* ───────────── Task list ───────────── */

function TaskTable({ rows, base, owner, boss }: { rows: TaskRow[]; base: string; owner: boolean; boss?: string }) {
  if (!rows.length) return <span className="small muted">Nothing here.</span>;
  return (
    <table className="tbl"><thead><tr><th>Task</th><th>Due</th><th>Status</th>{owner && <th>From</th>}</tr></thead>
      <tbody>{rows.map((t) => (
        <tr key={t.id}><td><Link className="link b" href={`${base}/task/${t.id}`}>{t.title}</Link>{t.priority === "high" && <> <span className="tag warn">Priority</span></>}
          <div className="xs muted">{KIND[t.kind] ?? t.kind}{t.calls.length ? ` · ${t.calls.length} in report` : ""}{t.needsMsg && t.status === "needs" ? ` · “${t.needsMsg.slice(0, 80)}”` : ""}</div></td>
          <td className="small">{dayLabel(t.dueDate)}{t.dueTime ? ` · ${t.dueTime}` : ""}</td><td>{statusTag(t.status, boss)}</td>{owner && <td className="xs">{SOURCE[t.source] ?? t.source}</td>}</tr>
      ))}</tbody></table>
  );
}

/** The assistant's Today: time toward the goal + today's tasks in order. */
export async function TodayTasks({ actor, base, userId }: { actor: FieldActor; base: string; userId: string | null }) {
  const day = centralToday();
  const [rows, s, mins] = await Promise.all([tasksFor(actor.scope, { from: day, to: day }), planSettings(actor.ownerId), minutesToday(userId ? [userId] : [])]);
  const late = await tasksFor(actor.scope, { to: addDays(day, -1), status: ["todo", "work", "back"] });
  const boss = await ownerFirstName(actor.ownerId);
  const left = rows.filter((t) => !["done", "approved"].includes(t.status)).length;
  return (
    <section className="card" style={{ gap: 12 }}>
      <div className="row between"><span className="eyebrow">Today · {dayLabel(day)}</span><Link className="link xs" href={`${base}/tasks`}>All tasks</Link></div>
      <TimeBar minutes={(userId && mins.get(userId)) || 0} goal={s.hours} />
      {rows.length === 0 ? <span className="small muted">No tasks for today yet. Your plan arrives by {hourLabel(s.hour)} on weekdays.</span> : (
        <>
          <span className="small">{left === 0 ? "Everything for today is done." : `${left} of ${rows.length} left.`}</span>
          <TaskTable rows={rows} base={base} owner={false} boss={boss} />
        </>
      )}
      {late.length > 0 && <><span className="eyebrow">Still open from earlier days</span><TaskTable rows={late} base={base} owner={false} boss={boss} /></>}
    </section>
  );
}

/* ───────────── Tasks page ───────────── */

function AddTaskForm({ actor, owners }: { actor: FieldActor; owners: { id: string; name: string | null }[] }) {
  const owner = !actor.assistant;
  return (
    <ActionForm action={addTask} submitLabel="Add task">
      <div className="grid2">
        <F label="Task"><input name="title" required maxLength={160} placeholder={owner ? "Call 8 youth programs in Plano" : "Follow up with Grace Church"} /></F>
        <F label="Kind"><select name="kind" defaultValue="calls">{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F>
        <F label="Day"><input name="due" type="date" defaultValue={centralToday()} /></F>
        <F label="Time (optional)"><input name="time" type="time" /></F>
        <F label="Priority"><select name="priority" defaultValue="normal"><option value="normal">Normal</option><option value="high">High</option></select></F>
        {owner && <F label="Repeat"><select name="repeat" defaultValue="once"><option value="once">Just this day</option><option value="weekdays">Every weekday</option></select></F>}
        {owner && actor.main && owners.length > 1 && <F label="For whose assistant"><select name="ownerId" defaultValue={actor.user.id}>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></F>}
      </div>
      <F label="Why it matters (optional)"><input name="why" maxLength={300} placeholder="Plano has 40 votes for lashes and no live lash tech" /></F>
      <F label="Steps (one per line, optional)"><textarea name="steps" maxLength={3000} placeholder={"Search Google Maps for youth programs in Plano\nCall each one, ask for the program director\nBook drop-offs for 10 cards"} /></F>
    </ActionForm>
  );
}

export async function TasksPage({ actor, base, day: dayIn }: { actor: FieldActor; base: string; day?: string }) {
  const owner = !actor.assistant;
  const day = dayIn && /^\d{4}-\d{2}-\d{2}$/.test(dayIn) ? dayIn : centralToday();
  const [rows, upcomingRows, templates] = await Promise.all([
    tasksFor(actor.scope, { from: day, to: day }), tasksFor(actor.scope, { from: addDays(day, 1), to: addDays(day, 14) }), owner ? tasksFor(actor.scope, { templates: true }) : Promise.resolve([] as TaskRow[]),
  ]);
  const waiting = owner ? await tasksFor(actor.scope, { status: ["needs", "done"] }) : [];
  const owners = owner && actor.main ? (await db.execute(sql`select u.id, u.first_name as name from admin_members m join users u on u.id = m.user_id where m.role = 'OWNER' and m.active order by u.first_name`)).rows as { id: string; name: string | null }[] : [];
  const boss = owner ? undefined : await ownerFirstName(actor.ownerId);
  const nav = (d: string, l: string) => <Link className="chip" href={`${base}/tasks?day=${d}`}>{l}</Link>;
  return (
    <div className="col" style={{ gap: 18 }}>
      {owner && <PlanCard actor={actor} />}
      {owner && waiting.length > 0 && (
        <section className="card warn" style={{ gap: 10 }}><span className="eyebrow">Waiting for you</span><TaskTable rows={waiting} base={base} owner /></section>
      )}
      <section className="card" style={{ gap: 12 }}>
        <div className="row between" style={{ flexWrap: "wrap" }}><span className="eyebrow">{dayLabel(day)}</span>
          <div className="chips">{nav(addDays(day, -1), "← Day before")}{nav(centralToday(), "Today")}{nav(addDays(day, 1), "Next day →")}</div></div>
        <TaskTable rows={rows} base={base} owner={owner} boss={boss} />
      </section>
      <section className="card" style={{ gap: 12 }}>
        <span className="eyebrow">{owner ? "Plan the day — add a task" : "Add your own task"}</span>
        {!owner && <span className="xs muted">For follow-ups you set yourself. {boss} sees these too.</span>}
        <AddTaskForm actor={actor} owners={owners} />
      </section>
      {owner && (
        <section className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Every weekday</span>
          <span className="xs muted">These are copied into each weekday&apos;s plan automatically.</span>
          {templates.length === 0 ? <span className="small muted">None yet. Add a task with Repeat → Every weekday.</span> : (
            <table className="tbl"><tbody>{templates.map((t) => (
              <tr key={t.id}><td className="b">{t.title}<div className="xs muted">{KIND[t.kind]}{t.dueTime ? ` · ${t.dueTime}` : ""}{actor.scope === null && t.ownerName ? ` · ${t.ownerName}` : ""}</div></td>
                <td><form action={deleteTask}><input type="hidden" name="id" value={t.id} /><ConfirmSubmit label="Stop repeating" ask="Remove this repeating task? Days already planned keep it." /></form></td></tr>
            ))}</tbody></table>
          )}
        </section>
      )}
      <section className="card" style={{ gap: 10 }}><span className="eyebrow">Next two weeks</span><TaskTable rows={upcomingRows} base={base} owner={owner} boss={boss} /></section>
    </div>
  );
}

async function PlanCard({ actor }: { actor: FieldActor }) {
  const s = await planSettings(actor.user.id);
  return (
    <section className="card" style={{ gap: 12 }}>
      <span className="eyebrow">Daily AI plan</span>
      <span className="xs muted">Every weekday at your send time, Nearest AI writes your assistant&apos;s plan from what&apos;s going on: where students are voting with no live professional, call-backs from her reports, meetings and drop-offs coming up, card supply, video educators and her next training lesson. Your every-weekday tasks come first. She gets it in the app and by email; you get a copy.{s.lastPlanDate ? ` Last plan: ${dayLabel(s.lastPlanDate)}.` : ""}</span>
      <ActionForm action={savePlanSettings} submitLabel="Save plan settings">
        <div className="grid3">
          <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="on" defaultChecked={s.on} /> Send a plan every weekday</label>
          <F label="Send at (Central)"><select name="hour" defaultValue={s.hour}>{[6, 7, 8, 9, 10].map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></F>
          <F label="Hours of work"><select name="hours" defaultValue={s.hours}>{[2, 3, 4, 5, 6, 7, 8].map((h) => <option key={h} value={h}>{h} hours</option>)}</select></F>
        </div>
      </ActionForm>
      <ActionForm action={makePlanNow} submitLabel="Make the plan now" buttonClass="btn ghost sm">
        <F label="For"><select name="day" defaultValue="today"><option value="today">Today</option><option value="tomorrow">Tomorrow</option></select></F>
      </ActionForm>
    </section>
  );
}

/* ───────────── One task ───────────── */

export async function TaskDetail({ actor, base, id }: { actor: FieldActor; base: string; id: string }) {
  const t = await taskById(id);
  if (!t || !mayWork(actor, t.ownerId)) return <div className="card warn small">This task isn&apos;t yours. <Link className="link" href={`${base}/tasks`}>Back to tasks</Link></div>;
  const owner = !actor.assistant;
  const open = ["todo", "work", "back"].includes(t.status);
  const canEdit = owner || t.source === "assistant";
  const boss = owner ? "you" : await ownerFirstName(t.ownerId);
  const from = t.source === "owner" ? (owner ? "From you" : `From ${boss}`) : SOURCE[t.source];
  return (
    <div className="col" style={{ gap: 18 }}>
      <Link className="link xs" href={`${base}/tasks`}>← Tasks</Link>
      <section className="card" style={{ gap: 10 }}>
        <div className="row between" style={{ flexWrap: "wrap" }}><span className="eyebrow">{dayLabel(t.dueDate)}{t.dueTime ? ` · ${t.dueTime}` : ""} · {KIND[t.kind]} · {from}</span>{statusTag(t.status, owner ? "you" : boss)}</div>
        <h2 className="disp h2">{t.title}</h2>
        {t.why && <p className="p small">{t.why}</p>}
        {t.steps.length > 0 && <ol className="small" style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>{t.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
        {t.backNote && <div className="card warn"><p className="p small"><b>{owner ? "Your note:" : `From ${boss}:`}</b> {t.backNote}</p></div>}
        {t.status === "needs" && t.needsMsg && <div className="card warn"><p className="p small"><b>{owner ? "She needs you to:" : `Sent to ${boss}:`}</b> {t.needsMsg}</p></div>}
        <span className="xs muted">{t.startedAt ? `Started ${at(t.startedAt)}` : "Not started"}{t.doneAt ? ` · Finished ${at(t.doneAt)}` : ""}{t.approvedAt ? ` · Approved ${at(t.approvedAt)}` : ""}</span>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          {["todo", "back"].includes(t.status) && <form action={startTask}><input type="hidden" name="id" value={t.id} /><button className="btn sm">Start working on it</button></form>}
          {owner && t.status === "done" && <form action={approveTask}><input type="hidden" name="id" value={t.id} /><button className="btn sm">Approve</button></form>}
          {owner && t.status === "needs" && (
            <form action={markHandled} className="row" style={{ gap: 6 }}><input type="hidden" name="id" value={t.id} /><input name="note" className="fin" style={{ height: 40 }} placeholder="Note back (optional)" maxLength={600} /><button className="btn sm">Mark handled</button></form>
          )}
          {canEdit && <form action={deleteTask}><input type="hidden" name="id" value={t.id} /><ConfirmSubmit label="Delete task" ask="Delete this task and its report?" /></form>}
        </div>
        {owner && ["done", "approved"].includes(t.status) && (
          <form action={sendBackTask} className="row" style={{ gap: 6 }}><input type="hidden" name="id" value={t.id} /><input name="note" className="fin" style={{ flex: 1, height: 40 }} placeholder="What to fix or add" maxLength={800} /><button className="btn ghost sm">Send back</button></form>
        )}
      </section>

      {(t.summary || t.calls.length > 0) && <ReportBlock t={t} />}

      {!owner && open && t.status !== "todo" && (
        <section className="card" style={{ gap: 12 }}>
          <span className="eyebrow">Need {boss}?</span>
          <ActionForm action={sendToOwner} submitLabel={`Send to ${boss}`} buttonClass="btn ghost sm"><input type="hidden" name="id" value={t.id} /><F label="What do they need to do?"><input name="msg" required maxLength={1000} placeholder="Grace Church wants to talk to an owner before the pop-up — can you call Pastor Lee?" /></F></ActionForm>
        </section>
      )}
      {open && t.status !== "todo" && (
        <section className="card" style={{ gap: 12 }}>
          <span className="eyebrow">Mark complete — your report</span>
          <span className="xs muted">List every call, email, text or visit. New places are added to Organizations in your area automatically.</span>
          <TaskReportForm id={t.id} outcomes={OUTCOMES} how={HOW} needsCalls={t.kind === "calls"} boss={owner ? "the owner" : boss} />
        </section>
      )}
      {canEdit && open && (
        <section className="card" style={{ gap: 12 }}>
          <span className="eyebrow">Edit task</span>
          <ActionForm action={editTask} submitLabel="Save changes" buttonClass="btn ghost sm">
            <input type="hidden" name="id" value={t.id} />
            <div className="grid2"><F label="Task"><input name="title" required maxLength={160} defaultValue={t.title} /></F><F label="Day"><input name="due" type="date" defaultValue={t.dueDate} /></F>
              <F label="Time"><input name="time" type="time" /></F><F label="Priority"><select name="priority" defaultValue={t.priority}><option value="normal">Normal</option><option value="high">High</option></select></F></div>
            <F label="Steps (one per line)"><textarea name="steps" defaultValue={t.steps.join("\n")} maxLength={3000} /></F>
          </ActionForm>
        </section>
      )}
    </div>
  );
}

function ReportBlock({ t }: { t: TaskRow }) {
  return (
    <section className="card" style={{ gap: 10 }}>
      <span className="eyebrow">Report{t.doneAt ? ` · ${at(t.doneAt)}` : ""}{t.cardsAsked ? ` · asked for ${t.cardsAsked} cards` : ""}</span>
      {t.summary && <p className="p small" style={{ whiteSpace: "pre-wrap" }}>{t.summary}</p>}
      {t.calls.length > 0 && (
        <div style={{ overflowX: "auto" }}><table className="tbl"><thead><tr><th>When</th><th>How</th><th>Organization</th><th>Address</th><th>Talked to</th><th>Phone / email</th><th>Outcome</th><th>Next step</th></tr></thead>
          <tbody>{t.calls.map((c) => (
            <tr key={c.id}><td className="small">{at(c.at)}</td><td className="small">{HOW[c.how] ?? c.how}</td><td className="small b">{c.orgName}</td>
              <td className="xs">{c.address} <a className="link xs" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent(c.address)}`}>Map</a></td>
              <td className="small">{c.person}{c.personTitle ? <div className="xs muted">{c.personTitle}</div> : null}</td><td className="xs">{c.contact ?? "—"}</td>
              <td><span className="tag">{c.outcome}</span>{c.notes ? <div className="xs" style={{ marginTop: 4 }}>{c.notes}</div> : null}</td><td className="xs">{c.nextStep ?? "—"}</td></tr>
          ))}</tbody></table></div>
      )}
    </section>
  );
}

/* ───────────── Reports (owner) ───────────── */

export async function ReportsView({ actor, base }: { actor: FieldActor; base: string }) {
  const rows = await reportsFor(actor.scope, 60);
  const helpers = await db.select({ a: teamAssistants, owner: users.firstName }).from(teamAssistants).innerJoin(users, eq(users.id, teamAssistants.ownerId))
    .where(and(eq(teamAssistants.status, "active"), actor.scope ? eq(teamAssistants.ownerId, actor.scope) : sql`true`));
  const mins = await minutesToday(helpers.map((h) => h.a.userId).filter((x): x is string => !!x));
  const week = (await db.execute(sql`select p.user_id, sum(p.minutes)::int as m from field_presence p where p.day >= ${addDays(centralToday(), -6)} group by p.user_id`)).rows as { user_id: string; m: number }[];
  const calls = rows.reduce((n, r) => n + r.calls.length, 0);
  return (
    <div className="col" style={{ gap: 18 }}>
      <section className="card" style={{ gap: 12 }}>
        <span className="eyebrow">Your assistants today</span>
        {helpers.length === 0 ? <span className="small muted">No active assistants. Add one under My assistants.</span> : helpers.map(({ a, owner }) => (
          <div key={a.id} className="col fsep" style={{ gap: 8, paddingBottom: 10 }}>
            <TimeBar minutes={(a.userId && mins.get(a.userId)) || 0} goal={4} name={`${a.name}${actor.scope === null ? ` (${owner})` : ""}`} />
            <div className="row between"><span className="xs muted">This week: {Math.round(((week.find((w) => w.user_id === a.userId)?.m) ?? 0) / 6) / 10} hours</span>
              <form action={viewAsAssistant}><input type="hidden" name="id" value={a.id} /><button className="link xs b">See {a.name.split(" ")[0]}&apos;s screen</button></form></div>
          </div>
        ))}
      </section>
      <div className="kpis">
        <div className="kpi"><span className="xs muted">Reports</span><b>{rows.length}</b></div>
        <div className="kpi"><span className="xs muted">Calls &amp; visits</span><b>{calls}</b></div>
        <div className="kpi"><span className="xs muted">Waiting your approval</span><b>{rows.filter((r) => r.status === "done").length}</b></div>
      </div>
      {rows.length === 0 ? <section className="card small muted">No finished reports yet.</section> : rows.map((t) => (
        <div key={t.id} className="col" style={{ gap: 6 }}>
          <div className="row between"><Link className="link b" href={`${base}/task/${t.id}`}>{t.title}</Link>{statusTag(t.status)}</div>
          <ReportBlock t={t} />
        </div>
      ))}
    </div>
  );
}

/* ───────────── Cards (assistant) ───────────── */

export async function CardsView({ actor, base }: { actor: FieldActor; base: string }) {
  const [supply, places, requests] = await Promise.all([cardSupply(actor.ownerId), fieldPlaces(actor.scope), cardRequests(actor.scope)]);
  const given = (await db.execute(sql`select d.id, d.quantity, d.status, d.distributed_at as at, p.name as place, p.id as "placeId" from voucher_distributions d join card_places p on p.id = d.place_id
    join nearest_card_batches b on b.id = d.batch_id where b.distributor_id = ${actor.ownerId} and d.status <> 'cancelled' order by d.distributed_at desc limit 40`)).rows as { id: string; quantity: number; status: string; at: string; place: string; placeId: string }[];
  const boss = await ownerFirstName(actor.ownerId);
  const STATUS: Record<string, string> = { planned: "Waiting for approval", assigned: "Approved — deliver", delivered: "Delivered", completed: "Completed" };
  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="kpis">{supply.length === 0 ? <div className="kpi"><span className="xs muted">Cards</span><b>None yet</b><span className="xs muted">{boss} hasn&apos;t published cards.</span></div> : supply.map((s) => (
        <div key={s.id} className="kpi"><span className="xs muted">{s.label}</span><b>{s.left}</b><span className="xs muted">left of {s.count}</span></div>
      ))}</div>
      <section className="card" style={{ gap: 12 }}>
        <span className="eyebrow">Ask for cards for an organization</span>
        <span className="xs muted">Usually 10 per organization. {actor.assistant ? `${boss} approves before you deliver.` : "Assigned right away."} Card numbers and codes are never shown here.</span>
        {places.length === 0 ? <span className="small muted">Add the organization first (Organizations), then ask for cards.</span> : (
          <ActionForm action={fieldRequestCards} submitLabel={actor.assistant ? "Send request" : "Assign cards"}>
            <div className="grid2">
              <F label="Organization"><select name="placeId" required>{places.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.city}</option>)}</select></F>
              {supply.length > 1 && <F label="Which cards"><select name="batchId">{supply.map((s) => <option key={s.id} value={s.id}>{s.label} ({s.left} left)</option>)}</select></F>}
              <F label="How many"><input name="quantity" type="number" min={1} max={1000} defaultValue={10} /></F>
              <F label="Drop-off day"><input name="date" type="date" /></F>
            </div>
            <F label="Note (optional)"><input name="notes" maxLength={300} placeholder="Front desk, ask for Ms. Johnson" /></F>
          </ActionForm>
        )}
      </section>
      {requests.length > 0 && <section className="card warn small">{requests.length} request{requests.length === 1 ? "" : "s"} waiting for approval.</section>}
      <section className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Cards by organization</span>
        <table className="tbl"><thead><tr><th>Organization</th><th className="num">Cards</th><th>Day</th><th>Status</th></tr></thead>
          <tbody>{given.length === 0 ? <tr><td className="empty" colSpan={4}>None yet.</td></tr> : given.map((g) => (
            <tr key={g.id}><td><Link className="link" href={`${base}/org/${g.placeId}`}>{g.place}</Link></td><td className="num b">{g.quantity}</td><td className="small">{new Date(g.at).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" })}</td>
              <td><span className={`tag ${g.status === "planned" ? "warn" : "ok"}`}>{STATUS[g.status] ?? g.status}</span></td></tr>
          ))}</tbody></table>
      </section>
    </div>
  );
}

/* ───────────── Video educators ───────────── */

const EDU_STATUS: Record<string, [string, string]> = {
  found: ["", "Found"], talking: ["", "Talking"], price: ["warn", "Price — needs owner"], agreed: ["ok", "Price approved"], received: ["ok", "Video received"], no: ["bad", "Passed"],
};

export async function EducatorsView({ actor, base, editId, sendId }: { actor: FieldActor; base: string; editId?: string; sendId?: string }) {
  const owner = !actor.assistant;
  const rows = await db.select().from(educators).where(actor.scope ? eq(educators.ownerId, actor.scope) : sql`true`).orderBy(sql`${educators.status} = 'price' desc`, desc(educators.updatedAt), desc(educators.createdAt)).limit(200);
  const contracts = rows.length ? await db.select().from(educatorContracts).where(inArray(educatorContracts.educatorId, rows.map((r) => r.id))).orderBy(desc(educatorContracts.createdAt)) : [];
  const edit = rows.find((r) => r.id === editId) ?? null;
  const send = rows.find((r) => r.id === sendId && r.status === "agreed") ?? null;
  const boss = await ownerFirstName(actor.ownerId);
  const me = actor.assistant ? await db.query.teamAssistants.findFirst({ where: eq(teamAssistants.id, actor.assistant.id) }) : null;
  const signer = actor.assistant ? (me?.canSign && me.legalName && me.title ? `${me.legalName}, ${me.title}` : null) : "Nearest — Authorized representative";
  return (
    <div className="col" style={{ gap: 18 }}>
      {send && (
        <section className="card" style={{ gap: 12 }} id="send">
          <span className="eyebrow">Send the agreement — {send.name}</span>
          <span className="xs muted">{EDUCATOR_AGREEMENT_TITLE}. Nearest&apos;s part is filled in. Fill the creator&apos;s part; they can correct it when they sign. NDA and full resale rights are included.</span>
          {!signer ? <div className="card warn small">{boss} hasn&apos;t allowed you to sign agreements yet. Ask {boss} to turn it on in My assistants.</div> : (
            <ActionForm action={sendAgreement} submitLabel="Sign for Nearest and send">
              <input type="hidden" name="id" value={send.id} />
              <div className="card small" style={{ gap: 4 }}><b>Nearest</b><span>{NEAREST_PARTY.name}, {NEAREST_PARTY.address}</span></div>
              <div className="grid2">
                <F label="Send to (their email)"><input name="email" type="email" required defaultValue={send.email ?? ""} /></F>
                {AGREEMENT_FIELDS.map((f) => {
                  const d = f.key === "legal" ? send.name : f.key === "handle" ? (send.handle ?? "") : f.key === "contact" ? [send.phone, send.email].filter(Boolean).join(" · ") : f.key === "subject" ? send.skill : f.key === "fee" ? (send.price ?? "") : "";
                  return <F key={f.key} label={`${f.label}${f.required ? "" : " (optional)"}`}><input name={f.key} required={f.required} maxLength={300} defaultValue={d} placeholder={"hint" in f ? f.hint : ""} /></F>;
                })}
              </div>
              <details className="small"><summary className="link xs">Read the full agreement</summary>
                {AGREEMENT_SECTIONS.map((s) => <div key={s.title} style={{ marginTop: 10 }}><b>{s.title}</b>{s.body.map((p, i) => <p key={i} className="p xs" style={{ marginTop: 4 }}>{p}</p>)}</div>)}
              </details>
              <label className="row small" style={{ gap: 8, alignItems: "flex-start" }}><input type="checkbox" name="agree" required /> I&apos;m signing for Nearest as <b>{signer}</b>, authorized signer.</label>
            </ActionForm>
          )}
          <Link className="link xs" href={`${base}/educators`}>Cancel</Link>
        </section>
      )}
      <section className="card" style={{ gap: 12 }} id="form">
        <span className="eyebrow">{edit ? `Edit — ${edit.name}` : "Log a video educator"}</span>
        <span className="xs muted">Creators who teach a skill well on Instagram, TikTok, Facebook or YouTube. Ask what they&apos;d charge for one step-by-step training video. When you have a price, set the status to Price — {owner ? "you approve" : `${boss} approves`}, counters or passes.</span>
        <ActionForm action={saveEducator} submitLabel="Save">
          {edit && <input type="hidden" name="id" value={edit.id} />}
          <div className="grid2">
            <F label="Name or business"><input name="name" required maxLength={120} defaultValue={edit?.name} /></F>
            <F label="Platform"><select name="platform" defaultValue={edit?.platform ?? "Instagram"}>{["Instagram", "TikTok", "Facebook", "YouTube", "Other"].map((p) => <option key={p}>{p}</option>)}</select></F>
            <F label="Handle or link"><input name="handle" maxLength={120} defaultValue={edit?.handle ?? ""} placeholder="@lashesbykay" /></F>
            <F label="What they teach"><input name="skill" required maxLength={160} defaultValue={edit?.skill} placeholder="Classic lash full set" /></F>
            <F label="Phone"><input name="phone" maxLength={40} defaultValue={edit?.phone ?? ""} /></F>
            <F label="Email"><input name="email" type="email" maxLength={160} defaultValue={edit?.email ?? ""} /></F>
            <F label="Spoke on"><input name="spokeAt" maxLength={60} defaultValue={edit?.spokeAt ?? ""} placeholder="Nov 23, DM on Instagram" /></F>
            <F label="Their price"><input name="price" maxLength={120} defaultValue={edit?.price ?? ""} placeholder="$300 for a 20-minute video" /></F>
            <F label="Products they'd list"><select name="products" defaultValue={edit?.products ?? ""}><option value="">Not asked yet</option><option value="yes">Yes — will send a list</option><option value="no">No</option></select></F>
            <F label="Status"><select name="status" defaultValue={edit && ["found", "talking", "price", "no"].includes(edit.status) ? edit.status : "found"}><option value="found">Found</option><option value="talking">Talking</option><option value="price">Price — send to owner</option><option value="no">Not interested</option></select></F>
          </div>
          <F label="What you asked / what they said"><textarea name="asked" maxLength={600} defaultValue={edit?.asked ?? ""} /></F>
          <F label="Notes"><textarea name="notes" maxLength={1000} defaultValue={edit?.notes ?? ""} /></F>
        </ActionForm>
        {edit && <Link className="link xs" href={`${base}/educators`}>Cancel editing</Link>}
      </section>
      <section className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Video educators</span>
        {rows.length === 0 ? <span className="small muted">None yet.</span> : rows.map((e) => {
          const c = contracts.find((x) => x.educatorId === e.id && x.status !== "cancelled");
          const [k, l] = EDU_STATUS[e.status] ?? ["", e.status];
          return (
            <div key={e.id} className="col fsep" style={{ gap: 6, paddingBottom: 12 }}>
              <div className="row between" style={{ flexWrap: "wrap" }}><span className="b">{e.name} <span className="xs muted">· {e.platform}{e.handle ? ` ${e.handle}` : ""}</span></span><span className={`tag ${k}`}>{l}</span></div>
              <span className="small">{e.skill}{e.price ? ` · ${e.price}` : ""}{e.products === "yes" ? " · will list products" : ""}</span>
              {(e.phone || e.email) && <span className="xs muted">{[e.phone, e.email].filter(Boolean).join(" · ")}</span>}
              {e.asked && <span className="xs">{e.asked}</span>}
              {e.ownerNote && <span className="xs"><b>Owner:</b> {e.ownerNote}</span>}
              {c && <span className="xs"><b>Agreement:</b> {c.status === "sent" ? `sent ${at(c.createdAt)} — waiting for their signature` : c.status === "signed" ? `signed by ${c.creatorName} ${at(c.creatorSignedAt!)} — waiting for the video` : `video uploaded ${at(c.uploadedAt!)}`} · signed for Nearest by {c.nearestSigner}</span>}
              {c?.videoUrl && owner && <a className="link xs" href={`/api/educator-video/${c.id}`} target="_blank" rel="noreferrer">Open the video{c.videoName ? ` (${c.videoName})` : ""}</a>}
              {c?.productList && <span className="xs" style={{ whiteSpace: "pre-wrap" }}><b>Products:</b> {c.productList}</span>}
              <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                {!(actor.assistant && ["agreed", "received"].includes(e.status)) && <Link className="link xs" href={`${base}/educators?edit=${e.id}#form`}>Edit</Link>}
                {e.status === "agreed" && (!c || c.status === "sent") && <Link className="link xs b" href={`${base}/educators?send=${e.id}#send`}>{c ? "Send the agreement again" : "Send contract"}</Link>}
              </div>
              {owner && ["price", "talking", "found"].includes(e.status) && (
                <form action={decideEducator} className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  <input type="hidden" name="id" value={e.id} />
                  <input name="note" className="fin" style={{ height: 36, flex: 1, minWidth: 180 }} placeholder="Note or counter ($250, 15 min)" maxLength={600} />
                  <button className="btn sm" name="decision" value="approve">Approve price</button>
                  <button className="btn ghost sm" name="decision" value="counter">Counter</button>
                  <button className="link xs" name="decision" value="pass">Pass</button>
                </form>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

/* ───────────── Training ───────────── */

export async function TrainingView({ base, lessonId, userId, canTick, ownerId }: { base: string; lessonId?: string; userId: string | null; canTick: boolean; ownerId: string }) {
  const boss = await ownerFirstName(ownerId);
  const say = (x: string) => withOwnerName(x, boss);
  const done = userId ? await db.select().from(fieldTraining).where(eq(fieldTraining.userId, userId)) : [];
  const has = (l: string, i: number) => done.some((d) => d.lesson === l && d.step === i);
  const lesson = lessonId ? lessonById(lessonId) : null;
  if (lesson) {
    return (
      <div className="col" style={{ gap: 18 }}>
        <Link className="link xs" href={`${base}/training`}>← All lessons</Link>
        <section className="card lesson" style={{ gap: 12 }}>
          <h2 className="disp h2">{lesson.title}</h2>
          <p className="p small muted">{say(lesson.why)}</p>
          <ol>{lesson.steps.map((s, i) => (
            <li key={i} className="small">
              <form action={tickTraining} className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                <input type="hidden" name="lesson" value={lesson.id} /><input type="hidden" name="step" value={i} />
                <button className={`tag ${has(lesson.id, i) ? "ok" : ""}`} style={{ cursor: "pointer", background: "none" }} aria-label={has(lesson.id, i) ? "Done — tap to undo" : "Mark done"} disabled={!canTick}>{has(lesson.id, i) ? "Done" : "Mark done"}</button>
                <span>{say(s)}</span>
              </form>
            </li>
          ))}</ol>
          {lesson.source && <div className="xs muted">Official help: {lesson.source.map((s, i) => <span key={s.url}>{i ? " · " : ""}<a className="link xs" href={s.url} target="_blank" rel="noreferrer">{s.label}</a></span>)}</div>}
        </section>
      </div>
    );
  }
  return (
    <section className="card" style={{ gap: 10 }}>
      <span className="eyebrow">Lessons</span>
      <span className="xs muted">Step by step. Tap Mark done as you go — {boss} sees your progress. Platform menus change; each lesson links the official help page too.</span>
      <table className="tbl"><tbody>{LESSONS.map((l) => {
        const n = done.filter((d) => d.lesson === l.id).length;
        return <tr key={l.id}><td><Link className="link b" href={`${base}/training/${l.id}`}>{l.title}</Link><div className="xs muted">{say(l.why)}</div></td><td className="num small">{n}/{l.steps.length}</td><td>{n === l.steps.length ? <span className="tag ok">Done</span> : n ? <span className="tag warn">Started</span> : null}</td></tr>;
      })}</tbody></table>
    </section>
  );
}
