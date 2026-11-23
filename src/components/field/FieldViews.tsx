import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, categories } from "@/db";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { CopyButton } from "@/components/CopyButton";
import { AdLinks } from "@/components/AdLinks";
import { ORG_KINDS } from "@/lib/distribution";
import {
  fieldPlaces, placeTimeline, upcoming, cardRequests, cardSupply, recruitNext, popups, adDraftsFor, placeOwnerId,
  TOUCH_KINDS, STEP_KINDS, POPUP_STATUS, AD_STATUS, DEFAULT_CARDS_PER_ORG,
} from "@/lib/field";
import { mayWork, type FieldActor } from "@/lib/team";
import { TRACKING_FIELDS, trackingSaved } from "@/lib/tracking";
import { liveReports } from "@/lib/live/reports";
import { SITE_URL } from "@/lib/public/site";
import { money } from "@/lib/time";
import {
  fieldAddOrg, fieldAddContact, fieldLogTouch, fieldAddStep, fieldStepStatus, fieldRequestCards, decideCardRequest, savePopup, popupStatus,
  teamAddProspect, teamSendLink, teamProspectNote, saveAdDraft, reviewAdDraft, fieldAddSpend, saveTrackingIds,
} from "@/app/field-actions";

/**
 * Field work screens (2026-11-22), shared by Admin → Field team (owners; base "/admin/field") and the assistant's
 * workspace (/outreach). Every list is limited to the actor's scope (their owner's area; the main owner sees all) and
 * every action re-checks on the server.
 */
const at = (iso: string | Date) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const day = (iso: string | Date) => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" });
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Chicago" });
const F = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="field"><label>{label}</label>{children}</div>;
const KIND_TAG: Record<string, string> = { meeting: "Meeting", virtual: "Virtual", dropoff: "Drop-off", popup: "Pop-up" };

export function FieldTabs({ base, at: on, owner }: { base: string; at: string; owner: boolean }) {
  const tabs = owner
    ? [["", "Home"], ["/tasks", "Tasks"], ["/reports", "Reports"], ["/orgs", "Organizations"], ["/popups", "Pop-ups"], ["/pros", "Professionals"], ["/educators", "Video educators"], ["/ads", "Ads"], ["/map", "Vote map"], ["/team", "My assistants"]]
    : [["", "Today"], ["/tasks", "Tasks"], ["/orgs", "Organizations"], ["/cards", "Cards"], ["/popups", "Pop-ups"], ["/pros", "Professionals"], ["/educators", "Video educators"], ["/ads", "Ads"], ["/map", "Vote map"], ["/training", "Training"], ["/guide", "How it works"]];
  return (
    <details className="fmenu" key={`${base}${on}`}>
      <summary aria-label="Field team menu">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        <span>{tabs.find(([p]) => p === on)?.[1] ?? "Menu"}</span>
      </summary>
      <nav aria-label="Field team">
        {tabs.map(([p, l]) => <Link key={p} href={`${base}${p}`} className="ftab" aria-current={on === p ? "page" : undefined}>{l}</Link>)}
      </nav>
    </details>
  );
}

/* ───────────── Home ───────────── */

export async function FieldHome({ actor, base }: { actor: FieldActor; base: string }) {
  const [list, requests, next] = await Promise.all([upcoming(actor.scope), cardRequests(actor.scope), recruitNext(actor.scope, 12)]);
  const owner = !actor.assistant;
  return (
    <div className="col" style={{ gap: 18 }}>
      <section className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Upcoming — meetings, drop-offs and pop-ups</span>
        {list.length === 0 ? <span className="small muted">Nothing booked yet. Open an organization to book a meeting or drop-off, or add a pop-up.</span> : (
          <table className="tbl"><thead><tr><th>When</th><th>What</th><th>Where</th><th>With</th>{actor.scope === null && <th>For</th>}</tr></thead>
            <tbody>{list.map((u) => (
              <tr key={u.kind + u.id}><td className="b">{at(u.at)}</td>
                <td><span className="tag">{KIND_TAG[u.kind] ?? u.kind}</span> {u.placeId ? <Link className="link" href={`${base}/org/${u.placeId}`}>{u.title}</Link> : <Link className="link" href={`${base}/popups#p-${u.id}`}>{u.title}</Link>}</td>
                <td className="small">{u.where}{u.where && <> · <a className="link xs" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent(u.where)}`}>Map</a></>}{u.link && <> · <a className="link xs" href={u.link} target="_blank" rel="noreferrer">Meeting link</a></>}</td>
                <td className="small">{u.who ?? "—"}</td>{actor.scope === null && <td className="small">{u.owner}</td>}</tr>
            ))}</tbody></table>
        )}
      </section>

      <section className="card" style={{ gap: 10 }} id="requests">
        <span className="eyebrow">Card requests {owner ? "waiting for you" : "waiting for approval"}</span>
        {requests.length === 0 ? <span className="small muted">{owner ? "No requests right now." : "Nothing waiting. Ask for cards from an organization's page."}</span> : (
          <table className="tbl"><thead><tr><th>Organization</th><th className="num">Cards</th><th>Date</th><th>Asked by</th><th>Note</th>{owner && <th />}</tr></thead>
            <tbody>{requests.map((r) => (
              <tr key={r.id}><td><Link className="link" href={`${base}/org/${r.placeId}`}>{r.place}</Link><div className="xs muted">{r.city}{actor.scope === null && r.owner ? ` · ${r.owner}'s cards` : ""}</div></td>
                <td className="num b">{r.quantity}</td><td className="small">{day(r.at)}</td><td className="small">{r.by}</td><td className="xs">{r.notes ?? ""}</td>
                {owner && <td className="row" style={{ gap: 6 }}>
                  <form action={decideCardRequest}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="approve" /><button className="btn sm" style={{ width: "auto" }}>Approve</button></form>
                  <form action={decideCardRequest}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="decline" /><ConfirmSubmit label="Decline" ask="Decline this request? The cards go back to your supply." /></form>
                </td>}</tr>
            ))}</tbody></table>
        )}
      </section>

      <RecruitNext rows={next} more={`${base}/map`} />
    </div>
  );
}

