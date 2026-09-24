import { headers } from "next/headers";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, invitations, cities } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { requireAdmin } from "@/lib/admin";
import { expireStaleInvites, foundingOpen } from "@/lib/invites";
import { revokeInvite, closeFounding } from "@/app/admin/actions";
import { InviteForm } from "./InviteForm";
import { CopyLink } from "./CopyLink";

export const metadata = { title: "Founding 750" };

const TAG: Record<string, string> = { invited: "", registered: "ok", expired: "bad", declined: "", revoked: "bad" };
const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });

export default async function Founding({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { role } = await requireAdmin();
  await expireStaleInvites();
  const [{ new: newCode }, f, rows, cityList, stats] = await Promise.all([
    searchParams,
    foundingOpen(),
    db
      .select({ i: invitations, city: cities.name })
      .from(invitations)
      .innerJoin(cities, eq(cities.id, invitations.cityId))
      .orderBy(desc(invitations.createdAt))
      .limit(200),
    db.select({ id: cities.id, name: cities.name }).from(cities).where(eq(cities.active, true)).orderBy(asc(cities.name)),
    db.select({ status: invitations.status, n: sql<number>`count(*)::int` }).from(invitations).groupBy(invitations.status),
  ]);
  const by = (s: string) => stats.find((x) => x.status === s)?.n ?? 0;
  const sent = stats.reduce((a, x) => a + x.n, 0);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const pct = Math.min(100, Math.round((f.used / f.capacity) * 100));

  return (
    <>
      <AdminHead eyebrow="Launch cohort" title="Founding 750" />
      {newCode && (
        <div className="card ok" style={{ gap: 10 }}>
          <span className="b">Invitation {newCode} created. Send this link to the professional:</span>
          <CopyLink url={`${origin}/pro/invite/${newCode}`} />
        </div>
      )}
      <div className="acols">
        <div className="card" style={{ gap: 14 }}>
          <div className="row between"><span className="stat" style={{ fontSize: 54 }}>{f.used} / {f.capacity}</span><span className={`tag ${f.open ? "ok" : "bad"}`}>{f.open ? "Open" : "Closed"}</span></div>
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          <div className="kpis k4">
            <div className="card" style={{ gap: 6 }}><span className="xs muted">Invitations sent</span><span className="stat">{sent}</span></div>
            <div className="card" style={{ gap: 6 }}><span className="xs muted">Pending</span><span className="stat">{by("invited")}</span></div>
            <div className="card" style={{ gap: 6 }}><span className="xs muted">Expired</span><span className="stat">{by("expired")}</span></div>
            <div className="card" style={{ gap: 6 }}><span className="xs muted">Registered</span><span className="stat">{by("registered")}</span></div>
          </div>
        </div>
        <InviteForm cities={cityList} disabled={!f.open} />
      </div>
      <div className="card" style={{ gap: 12, overflowX: "auto" }}>
        <span className="eyebrow">Invitations</span>
        <table className="tbl">
          <thead><tr><th>Name</th><th>Contact</th><th>City</th><th>Category</th><th>Code</th><th>Created</th><th>Status</th><th>Expires</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="empty" colSpan={9}>No invitations yet. Generate the first one above.</td></tr>}
            {rows.map(({ i, city }) => (
              <tr key={i.id}>
                <td>{i.name}</td><td>{i.contact}</td><td>{city}</td><td>{i.category}</td><td className="num">{i.code}</td>
                <td>{fmt(i.createdAt)}</td>
                <td><span className={`tag ${TAG[i.status]}`}>{i.status}</span></td>
                <td>{i.status === "invited" ? fmt(i.expiresAt) : "—"}</td>
                <td>{i.status === "invited" && (
                  <form action={revokeInvite}><input type="hidden" name="id" value={i.id} /><button className="link small" type="submit">Revoke</button></form>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {role === "OWNER" && (
        <form action={closeFounding} className="card bad">
          <div className="row">
            <div className="grow"><div className="b">Close founding registration</div><div className="small muted">Stops all founding invitations and registrations instantly. Reopen it from Rules &amp; Settings.</div></div>
            <button className="btn danger sm" type="submit" disabled={!f.open}>Close founding registration</button>
          </div>
        </form>
      )}
    </>
  );
}
