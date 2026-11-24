import { desc, eq, inArray } from "drizzle-orm";
import { db, teamMeetings, teamNotes, users, cardPlaces } from "@/db";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import type { FieldActor } from "@/lib/team";
import { teamMembers, HOW, calendarLink } from "@/lib/team-room";
import {
  scheduleMeeting, updateMeeting, cancelMeeting, saveMeetingNotes, postNote, editNote, deleteNote, pinNote,
  shareOrg, releaseOrg, claimOrg, takeOverOrg,
} from "@/app/team-room-actions";

/**
 * Field team room screens (2026-11-23): Meetings, the Note Room and the "who's working this organization" card.
 * Shared by the owner (/admin/field) and assistants (/outreach). Scoped to actor.ownerId's team.
 */
const F = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="field"><label>{label}</label>{children}</div>;
const at = (d: Date | string) => new Date(d).toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Chicago" });
const meOf = (a: FieldActor) => a.assistant?.userId ?? a.user.id;

/* ───────────── Who's working this organization ───────────── */

export async function OrgAssignment({ actor, place, ownerId }: { actor: FieldActor; place: typeof cardPlaces.$inferSelect; ownerId: string }) {
  const me = meOf(actor);
  const owner = !actor.assistant;
  const worker = place.openToClaim ? null : place.assignedTo ?? place.createdBy;
  const members = await teamMembers(ownerId);
  const workerName = worker ? members.find((m) => m.userId === worker)?.name ?? (await db.query.users.findFirst({ where: eq(users.id, worker), columns: { firstName: true } }))?.firstName ?? "Someone" : null;
  const mine = worker === me;
  const others = members.filter((m) => m.userId !== worker);
  return (
    <section className={`card ${place.openToClaim ? "warn" : mine ? "ok" : ""}`} style={{ gap: 10 }}>
      <span className="eyebrow">Who&apos;s working this</span>
      <p className="p small">
        {place.openToClaim ? "Nobody yet — it's open. The first person to claim it works it." : mine ? "You are. Only you can log calls, book visits and ask for cards here until you release it." : `${workerName} is. You can see everything, but only ${workerName} works it unless it's released to you.`}
        {!place.shared && " Only you and the owner can see it — it isn't shared with the team yet."}
      </p>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        {place.openToClaim && <form action={claimOrg}><input type="hidden" name="id" value={place.id} /><button className="btn sm" style={{ width: "auto" }}>Claim it</button></form>}
        {!place.shared && (mine || owner || place.createdBy === me) && <form action={shareOrg}><input type="hidden" name="id" value={place.id} /><button className="btn ghost sm" style={{ width: "auto" }}>Share with the team</button></form>}
        {owner && !mine && !place.openToClaim && <form action={takeOverOrg}><input type="hidden" name="id" value={place.id} /><ConfirmSubmit label="Take it over" ask={`Take ${place.name} over? ${workerName ?? "They"} will be told.`} /></form>}
      </div>
      {(mine || (owner && !place.openToClaim)) && (
        <details><summary className="link small">Release it to someone else</summary>
          <div style={{ marginTop: 10 }}>
            <ActionForm action={releaseOrg} submitLabel="Release" buttonClass="btn ghost sm">
              <input type="hidden" name="id" value={place.id} />
              <F label="Give it to"><select name="to" defaultValue={others[0]?.userId ?? "anyone"}>
                {others.map((m) => <option key={m.userId} value={m.userId}>{m.name}{m.owner ? " (owner)" : ""}</option>)}
                <option value="anyone">Anyone on the team — first to claim it</option>
              </select></F>
            </ActionForm>
          </div>
        </details>
      )}
    </section>
  );
}

/* ───────────── Meetings ───────────── */