function RecruitNext({ rows, more }: { rows: Awaited<ReturnType<typeof recruitNext>>; more?: string }) {
  return (
    <section className="card" style={{ gap: 10 }}>
      <div className="row between"><span className="eyebrow">Recruit next — where students are voting</span>{more && <Link className="link xs" href={more}>See all</Link>}</div>
      {rows.length === 0 ? <span className="small muted">No votes in this area yet.</span> : (
        <table className="tbl"><thead><tr><th>City</th><th>Service</th><th className="num">Votes</th><th className="num">This week</th><th>Live professional</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={`${r.cityId}-${r.category}`}><td className="b">{r.city}</td><td>{r.category}</td><td className="num">{r.votes}</td><td className="num">{r.week}</td>
              <td>{r.covered ? <span className="tag ok">Yes</span> : <span className="tag warn">None yet — recruit</span>}</td></tr>
          ))}</tbody></table>
      )}
      <span className="xs muted">Services students voted for in each city. "None yet" means no live professional offers it there — the best places to bring someone in.</span>
    </section>
  );
}

/* ───────────── Organizations ───────────── */

export async function OrgsView({ actor, base, q }: { actor: FieldActor; base: string; q: string }) {
  const rows = await fieldPlaces(actor.scope, q);
  return (
    <div className="col" style={{ gap: 18 }}>
      <section className="card" style={{ gap: 12 }}>
        <span className="eyebrow">Add an organization</span>
        <span className="xs muted">Boys & Girls Clubs, schools, churches, YMCAs, community centers — anywhere cards can go. One row per location.</span>
        <ActionForm action={fieldAddOrg} submitLabel="Add organization">
          <div className="grid2">
            <F label="Name"><input name="name" required maxLength={120} placeholder="Boys & Girls Club — Frisco" /></F>
            <F label="Type"><select name="kind" defaultValue="boys_girls_club">{Object.entries(ORG_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F>
            <F label="Street address"><input name="street" required maxLength={160} placeholder="1224 E 7th St" /></F>
            <F label="City"><input name="city" required maxLength={80} placeholder="Frisco" /></F>
            <F label="State"><input name="state" defaultValue="TX" maxLength={2} /></F>
            <F label="ZIP"><input name="zip" required inputMode="numeric" maxLength={10} placeholder="75035" /></F>
            <F label="Person you talked to (optional)"><input name="contactName" maxLength={100} /></F>
            <F label="Their title (optional)"><input name="contactTitle" maxLength={80} placeholder="Program director" /></F>
            <F label="Their phone or email (optional)"><input name="contact" maxLength={120} /></F>
          </div>
        </ActionForm>
      </section>
      <section className="card" style={{ gap: 10 }}>
        <form className="row" style={{ gap: 8 }}><input name="q" defaultValue={q} placeholder="Search name, street, city or ZIP" className="fin" style={{ flex: 1, height: 40 }} /><button className="btn ghost sm" style={{ width: "auto" }}>Search</button></form>
        <table className="tbl"><thead><tr><th>Organization</th><th>Address</th><th className="num">Touches</th><th>Last</th><th>Next</th><th className="num">Cards</th>{actor.scope === null && <th>Area</th>}</tr></thead>
          <tbody>{rows.length === 0 ? <tr><td className="empty" colSpan={7}>No organizations yet.</td></tr> : rows.map((r) => (
            <tr key={r.id}><td><Link className="link b" href={`${base}/org/${r.id}`}>{r.name}</Link><div className="xs muted">{ORG_KINDS[r.kind] ?? r.kind}</div></td>
              <td className="small">{[r.street, r.city].filter(Boolean).join(", ")} {r.zip}</td><td className="num">{r.touches}</td>
              <td className="small">{r.lastTouch ? day(r.lastTouch) : "—"}</td><td className="small">{r.nextStep ? at(r.nextStep) : "—"}</td>
              <td className="num">{r.cardsAssigned}{r.cardsAsked ? <div className="xs muted">+{r.cardsAsked} asked</div> : null}</td>{actor.scope === null && <td className="small">{r.owner ?? "—"}</td>}</tr>
          ))}</tbody></table>
      </section>
    </div>
  );
}

export async function OrgDetail({ actor, base, placeId }: { actor: FieldActor; base: string; placeId: string }) {
  const place = /^[0-9a-f-]{36}$/.test(placeId) ? await db.query.cardPlaces.findFirst({ where: (p, { eq: e }) => e(p.id, placeId) }) : null;
  const ownerId = place ? await placeOwnerId(place.id) : null;
  if (!place || !mayWork(actor, ownerId)) return <div className="card warn small">This organization isn&apos;t in your area. <Link className="link" href={`${base}/orgs`}>Back to organizations</Link></div>;
  const [t, supply] = await Promise.all([placeTimeline(place.id), cardSupply(ownerId!)]);
  const addr = place.address ?? [place.street, place.zip].filter(Boolean).join(" ");
  const contactOpts = t.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.title ? ` — ${c.title}` : ""}</option>);
  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="col" style={{ gap: 4 }}>
        <Link className="link xs" href={`${base}/orgs`}>← Organizations</Link>
        <h2 className="disp h2" style={{ margin: 0 }}>{place.name}</h2>
        <span className="small muted">{ORG_KINDS[place.kind] ?? place.kind} · {addr} · <a className="link" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent(addr)}`}>Map</a></span>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <section className="card" style={{ gap: 10 }}>
          <span className="eyebrow">People</span>
          {t.contacts.length === 0 ? <span className="small muted">No one added yet.</span> : t.contacts.map((c) => (
            <div key={c.id} className="col fsep" style={{ gap: 2, paddingBottom: 8 }}>
              <span className="b">{c.name}{c.title ? <span className="muted small"> · {c.title}</span> : null}</span>
              <span className="small">{c.phone && <a className="link" href={`tel:${c.phone}`}>{c.phone}</a>}{c.phone && c.email ? " · " : ""}{c.email && <a className="link" href={`mailto:${c.email}`}>{c.email}</a>}</span>
              {c.notes && <span className="xs muted">{c.notes}</span>}
            </div>
          ))}
          <details><summary className="link small">+ Add a person</summary>
            <ActionForm action={fieldAddContact} submitLabel="Add person">
              <input type="hidden" name="placeId" value={place.id} />
              <F label="Name"><input name="name" required maxLength={100} /></F>
              <F label="Title"><input name="title" maxLength={80} placeholder="Front desk, director…" /></F>
              <F label="Phone"><input name="phone" maxLength={30} inputMode="tel" /></F>
              <F label="Email"><input name="email" type="email" maxLength={160} /></F>
              <F label="Notes"><textarea name="notes" maxLength={500} placeholder="Best time to call, who to ask for…" /></F>
            </ActionForm>
          </details>
        </section>

        <section className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Log a call, email, text or visit</span>
          <ActionForm action={fieldLogTouch} submitLabel="Save to timeline">
            <input type="hidden" name="placeId" value={place.id} />
            <div className="grid2">
              <F label="What"><select name="kind" defaultValue="call">{Object.entries(TOUCH_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F>
              <F label="With"><select name="contactId" defaultValue=""><option value="">—</option>{contactOpts}</select></F>
              <F label="Date"><input name="date" type="date" defaultValue={today()} /></F>
              <F label="Time"><input name="time" type="time" /></F>
            </div>
            <F label="What happened"><textarea name="summary" required maxLength={2000} placeholder="Talked to Ms. Smith — they'll take 10 cards. Wants a call back Monday." /></F>
          </ActionForm>
        </section>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <section className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Book a meeting or drop-off</span>
          <ActionForm action={fieldAddStep} submitLabel="Book it">
            <input type="hidden" name="placeId" value={place.id} />
            <F label="Type"><select name="kind" defaultValue="dropoff">{Object.entries(STEP_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F>
            <div className="grid2">
              <F label="Date"><input name="date" type="date" required /></F>
              <F label="Time"><input name="time" type="time" required /></F>
              <F label="Meet with"><select name="contactId" defaultValue=""><option value="">—</option>{contactOpts}</select></F>
              <F label="Or type a name"><input name="meetWith" maxLength={120} /></F>
            </div>
            <F label="Virtual meeting link (virtual only)"><input name="link" maxLength={400} placeholder="https://zoom.us/…" /></F>
            <F label="Notes"><textarea name="notes" maxLength={1000} placeholder="Use the side entrance; ask for the front desk." /></F>
          </ActionForm>
          {t.steps.length > 0 && <table className="tbl"><tbody>{t.steps.map((st) => (
            <tr key={st.id}><td className="small b">{at(st.starts_at)}</td><td><span className="tag">{STEP_KINDS[st.kind]}</span>{st.status !== "planned" && <span className={`tag ${st.status === "done" ? "ok" : "bad"}`} style={{ marginLeft: 6 }}>{st.status === "done" ? "Done" : "Canceled"}</span>}
              <div className="xs muted">{st.contact ?? st.meet_with ?? ""}{st.link ? <> · <a className="link" href={st.link} target="_blank" rel="noreferrer">link</a></> : null}{st.notes ? ` · ${st.notes}` : ""}</div></td>
              <td>{st.status === "planned" && <span className="row" style={{ gap: 6 }}>
                <form action={fieldStepStatus}><input type="hidden" name="id" value={st.id} /><input type="hidden" name="status" value="done" /><button className="link xs">Done</button></form>
                <form action={fieldStepStatus}><input type="hidden" name="id" value={st.id} /><input type="hidden" name="status" value="cancelled" /><button className="link xs">Cancel</button></form></span>}</td></tr>
          ))}</tbody></table>}
        </section>

        <section className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Cards for this organization</span>
          {supply.length === 0 ? <span className="small muted">There are no published cards for this area yet.</span> : (
            <ActionForm action={fieldRequestCards} submitLabel={actor.assistant ? "Ask for approval" : "Assign cards"}>
              <input type="hidden" name="placeId" value={place.id} />
              <div className="grid2">
                <F label="Cards"><select name="batchId">{supply.map((x) => <option key={x.id} value={x.id}>{x.label} ({x.left} left)</option>)}</select></F>
                <F label="How many"><input name="quantity" type="number" min={1} max={1000} defaultValue={DEFAULT_CARDS_PER_ORG} /></F>
                <F label="Drop-off date"><input name="date" type="date" /></F>
                <F label="Note"><input name="notes" maxLength={300} placeholder="Asked for 10 for their teen program" /></F>
              </div>
            </ActionForm>
          )}
          {actor.assistant && <span className="xs muted">Your request waits for the owner&apos;s approval.</span>}
          {t.cards.length > 0 && <table className="tbl"><tbody>{t.cards.map((c) => (
            <tr key={c.id}><td className="num b">{c.quantity}</td><td className="small">{day(c.at)}</td>
              <td><span className={`tag ${c.status === "planned" ? "warn" : c.status === "cancelled" ? "bad" : "ok"}`}>{c.status === "planned" && c.requestedBy ? "Waiting for approval" : c.status === "cancelled" ? "Declined / canceled" : c.status === "assigned" ? "Approved" : c.status}</span></td>
              <td className="xs muted">{c.by}{c.notes ? ` · ${c.notes}` : ""}</td></tr>
          ))}</tbody></table>}
        </section>
      </div>

      <section className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Timeline</span>
        {t.touches.length === 0 ? <span className="small muted">Nothing logged yet.</span> : t.touches.map((x) => (
          <div key={x.id} className="col fsep" style={{ gap: 2, paddingBottom: 8 }}>
            <span className="xs muted">{at(x.at)} · {TOUCH_KINDS[x.kind] ?? x.kind}{x.contact ? ` with ${x.contact}` : ""} · {x.by}</span>
            <span className="small" style={{ whiteSpace: "pre-wrap" }}>{x.summary}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ───────────── Pop-ups ───────────── */

export async function PopupsView({ actor, base, editId }: { actor: FieldActor; base: string; editId?: string }) {
  const rows = await popups(actor.scope);
  const edit = rows.find((r) => r.id === editId) ?? null;
  const d = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Chicago" });
  const t = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="col" style={{ gap: 18 }}>
      <section className="card" style={{ gap: 12 }} id="form">
        <span className="eyebrow">{edit ? `Edit — ${edit.name}` : "Add a pop-up"}</span>
        <span className="xs muted">Our own pop-up (for example at a Boys & Girls Club) or someone else&apos;s event Nearest signed up for as a vendor. Professionals come by in person to sign up. When it&apos;s Confirmed, it gets a public event page.</span>
        <ActionForm action={savePopup} submitLabel="Save pop-up">
          {edit && <input type="hidden" name="id" value={edit.id} />}
          <div className="grid2">
            <F label="Event name"><input name="name" required maxLength={120} defaultValue={edit?.name} placeholder="Nearest Pro Sign-Up Day" /></F>
            <F label="Kind"><select name="kind" defaultValue={edit?.kind ?? "ours"}><option value="ours">Our pop-up</option><option value="vendor">Someone else&apos;s event (we&apos;re a vendor)</option></select></F>
            <F label="Host (organization or company)"><input name="hostName" maxLength={120} defaultValue={edit?.host_name ?? ""} placeholder="Boys & Girls Club of Collin County" /></F>
            <F label="Status"><select name="status" defaultValue={edit?.status === "confirmed" ? "confirmed" : "planned"}><option value="planned">Planned (private)</option><option value="confirmed">Confirmed (public page on)</option></select></F>
            <F label="Street address"><input name="street" required maxLength={160} defaultValue={edit?.street} /></F>
            <F label="City"><input name="city" required maxLength={80} defaultValue={edit?.city_name} /></F>
            <F label="State"><input name="state" maxLength={2} defaultValue={edit?.state ?? "TX"} /></F>
            <F label="ZIP"><input name="zip" required maxLength={10} defaultValue={edit?.zip} /></F>
            <F label="Date"><input name="date" type="date" required defaultValue={edit ? d(edit.starts_at) : ""} /></F>
            <div className="grid2"><F label="Starts"><input name="start" type="time" required defaultValue={edit ? t(edit.starts_at) : ""} /></F><F label="Ends"><input name="end" type="time" required defaultValue={edit ? t(edit.ends_at) : ""} /></F></div>
            <F label="Event listing link (optional)"><input name="sourceUrl" maxLength={400} defaultValue={edit?.source_url ?? ""} placeholder="https://facebook.com/events/…" /></F>
            <F label="Contact at the event (private)"><input name="contactName" maxLength={100} defaultValue={edit?.contact_name ?? ""} /></F>
            <F label="Their phone or email (private)"><input name="contact" maxLength={160} defaultValue={edit?.contact ?? ""} /></F>
          </div>
          <div className="grid2">
            <F label="Space cost (our pop-up — free or $)"><input name="spaceCost" maxLength={120} defaultValue={edit?.space_cost ?? ""} placeholder="Free / $75" /></F>
            <F label="Vendor fee (their event — what they charge us)"><input name="vendorFee" maxLength={120} defaultValue={edit?.vendor_fee ?? ""} placeholder="$40 per table" /></F>
            <F label="Our fee (what we charge other vendors, if any)"><input name="ourFee" maxLength={120} defaultValue={edit?.our_fee ?? ""} placeholder="None" /></F>
            <F label="What we bring"><input name="bring" maxLength={600} defaultValue={edit?.bring ?? ""} placeholder="Refreshments, cards, banner, sign-up tablet" /></F>
          </div>
          <span className="xs muted">Anything that costs money goes to {actor.assistant ? "your owner" : "you"} — {actor.assistant ? "never agree to or pay a fee yourself" : "your assistant can't agree to or pay a fee"}.</span>
          <F label="Details for the public page"><textarea name="details" maxLength={1500} defaultValue={edit?.details ?? ""} placeholder="Beauty professionals: stop by our table to set up your free Nearest profile. Bring your phone and a photo of your work." /></F>
          <F label="Private notes"><textarea name="notes" maxLength={1500} defaultValue={edit?.notes ?? ""} placeholder="Set-up at 9:30, table provided, park in back." /></F>
        </ActionForm>
        {edit && <Link className="link xs" href={`${base}/popups`}>Cancel editing</Link>}
      </section>
      <section className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Pop-ups</span>
        <table className="tbl"><thead><tr><th>When</th><th>Event</th><th>Where</th><th>Status</th><th className="num">Sign-ups</th><th /></tr></thead>
          <tbody>{rows.length === 0 ? <tr><td className="empty" colSpan={6}>No pop-ups yet.</td></tr> : rows.map((r) => (
            <tr key={r.id} id={`p-${r.id}`}><td className="small b">{at(r.starts_at)}</td>
              <td><span className="b">{r.name}</span><div className="xs muted">{r.kind === "vendor" ? "Vendor at " : ""}{r.host_name ?? ""}{actor.scope === null && r.owner ? ` · ${r.owner}` : ""}</div>
                {(r.space_cost || r.vendor_fee || r.our_fee || r.bring) && <div className="xs">{[r.space_cost && `Space ${r.space_cost}`, r.vendor_fee && `Vendor fee ${r.vendor_fee}`, r.our_fee && `Our fee ${r.our_fee}`, r.bring && `Bring: ${r.bring}`].filter(Boolean).join(" · ")}</div>}
                {[r.space_cost, r.vendor_fee].some((x) => x && !/^(free|\$?0(\.00)?|none|no)$/i.test(x.trim())) && r.status === "planned" && <span className="tag warn">Needs owner OK — costs money</span>}</td>
              <td className="small">{r.street}, {r.city_name} {r.zip}</td>
              <td><span className={`tag ${r.status === "confirmed" ? "ok" : r.status === "cancelled" ? "bad" : ""}`}>{POPUP_STATUS[r.status]}</span>
                {r.status === "confirmed" && <div><Link className="link xs" href={`/pop-ups/${r.id}`} target="_blank">Public page</Link> <CopyButton text={`${SITE_URL}/pop-ups/${r.id}`} label="Copy" /></div>}</td>
              <td className="num">{r.signups ?? "—"}</td>
              <td><Link className="link xs" href={`${base}/popups?edit=${r.id}#form`}>Edit</Link>
                <form action={popupStatus} className="row" style={{ gap: 6, marginTop: 6 }}>
                  <input type="hidden" name="id" value={r.id} />
                  <select name="status" defaultValue={r.status} className="fin" style={{ height: 32 }}>{Object.entries(POPUP_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <input name="signups" type="number" min={0} placeholder="Sign-ups" defaultValue={r.signups ?? ""} className="fin" style={{ width: 80, height: 32 }} />
                  <button className="link xs">Save</button>
                </form></td></tr>
          ))}</tbody></table>
      </section>
    </div>
  );
}

