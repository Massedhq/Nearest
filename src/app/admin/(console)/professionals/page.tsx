import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db, users, professionalProfiles, proServices, categories, cities, adminMembers, bookings, reviews, fines, incidents, proStudentLinks } from "@/db";
import { ENTRY, type EntryType } from "@/lib/entry";
import { AdminHead } from "@/components/AdminHead";
import { DeleteAccount } from "@/components/DeleteAccount";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { fmtDate, money } from "@/lib/time";
import { toggleMembershipPause, cancelMembership, toggleListingPause } from "@/app/admin/pro-actions";

export const metadata = { title: "Professionals" };
export const dynamic = "force-dynamic";

const FILTERS = ["All", "Active", "Unpaid", "Inactive", "Suspended"] as const;
type Filter = (typeof FILTERS)[number];

export default async function Professionals({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; sel?: string; view?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const filter: Filter = (FILTERS as readonly string[]).includes(sp.f ?? "") ? (sp.f as Filter) : "All";
  const q = (sp.q ?? "").trim().toLowerCase();
  const s = await getSettings();
  const incidentLimit = Number(s["enforce.pro_incident_limit"]);

  const rows = await db
    .select({
      p: professionalProfiles,
      u: users,
      city: cities.name,
      isOwner: sql<boolean>`exists (select 1 from ${adminMembers} a where a.user_id = ${professionalProfiles.userId})`,
      services: sql<string | null>`(select string_agg(distinct c.name, ', ') from ${proServices} ps join ${categories} c on c.id = ps.category_id where ps.user_id = ${professionalProfiles.userId} and ps.active)`,
      bookings: sql<number>`(select count(*)::int from ${bookings} b where b.pro_id = ${professionalProfiles.userId} and b.status in ('confirmed','completed','no_show','cancelled_pro','cancelled_student'))`,
      proCancels: sql<number>`(select count(*)::int from ${bookings} b where b.pro_id = ${professionalProfiles.userId} and b.status = 'cancelled_pro')`,
      rating: sql<number | null>`(select round(avg(r.rating)::numeric, 1)::float from ${reviews} r where r.pro_id = ${professionalProfiles.userId} and not r.hidden)`,
      fineCents: sql<number>`(select coalesce(sum(f.amount_cents),0)::int from ${fines} f where f.pro_id = ${professionalProfiles.userId} and f.status = 'outstanding')`,
      fineDue: sql<Date | null>`(select min(f.due_at) from ${fines} f where f.pro_id = ${professionalProfiles.userId} and f.status = 'outstanding')`,
      incidents: sql<number>`(select count(*)::int from ${incidents} i join ${bookings} b on b.id = i.booking_id where b.pro_id = ${professionalProfiles.userId} and i.status = 'pro_fault')`,
      student: sql<string | null>`(select l.first_name || ' ' || l.last_name || ' <' || l.email || '> — ' || l.status from ${proStudentLinks} l where l.pro_id = ${professionalProfiles.userId} and l.status <> 'pending' order by l.created_at desc limit 1)`,
    })
    .from(professionalProfiles)
    .innerJoin(users, eq(users.id, professionalProfiles.userId))
    .leftJoin(cities, eq(cities.id, professionalProfiles.cityId))
    .orderBy(desc(professionalProfiles.createdAt))
    .limit(1000);

  const now = Date.now();
  const suspended = (r: (typeof rows)[number]) => Boolean(r.p.suspendedUntil && r.p.suspendedUntil.getTime() > now);
  const statusOf = (r: (typeof rows)[number]): Filter => {
    if (suspended(r)) return "Suspended";
    if (!r.p.entryPaidAt && !["active", "trialing", "past_due"].includes(r.p.subscriptionStatus ?? "")) return "Unpaid";
    if (r.p.reviewStatus === "approved" && ["active", "trialing"].includes(r.p.subscriptionStatus ?? "") && !r.p.listingPausedAt && !r.p.membershipPausedAt) return "Active";
    return "Inactive";
  };
  const matches = (r: (typeof rows)[number]) =>
    (filter === "All" || statusOf(r) === filter) &&
    (!q || [r.p.businessName, r.u.firstName, r.u.lastName, r.u.email, r.city].filter(Boolean).join(" ").toLowerCase().includes(q));
  const owners = rows.filter((r) => r.isOwner && matches(r));
  const others = rows.filter((r) => !r.isOwner && matches(r));
  const selected = rows.find((r) => r.p.userId === sp.sel) ?? null;
  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ q: sp.q, f: filter === "All" ? undefined : filter, sel: sp.sel, ...o }).filter(([, v]) => v) as [string, string][]).toString();
    return `/admin/professionals${p ? `?${p}` : ""}`;
  };

  const Row = ({ r }: { r: (typeof rows)[number] }) => {
    const identity = r.p.identityStatus;
    const complete = r.p.reviewStatus === "approved" || r.p.reviewStatus === "submitted";
    const sub = r.p.subscriptionStatus;
    const cancelRate = r.bookings ? Math.round((r.proCancels / r.bookings) * 100) : null;
    const isSel = selected?.p.userId === r.p.userId;
    return (
      <tr style={{ cursor: "pointer", background: isSel ? "#141416" : undefined }}>
        <td><Link href={href({ sel: r.p.userId, view: undefined })} style={{ color: "inherit", textDecoration: "none" }} className="b">{r.p.businessName ?? `${r.u.firstName ?? ""} ${r.u.lastName ?? ""}`.trim() ?? "—"}</Link>
          {r.p.listingPausedAt && <span className="tag bad" style={{ marginLeft: 6 }}>Paused</span>}</td>
        <td>{r.city ?? "—"}</td>
        <td><span className={`tag ${identity === "verified" ? "ok" : identity === "rejected" ? "bad" : "warn"}`}>{identity === "unverified" ? "Not started" : identity}</span></td>
        <td>{complete ? "Complete" : "Incomplete"}</td>
        <td className="small">{r.services ?? "—"}</td>
        <td className="small">{r.p.entryType && r.p.entryType in ENTRY ? `${ENTRY[r.p.entryType as EntryType].short} · ${money(r.p.monthlyRateCents ?? ENTRY[r.p.entryType as EntryType].cents)}` : "—"}</td>
        <td>{r.p.entryPaidAt ? fmtDate(r.p.entryPaidAt, { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
        <td>
          {r.fineCents > 0 && r.fineDue && r.fineDue.getTime() < now ? <span className="tag bad">Past due {money(r.fineCents)}</span>
            : sub === "past_due" ? <span className="tag bad">Past due</span>
            : r.p.membershipPausedAt ? "Paused" : r.p.membershipEndsAt ? `Ends ${fmtDate(r.p.membershipEndsAt, { month: "short", day: "numeric" })}` : sub === "active" || sub === "trialing" ? "Paid" : sub === "canceled" ? "Canceled" : r.p.entryPaidAt ? "Paid" : "Not paid"}
        </td>
        <td>{r.bookings}</td>
        <td>{r.rating ?? "—"}</td>
        <td>{cancelRate === null ? "—" : cancelRate >= 10 ? <span className="tag bad">{cancelRate}%</span> : `${cancelRate}%`}</td>
      </tr>
    );
  };

  return (
    <>
      <AdminHead eyebrow="People" title="Professionals" />
      <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
        <form action="/admin/professionals" className="search" style={{ flex: "1 1 280px", maxWidth: 420, height: 44 }}>
          <Icon name="search" />
          {filter !== "All" && <input type="hidden" name="f" value={filter} />}
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search professionals" aria-label="Search professionals" />
        </form>
        {FILTERS.map((f) => <Link key={f} className={`chip${filter === f ? " on" : ""}`} href={href({ f: f === "All" ? undefined : f, sel: undefined, view: undefined })}>{f}</Link>)}
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Professional</th><th>City</th><th>Identity</th><th>Profile</th><th>Services</th><th>Entry</th><th>Registered</th><th>Payment</th><th>Bookings</th><th>Rating</th><th>Pro cancel rate</th></tr></thead>
          <tbody>
            {owners.length > 0 && <tr><td colSpan={11} className="eyebrow" style={{ paddingTop: 10 }}>Owner business{owners.length === 1 ? "" : "es"}</td></tr>}
            {owners.map((r) => <Row key={r.p.userId} r={r} />)}
            {owners.length > 0 && <tr><td colSpan={11} className="eyebrow" style={{ paddingTop: 18 }}>All professionals</td></tr>}
            {others.map((r) => <Row key={r.p.userId} r={r} />)}
            {owners.length + others.length === 0 && <tr><td className="empty" colSpan={11}>No professionals match.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="card" style={{ gap: 12 }}>
          <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
            <div className="avatar sm">{(selected.p.businessName ?? selected.u.firstName ?? "N").slice(0, 2).toUpperCase()}</div>
            <div className="col g4 grow">
              <span className="b">{selected.p.businessName ?? `${selected.u.firstName} ${selected.u.lastName}`}{selected.isOwner && <span className="tag" style={{ marginLeft: 6 }}>Owner</span>}</span>
              <span className="xs muted">
                Incidents {selected.incidents % incidentLimit || (selected.incidents ? incidentLimit : 0)} of {incidentLimit}
                {selected.fineCents > 0 && selected.fineDue ? ` • Fine ${money(selected.fineCents)} due ${fmtDate(selected.fineDue, { month: "short", day: "numeric" })}` : ""}
                {suspended(selected) ? ` • Suspended until ${fmtDate(selected.p.suspendedUntil!, { month: "short", day: "numeric" })}` : ""}
              </span>
            </div>
            <Link className="btn ghost sm" href={href({ view: sp.view ? undefined : "1" })}>{sp.view ? "Hide profile" : "View profile"}</Link>
            <form action={toggleListingPause}><input type="hidden" name="userId" value={selected.p.userId} /><button className="btn ghost sm" type="submit">{selected.p.listingPausedAt ? "Resume listing" : "Pause listing"}</button></form>
            {selected.p.subscriptionStatus && selected.p.subscriptionStatus !== "canceled" && (
              <form action={toggleMembershipPause}><input type="hidden" name="userId" value={selected.p.userId} /><button className="btn ghost sm" type="submit">{selected.p.membershipPausedAt ? "Resume membership" : "Pause membership"}</button></form>
            )}
            {selected.p.subscriptionStatus && selected.p.subscriptionStatus !== "canceled" && (
              selected.p.membershipEndsAt ? (
                <form action={cancelMembership}><input type="hidden" name="userId" value={selected.p.userId} /><input type="hidden" name="when" value="undo" /><button className="btn ghost sm" type="submit">Keep membership (undo cancel)</button></form>
              ) : (
                <details className="menu-inline" style={{ position: "relative" }}>
                  <summary className="btn ghost sm" style={{ listStyle: "none", cursor: "pointer" }}>Cancel membership</summary>
                  <div className="card" style={{ position: "absolute", zIndex: 20, top: "110%", right: 0, width: 280, gap: 8, background: "#0A0A0B" }}>
                    <span className="small">Cancel {selected.p.businessName ?? "this professional"}&apos;s membership?</span>
                    <form action={cancelMembership}><input type="hidden" name="userId" value={selected.p.userId} /><input type="hidden" name="when" value="end" /><button className="btn ghost sm" type="submit" style={{ width: "100%" }}>At the end of their paid period</button></form>
                    <form action={cancelMembership}><input type="hidden" name="userId" value={selected.p.userId} /><input type="hidden" name="when" value="now" /><button className="btn danger sm" type="submit" style={{ width: "100%" }}>Right now</button></form>
                    <span className="xs muted">They&apos;re notified and can restart it themselves later.</span>
                  </div>
                </details>
              )
            )}
            {selected.u.email && <a className="btn ghost sm" href={`mailto:${selected.u.email}`}>Contact</a>}
            <Link className="btn sm" href={`/admin/professionals/${selected.p.userId}`}>Review account</Link>
          </div>
          {sp.view && (
            <div className="acols even" style={{ borderTop: "1px solid #1C1C1F", paddingTop: 12 }}>
              <div className="col small" style={{ gap: 6 }}>
                <span className="eyebrow">Profile</span>
                <span><span className="muted">Name:</span> {selected.u.firstName} {selected.u.lastName}</span>
                <span><span className="muted">Email:</span> {selected.u.email ?? "—"}</span>
                <span><span className="muted">City:</span> {selected.city ?? "—"}{selected.p.zip ? ` ${selected.p.zip}` : ""}</span>
                <span><span className="muted">Works:</span> {selected.p.serviceMode === "travel" ? "Travels to clients" : selected.p.serviceMode === "come_to_me" ? "Clients come to them" : "Both"}</span>
                <span><span className="muted">Services:</span> {selected.services ?? "—"}</span>
                <span><span className="muted">Joined:</span> {fmtDate(selected.p.createdAt)}</span>
                {selected.p.bio && <p className="p" style={{ margin: 0 }}>{selected.p.bio}</p>}
              </div>
              <div className="col small" style={{ gap: 6 }}>
                <span className="eyebrow">Account</span>
                <span><span className="muted">Review:</span> {selected.p.reviewStatus}</span>
                <span><span className="muted">Identity:</span> {selected.p.identityStatus}</span>
                <span><span className="muted">Payouts:</span> {selected.p.payoutsEnabled ? "Set up" : "Not set up"}</span>
                <span><span className="muted">Entry:</span> {selected.p.entryType && selected.p.entryType in ENTRY ? `${ENTRY[selected.p.entryType as EntryType].label} — ${money(selected.p.monthlyRateCents ?? 0)}/month for the first 12 months` : "Not paid yet"}</span>
                <span><span className="muted">Registered:</span> {selected.p.entryPaidAt ? fmtDate(selected.p.entryPaidAt) : "—"}</span>
                <span><span className="muted">Membership:</span> {selected.p.subscriptionStatus ?? "Not started"}</span>
                {selected.student && <span><span className="muted">Registered student:</span> {selected.student}</span>}
                <span><span className="muted">Listing:</span> {selected.p.listingPausedAt ? `Paused ${fmtDate(selected.p.listingPausedAt)}` : "Not paused"}</span>
                <div style={{ marginTop: 8 }}>
                  <DeleteAccount userId={selected.u.id} name={selected.p.businessName ?? `${selected.u.firstName ?? ""} ${selected.u.lastName ?? ""}`.trim()} ownerPro={selected.isOwner} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {!selected && <p className="xs muted p">Select a professional to see their account and actions.</p>}
    </>
  );
}