export async function MeetingsView({ actor }: { actor: FieldActor }) {
  const me = meOf(actor);
  const owner = !actor.assistant;
  const members = await teamMembers(actor.ownerId);
  const name = (id: string) => members.find((m) => m.userId === id)?.name ?? "Someone";
  const rows = await db.select().from(teamMeetings).where(eq(teamMeetings.ownerId, actor.ownerId)).orderBy(desc(teamMeetings.startsAt)).limit(120);
  const soon = rows.filter((m) => m.status === "planned" && m.startsAt.getTime() + m.minutes * 60000 > Date.now()).reverse();
  const past = rows.filter((m) => !soon.includes(m));
  return (
    <div className="col" style={{ gap: 18 }}>
      <section className="card" style={{ gap: 12 }}>
        <span className="eyebrow">Set up a meeting</span>
        <span className="xs muted">For anything the team should know or improve. Everyone you pick gets a notice and an email. Video meetings use Google Meet or Facebook only — tap Create a Google Meet, then paste its link here (you can add it later too).</span>
        <ActionForm action={scheduleMeeting} submitLabel="Set up meeting">
          <F label="Title"><input name="title" required maxLength={120} placeholder="Weekly check-in — what's working in Plano" /></F>
          <div className="grid2">
            <F label="Date"><input name="date" type="date" required defaultValue={today()} /></F>
            <F label="Time (Central)"><input name="time" type="time" required /></F>
            <F label="How long"><select name="minutes" defaultValue="30">{[15, 30, 45, 60, 90].map((n) => <option key={n} value={n}>{n} minutes</option>)}</select></F>
            <F label="How"><select name="how" defaultValue="video">{Object.entries(HOW).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F>
          </div>
          <F label="Video link (Google Meet or Facebook — video meetings)"><input name="link" maxLength={500} placeholder="https://meet.google.com/abc-defg-hij" /></F>
          <span className="xs"><a className="link" href="https://meet.google.com/new" target="_blank" rel="noreferrer">Create a Google Meet</a> · <a className="link" href="https://www.messenger.com/rooms" target="_blank" rel="noreferrer">Create a Messenger room</a></span>
          <F label="Where or what number (in person / phone)"><input name="place" maxLength={200} placeholder="Starbucks, 3201 Preston Rd, Frisco" /></F>
          <F label="What's it about"><textarea name="agenda" maxLength={3000} placeholder={"1. What we heard from the churches this week\n2. Pop-up on Saturday — who brings what\n3. Ideas to get more sign-ups"} /></F>
          <div className="field"><label>Who&apos;s in it</label>
            <div className="col" style={{ gap: 6 }}>{members.filter((m) => m.userId !== me).map((m) => (
              <label key={m.userId} className="check"><input type="checkbox" name="with" value={m.userId} defaultChecked /> {m.name}{m.owner ? " (owner)" : ""}</label>
            ))}</div>
          </div>
        </ActionForm>
      </section>

      <section className="card" style={{ gap: 12 }}>
        <span className="eyebrow">Coming up</span>
        {soon.length === 0 ? <span className="small muted">No meetings coming up.</span> : soon.map((m) => {
          const live = m.startsAt.getTime() - Date.now() < 15 * 60000;
          const mine = m.createdBy === me || owner;
          return (
            <div key={m.id} className="col fsep" style={{ gap: 8, paddingBottom: 12 }}>
              <div className="row between" style={{ flexWrap: "wrap" }}><span className="b">{m.title}</span><span className="tag">{at(m.startsAt)} · {m.minutes} min</span></div>
              <span className="xs muted">{HOW[m.how]}{m.place ? ` · ${m.place}` : ""} · set up by {name(m.createdBy)} · with {m.attendees.filter((x) => x !== m.createdBy).map(name).join(", ")}</span>
              {m.agenda && <p className="p small" style={{ whiteSpace: "pre-wrap" }}>{m.agenda}</p>}
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                {m.how === "video" && (m.link ? <a className={`btn sm ${live ? "" : "ghost"}`} style={{ width: "auto" }} href={m.link} target="_blank" rel="noreferrer">Join video</a> : <span className="tag warn">Video link not added yet</span>)}
                <a className="link xs" href={calendarLink(m)} target="_blank" rel="noreferrer">Add to my calendar</a>
                {mine && <form action={cancelMeeting}><input type="hidden" name="id" value={m.id} /><ConfirmSubmit label="Cancel" ask={`Cancel “${m.title}”? Everyone in it will be told.`} /></form>}
              </div>
              {mine && (
                <details><summary className="link xs">Change link, place or time</summary>
                  <div style={{ marginTop: 8 }}>
                    <ActionForm action={updateMeeting} submitLabel="Save" buttonClass="btn ghost sm">
                      <input type="hidden" name="id" value={m.id} />
                      {m.how === "video" ? <F label="Video link"><input name="link" maxLength={500} defaultValue={m.link ?? ""} /></F> : <F label="Where / number"><input name="place" maxLength={200} defaultValue={m.place ?? ""} /></F>}
                      <div className="grid2"><F label="New date (optional)"><input name="date" type="date" /></F><F label="New time"><input name="time" type="time" /></F></div>
                    </ActionForm>
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </section>

      <section className="card" style={{ gap: 12 }}>
        <span className="eyebrow">Past meetings &amp; notes</span>
        {past.length === 0 ? <span className="small muted">None yet.</span> : past.map((m) => (
          <div key={m.id} className="col fsep" style={{ gap: 6, paddingBottom: 12 }}>
            <div className="row between" style={{ flexWrap: "wrap" }}><span className="b">{m.title}</span><span className={`tag ${m.status === "cancelled" ? "bad" : m.notes ? "ok" : ""}`}>{m.status === "cancelled" ? "Canceled" : m.notes ? "Notes in" : "Needs notes"} · {at(m.startsAt)}</span></div>
            {m.notes && <p className="p small" style={{ whiteSpace: "pre-wrap" }}>{m.notes}</p>}
            {m.status !== "cancelled" && (m.attendees.includes(me) || owner) && (
              <details><summary className="link xs">{m.notes ? "Edit the notes" : "Add the notes"}</summary>
                <div style={{ marginTop: 8 }}>
                  <ActionForm action={saveMeetingNotes} submitLabel="Save notes" buttonClass="btn ghost sm">
                    <input type="hidden" name="id" value={m.id} />
                    <F label="What we decided / next steps"><textarea name="notes" maxLength={6000} defaultValue={m.notes ?? ""} /></F>
                  </ActionForm>
                </div>
              </details>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

/* ───────────── Note Room ───────────── */

export async function NotesView({ actor }: { actor: FieldActor }) {
  const me = meOf(actor);
  const owner = !actor.assistant;
  const members = await teamMembers(actor.ownerId);
  const rows = await db.select().from(teamNotes).where(eq(teamNotes.ownerId, actor.ownerId)).orderBy(desc(teamNotes.pinned), desc(teamNotes.createdAt)).limit(200);
  const ids = [...new Set(rows.map((r) => r.authorId))];
  const names = ids.length ? await db.select({ id: users.id, n: users.firstName }).from(users).where(inArray(users.id, ids)) : [];
  const nameOf = (id: string) => members.find((m) => m.userId === id)?.name ?? names.find((x) => x.id === id)?.n ?? "Someone";
  return (
    <div className="col" style={{ gap: 18 }}>
      <section className="card" style={{ gap: 12 }}>
        <span className="eyebrow">Share a note with the team</span>
        <span className="xs muted">Only {members.map((m) => m.name).join(", ")} can see the Note Room. Ideas, what you heard, what to fix — anything the team should know.</span>
        <ActionForm action={postNote} submitLabel="Post note">
          <F label="Note"><textarea name="body" required maxLength={4000} rows={4} placeholder="The YMCA in Allen wants us at their teen night on the 5th — can someone bring cards?" /></F>
        </ActionForm>
      </section>
      <section className="card" style={{ gap: 12 }}>
        <span className="eyebrow">Note Room</span>
        {rows.length === 0 ? <span className="small muted">No notes yet — post the first one.</span> : rows.map((n) => (
          <div key={n.id} className="col fsep" style={{ gap: 6, paddingBottom: 12 }}>
            <div className="row between" style={{ flexWrap: "wrap" }}>
              <span className="small b">{nameOf(n.authorId)}{n.authorId === me ? " (you)" : ""}</span>
              <span className="xs muted">{n.pinned && <span className="tag warn" style={{ marginRight: 6 }}>Pinned</span>}{at(n.createdAt)}{n.editedAt ? " · edited" : ""}</span>
            </div>
            <p className="p small" style={{ whiteSpace: "pre-wrap" }}>{n.body}</p>
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <form action={pinNote}><input type="hidden" name="id" value={n.id} /><button className="link xs">{n.pinned ? "Unpin" : "Pin to top"}</button></form>
              {(n.authorId === me || owner) && <form action={deleteNote}><input type="hidden" name="id" value={n.id} /><ConfirmSubmit label="Delete" ask="Delete this note for everyone?" /></form>}
            </div>
            {n.authorId === me && (
              <details><summary className="link xs">Edit</summary>
                <div style={{ marginTop: 8 }}>
                  <ActionForm action={editNote} submitLabel="Save" buttonClass="btn ghost sm">
                    <input type="hidden" name="id" value={n.id} />
                    <F label="Note"><textarea name="body" maxLength={4000} defaultValue={n.body} /></F>
                  </ActionForm>
                </div>
              </details>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