/* ───────────── Professionals ───────────── */

export async function ProsView({ actor }: { actor: FieldActor }) {
  const { sql } = await import("drizzle-orm");
  const cats = await db.select({ name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort), asc(categories.name));
  // Assistants see ONLY the professionals they added themselves — never the owner's own prospects.
  const helper = actor.assistant?.userId ?? null;
  const scopeSql = actor.assistant ? sql`where p.recruiter_id = ${actor.scope} and p.entered_by = ${helper}` : actor.scope ? sql`where p.recruiter_id = ${actor.scope}` : sql``;
  const rows = (await db.execute(sql`select p.id, p.name, p.business, p.city, p.category, p.email, p.phone, p.status, p.updated_at as "updatedAt", p.entered_by as "enteredById", u.first_name as "enteredBy", o.first_name as owner
    from prospects p left join users u on u.id = p.entered_by left join users o on o.id = p.recruiter_id ${scopeSql} order by p.updated_at desc limit 150`)).rows as
    { id: string; name: string; business: string | null; city: string | null; category: string | null; email: string | null; phone: string | null; status: string; updatedAt: string; enteredById: string | null; enteredBy: string | null; owner: string | null }[];
  const mine = actor.assistant ? rows : [];
  return (
    <div className="col" style={{ gap: 18 }}>
      <section className="card" style={{ gap: 12 }}>
        <span className="eyebrow">Add a professional</span>
        <span className="xs muted">They go into Outreach for {actor.assistant ? "your owner" : "you"}. Tick the box to email them the sign-up link — replies come back to {actor.user.email}. Joining is free; they set up their profile and submit it for review.</span>
        <ActionForm action={teamAddProspect} submitLabel="Add professional">
          <div className="grid2">
            <F label="Name"><input name="name" required maxLength={120} /></F>
            <F label="Business (optional)"><input name="business" maxLength={120} /></F>
            <F label="Service"><select name="category" defaultValue="">{[<option key="" value="">Choose</option>, ...cats.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)]}</select></F>
            <F label="City"><input name="city" maxLength={80} /></F>
            <F label="Email"><input name="email" type="email" maxLength={160} /></F>
            <F label="Phone"><input name="phone" maxLength={30} inputMode="tel" /></F>
            <F label="Where you found them"><input name="source" maxLength={60} placeholder="Instagram, pop-up, salon…" /></F>
          </div>
          <F label="Notes"><textarea name="notes" maxLength={1000} /></F>
          <label className="check"><input type="checkbox" name="send" />Email them the sign-up link now</label>
        </ActionForm>
      </section>
      {actor.assistant && <div className="card small">You&apos;ve added <b>{mine.length}</b> professionals — <b>{mine.filter((r) => ["registered", "profile_complete"].includes(r.status)).length}</b> have created their account.</div>}
      <section className="card" style={{ gap: 10 }}>
        <span className="eyebrow">{actor.assistant ? "Professionals you added" : "Prospects"}</span>
        <table className="tbl"><thead><tr><th>Name</th><th>Service · city</th><th>Contact</th><th>Status</th><th>Added by</th><th /></tr></thead>
          <tbody>{rows.length === 0 ? <tr><td className="empty" colSpan={6}>No prospects yet.</td></tr> : rows.map((r) => (
            <tr key={r.id}><td className="b">{r.name}<div className="xs muted">{r.business ?? ""}{actor.scope === null && r.owner ? ` · ${r.owner}` : ""}</div></td>
              <td className="small">{[r.category, r.city].filter(Boolean).join(" · ")}</td>
              <td className="xs">{r.email ?? ""}{r.email && r.phone ? <br /> : null}{r.phone ?? ""}</td>
              <td><span className={`tag ${["registered", "profile_complete"].includes(r.status) ? "ok" : ""}`}>{r.status.replace(/_/g, " ")}</span></td>
              <td className="xs">{r.enteredBy ?? "—"}</td>
              <td>{r.email && !["registered", "profile_complete", "opted_out", "declined"].includes(r.status) && <form action={teamSendLink}><input type="hidden" name="id" value={r.id} /><button className="link xs">Email sign-up link</button></form>}
                <details><summary className="link xs">Log</summary>
                  <ActionForm action={teamProspectNote} submitLabel="Save">
                    <input type="hidden" name="id" value={r.id} />
                    <select name="kind" defaultValue="call">{Object.entries(TOUCH_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <textarea name="summary" required maxLength={1000} style={{ minHeight: 60 }} />
                  </ActionForm></details></td></tr>
          ))}</tbody></table>
      </section>
    </div>
  );
}

/* ───────────── Ads ───────────── */

export async function AdsView({ actor, base, editId }: { actor: FieldActor; base: string; editId?: string }) {
  const [drafts, r, saved] = await Promise.all([adDraftsFor(actor.scope), liveReports(), trackingSaved()]);
  const { mainOwnerId } = await import("@/lib/partner");
  const mainTeam = actor.ownerId === (await mainOwnerId());
  const edit = drafts.find((d) => d.id === editId) ?? null;
  const owner = !actor.assistant;
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
  return (
    <div className="col" style={{ gap: 18 }}>
      <section className="card" style={{ gap: 12 }} id="form">
        <span className="eyebrow">{edit ? `Edit — ${edit.name}` : "Prepare an ad campaign"}</span>
        <span className="xs muted">{actor.assistant ? "Set everything up here, then Send for approval. The owner reviews it and launches it in the ad platform (that's where the card is)." : "Your assistant's drafts show below — approve, ask for changes, or mark launched once it's live in the ad platform."}</span>
        <ActionForm action={saveAdDraft} submitLabel="Save draft">
          {edit && <input type="hidden" name="id" value={edit.id} />}
          <div className="grid2">
            <F label="Platform"><select name="platform" defaultValue={edit?.platform ?? "facebook"}><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="google">Google</option></select></F>
            <F label="Campaign name"><input name="name" required maxLength={120} defaultValue={edit?.name} placeholder="Frisco lash techs — Dec" /></F>
            <F label="Goal"><input name="goal" maxLength={200} defaultValue={edit?.goal ?? ""} placeholder="Student votes / pro sign-ups" /></F>
            <F label="Budget ($)"><input name="budget" inputMode="decimal" maxLength={10} defaultValue={edit?.budget_cents ? (edit.budget_cents / 100).toString() : ""} /></F>
            <F label="Budget is"><select name="budgetKind" defaultValue={edit?.budget_kind ?? "daily"}><option value="daily">Per day</option><option value="total">Total</option></select></F>
            <div className="grid2"><F label="Starts"><input name="startsOn" type="date" defaultValue={edit?.starts_on ?? ""} /></F><F label="Ends"><input name="endsOn" type="date" defaultValue={edit?.ends_on ?? ""} /></F></div>
            <F label="Headline"><input name="headline" maxLength={200} defaultValue={edit?.headline ?? ""} /></F>
            <F label="Link (use an ad link from below)"><input name="link" maxLength={500} defaultValue={edit?.link ?? ""} placeholder="https://usenearest.com/vote?utm_source=…" /></F>
            <F label="Images / video (link to Drive, Canva…)"><input name="creative" maxLength={500} defaultValue={edit?.creative ?? ""} /></F>
          </div>
          <F label="Who should see it (audience)"><textarea name="audience" maxLength={1000} defaultValue={edit?.audience ?? ""} placeholder="Ages 18–24, 15 miles around Frisco, interests: beauty, college…" /></F>
          <F label="Ad text"><textarea name="primaryText" maxLength={2000} defaultValue={edit?.primary_text ?? ""} /></F>
          <F label="Notes for the owner"><textarea name="notes" maxLength={1000} defaultValue={edit?.notes ?? ""} /></F>
          <label className="check"><input type="checkbox" name="intent" value="submit" />Send for approval now</label>
        </ActionForm>
      </section>

      <section className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Ad campaigns</span>
        <table className="tbl"><thead><tr><th>Campaign</th><th>Budget</th><th>Dates</th><th>Status</th><th /></tr></thead>
          <tbody>{drafts.length === 0 ? <tr><td className="empty" colSpan={5}>No ad campaigns prepared yet.</td></tr> : drafts.map((d) => (
            <tr key={d.id}><td className="b">{d.name}<div className="xs muted">{d.platform}{d.by ? ` · by ${d.by}` : ""}{actor.scope === null && d.owner ? ` · ${d.owner}` : ""}</div>{d.review_note && <div className="xs" style={{ color: "#E3C58A" }}>{d.review_note}</div>}</td>
              <td className="small">{d.budget_cents ? `${money(d.budget_cents)} ${d.budget_kind === "daily" ? "/ day" : "total"}` : "—"}</td>
              <td className="small">{d.starts_on ?? "—"} – {d.ends_on ?? ""}</td>
              <td><span className={`tag ${d.status === "approved" || d.status === "launched" ? "ok" : d.status === "changes" ? "warn" : ""}`}>{AD_STATUS[d.status]}</span></td>
              <td><Link className="link xs" href={`${base}/ads?edit=${d.id}#form`}>Open</Link>
                {owner && d.status !== "launched" && <form action={reviewAdDraft} className="col" style={{ gap: 4, marginTop: 6 }}>
                  <input type="hidden" name="id" value={d.id} />
                  <input name="note" placeholder="Note (optional)" maxLength={1000} className="fin" style={{ height: 30 }} />
                  <span className="row" style={{ gap: 8 }}>
                    <button className="link xs" name="decision" value="approved">Approve</button>
                    <button className="link xs" name="decision" value="changes">Ask for changes</button>
                    <button className="link xs" name="decision" value="launched">Mark launched</button>
                  </span></form>}</td></tr>
          ))}</tbody></table>
      </section>

      <section className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Ad links</span>
        <AdLinks site={SITE_URL} campaigns={r.campaigns.map((c) => c.name)} />
      </section>

      <section className="card" style={{ gap: 10 }}>
        <span className="eyebrow">How the ads are doing</span>
        <table className="tbl"><thead><tr><th>Platform</th><th>Campaign</th><th className="num">Visits</th><th className="num">Votes</th><th className="num">Vote rate</th><th className="num">Registered</th><th className="num">Spend</th><th className="num">Cost per vote</th></tr></thead>
          <tbody>{r.ads.length === 0 ? <tr><td className="empty" colSpan={8}>No visits from ad links yet.</td></tr> : r.ads.map((x) => (
            <tr key={x.platform + x.campaign}><td>{x.platform}</td><td>{x.campaign}</td><td className="num">{x.visits}</td><td className="num">{x.votes}</td><td className="num">{pct(x.votes, x.visits)}</td>
              <td className="num">{x.registered}</td><td className="num">{x.spend ? money(x.spend) : "—"}</td><td className="num">{x.spend && x.votes ? money(Math.round(x.spend / x.votes)) : "—"}</td></tr>
          ))}</tbody></table>
        <span className="eyebrow" style={{ marginTop: 8 }}>Add ad spend</span>
        <ActionForm action={fieldAddSpend} submitLabel="Save spend">
          <div className="grid2">
            <F label="Platform"><select name="platform" defaultValue="facebook"><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="google">Google</option><option value="other">Other</option></select></F>
            <F label="Campaign (as in the ad link)"><input name="campaign" required maxLength={120} /></F>
            <F label="Amount spent ($)"><input name="amount" inputMode="decimal" required /></F>
            <div className="grid2"><F label="From"><input name="fromDay" type="date" required /></F><F label="To"><input name="toDay" type="date" required /></F></div>
          </div>
        </ActionForm>
      </section>

      {mainTeam && <section className="card" style={{ gap: 10 }} id="tracking">
        <span className="eyebrow">Tracking (pixels)</span>
        <span className="xs muted">Paste each ID from the ad platform and save — it goes live on the voting page right away (it loads only after a visitor allows ad measurement). Leave a box empty to use the one set in Vercel. The Meta Conversions API token stays in Vercel.</span>
        <ActionForm action={saveTrackingIds} submitLabel="Save tracking">
          <div className="grid2">{TRACKING_FIELDS.map((f) => <F key={f.key} label={f.label}><input name={f.key} defaultValue={saved[f.key] ?? ""} maxLength={60} placeholder={f.hint} /></F>)}</div>
        </ActionForm>
      </section>}
    </div>
  );
}

export async function MapView({ actor, base = "/outreach" }: { actor: FieldActor; base?: string }) {
  const rows = await recruitNext(actor.scope, 200);
  return (
    <div className="col" style={{ gap: 18 }}>
      <section className="card row between" style={{ flexWrap: "wrap", gap: 10 }}>
        <span className="small">The live map shows every vote as it comes in.</span>
        <Link className="btn sm" href={`/live?back=${encodeURIComponent(`${base}/map`)}`} style={{ width: "auto" }}>Open the live vote map</Link>
      </section>
      <RecruitNext rows={rows} />
    </div>
  );
}
