import { headers } from "next/headers";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, invitations, cities, users } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { requireAdmin } from "@/lib/admin";
import { expireStaleInvites, foundingOpen } from "@/lib/invites";
import { revokeInvite, changeEntryState } from "@/app/admin/actions";
import { firstInStats } from "@/lib/entry";
import { emailInvite } from "@/app/admin/pro-actions";
import { deleteInvite } from "@/app/admin/people-actions";
import { CopyButton } from "@/components/CopyButton";
import { emailEnabled } from "@/lib/email";
import { InviteForm } from "./InviteForm";
import { SpecialInviteForm } from "./SpecialInviteForm";
import { mainOwnerId } from "@/lib/partner";
import { CopyLink } from "./CopyLink";

export const metadata = { title: "First In" };

const TAG: Record<string, string> = { invited: "", registered: "ok", expired: "bad", declined: "", revoked: "bad" };
const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });

export default async function Founding({ searchParams }: { searchParams: Promise<{ new?: string; emailed?: string; resent?: string }> }) {
  const { role, user } = await requireAdmin();
  const isMain = (await mainOwnerId()) === user.id; // only the main owner gives out free / pay-from-bookings accounts
  await expireStaleInvites();
  const [sp, f, rows, cityList, stats] = await Promise.all([
    searchParams,
    foundingOpen(),
    db
      .select({ i: invitations, city: cities.name, byFirst: users.firstName, byLast: users.lastName, byEmail: users.email })
      .from(invitations)
      .leftJoin(cities, eq(cities.id, invitations.cityId))
      .leftJoin(users, eq(users.id, invitations.createdBy))
      .orderBy(desc(invitations.createdAt))
      .limit(200),
    db.select({ id: cities.id, name: cities.name }).from(cities).where(eq(cities.active, true)).orderBy(asc(cities.name)),
    db.select({ status: invitations.status, n: sql<number>`count(*)::int` }).from(invitations).groupBy(invitations.status),
  ]);
  const { new: newCode, emailed } = sp;
  const by = (s: string) => stats.find((x) => x.status === s)?.n ?? 0;
  const sent = stats.reduce((a, x) => a + x.n, 0);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const fi = await firstInStats();
  const pct = Math.min(100, Math.round((fi.registered / fi.capacity) * 100));
  const STATE_LABEL = { FIRST_IN_OPEN: "First In open", FIRST_IN_CLOSED: "First In closed — enrollment paused", NEXT_ENTRY_OPEN: "Next entry open ($16 / $21)" } as const;

  return (
    <>
      <AdminHead eyebrow="Professional entry" title="First In" />
      {sp.resent && (
        <div className={`card ${sp.emailed === "1" ? "ok" : "warn"} small`}>
          <span className="b">{sp.emailed === "1" ? `Invitation ${sp.resent} was emailed again.` : emailEnabled() ? `The email for ${sp.resent} didn't send. Use Copy link and text or DM it instead.` : "Email isn't set up yet (add your Resend key — docs/LAUNCH.md step 3). Use Copy link and text or DM it instead."}</span>
        </div>
      )}
      {newCode && (
        <div className="card ok" style={{ gap: 10 }}>
          <span className="b">
            Invitation {newCode} created.{" "}
            {emailed === "1" && !sp.resent ? "It was emailed to them. You can also share this link:" : emailEnabled() ? "Email didn't send, so share this link with them:" : "Send this link to the professional:"}
          </span>
          <CopyLink url={`${origin}/pro/invite/${newCode}`} />
        </div>
      )}
      <div className="acols">
        <div className="card" style={{ gap: 14 }}>
          <div className="row between"><span className="stat" style={{ fontSize: 54 }}>{fi.registered} / {fi.capacity}</span><span className={`tag ${fi.open ? "ok" : "bad"}`}>{fi.open ? "Open" : "Closed"}</span></div>
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          <div className="kpis k4">
            <div className="card" style={{ gap: 6 }}><span className="xs muted">Capacity</span><span className="stat">{fi.capacity}</span></div>
            <div className="card" style={{ gap: 6 }}><span className="xs muted">Registered (paid)</span><span className="stat">{fi.registered}</span></div>
            <div className="card" style={{ gap: 6 }}><span className="xs muted">Remaining</span><span className="stat">{fi.remaining}</span>{fi.holding > 0 && <span className="xs muted">{fi.holding} paying now</span>}</div>
            <div className="card" style={{ gap: 6 }}><span className="xs muted">Invitations</span><span className="stat">{sent}</span><span className="xs muted">{by("invited")} pending • {by("expired")} expired</span></div>
          </div>
        </div>
        <InviteForm disabled={!f.open} />
      </div>
      {isMain && <SpecialInviteForm />}
      <div className="card" style={{ gap: 12, overflowX: "auto" }}>
        <span className="eyebrow">Invitations</span>
        <table className="tbl">
          <thead><tr><th>Name</th><th>Contact</th><th>Type</th><th>Code</th><th>Sent by</th><th>Created</th><th>Status</th><th>Expires</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="empty" colSpan={9}>No invitations yet. Generate the first one above.</td></tr>}
            {rows.map(({ i, city, byFirst, byLast, byEmail }) => (
              <tr key={i.id}>
                <td>{i.name}</td><td>{i.contact}</td>
                <td><span className={`tag ${i.kind === "FIRST_IN" ? "" : "warn"}`}>{i.kind === "AMBASSADOR" ? "Ambassador — free" : i.kind === "BOOKING_PAID" ? `Pay from bookings $${((i.rateCents ?? 1500) / 100).toFixed(0)}/mo` : "First In"}</span></td>
                <td className="num">{i.code}</td>
                <td>{[byFirst, byLast].filter(Boolean).join(" ") || byEmail || "—"}</td>
                <td>{fmt(i.createdAt)}</td>
                <td><span className={`tag ${TAG[i.status]}`}>{i.status}</span></td>
                <td>{i.status === "invited" ? fmt(i.expiresAt) : "—"}</td>
                <td>
                  <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                    {i.status === "invited" && i.contact.includes("@") && (
                      <form action={emailInvite}><input type="hidden" name="id" value={i.id} /><button className="link small" type="submit">Resend email</button></form>
                    )}
                    {i.status === "invited" && <CopyButton text={`${origin}/pro/invite/${i.code}`} />}
                    {i.status === "invited" && <form action={revokeInvite}><input type="hidden" name="id" value={i.id} /><button className="link small" type="submit">Revoke</button></form>}
                    {i.status !== "registered" && <form action={deleteInvite}><input type="hidden" name="id" value={i.id} /><button className="link small" type="submit" style={{ color: "#F2A38F" }}>Delete</button></form>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ gap: 12 }}>
        <div className="row between"><span className="eyebrow">Enrollment phase</span><span className={`tag ${fi.state === "FIRST_IN_CLOSED" ? "warn" : "ok"}`}>{STATE_LABEL[fi.state]}</span></div>
        <span className="small muted">First In closes by itself when professional #{fi.capacity} pays. Each professional keeps the rate they joined with for their first 12 months, whatever phase comes next.</span>
        {role === "OWNER" ? (
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {(["FIRST_IN_OPEN", "FIRST_IN_CLOSED", "NEXT_ENTRY_OPEN"] as const).map((st) => (
              <form key={st} action={changeEntryState}>
                <input type="hidden" name="state" value={st} />
                <button className={`btn ${fi.state === st ? "" : "ghost "}sm`} type="submit" disabled={fi.state === st || (st === "FIRST_IN_OPEN" && fi.registered >= fi.capacity)}>
                  {st === "FIRST_IN_OPEN" ? "Open First In ($11)" : st === "FIRST_IN_CLOSED" ? "Pause enrollment" : "Open next entry ($16 / $21)"}
                </button>
              </form>
            ))}
          </div>
        ) : <span className="xs muted">Only owners can change the enrollment phase.</span>}
      </div>
    </>
  );
}
