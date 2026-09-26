import { desc, eq, sql } from "drizzle-orm";
import { db, users, professionalProfiles, proServices, cities, adminMembers } from "@/db";
import { DeleteAccount } from "@/components/DeleteAccount";
import { AdminHead } from "@/components/AdminHead";
import { requireAdmin } from "@/lib/admin";

export const metadata = { title: "Professionals" };

const TAG: Record<string, string> = { draft: "", submitted: "warn", approved: "ok", rejected: "bad" };

export default async function Professionals() {
  await requireAdmin();
  const rows = await db
    .select({
      p: professionalProfiles,
      u: users,
      city: cities.name,
      services: sql<number>`(select count(*)::int from ${proServices} where ${proServices.userId} = ${professionalProfiles.userId})`,
      isOwner: sql<boolean>`exists (select 1 from ${adminMembers} a where a.user_id = ${professionalProfiles.userId})`,
    })
    .from(professionalProfiles)
    .innerJoin(users, eq(users.id, professionalProfiles.userId))
    .leftJoin(cities, eq(cities.id, professionalProfiles.cityId))
    .orderBy(desc(professionalProfiles.createdAt))
    .limit(500);
  return (
    <>
      <AdminHead eyebrow={`${rows.length} professional${rows.length === 1 ? "" : "s"}`} title="Professionals" />
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Business</th><th>Name</th><th>Email</th><th>City</th><th>Cohort</th><th>Services</th><th>ASL</th><th>Status</th><th>Joined</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="empty" colSpan={10}>No professionals yet.</td></tr>}
            {rows.map(({ p, u, city, services, isOwner }) => (
              <tr key={p.userId}>
                <td>{p.businessName ?? "—"}</td><td>{u.firstName} {u.lastName}{isOwner && <span className="tag" style={{ marginLeft: 6 }}>Owner</span>}</td><td>{u.email}</td><td>{city ?? "—"}</td>
                <td><span className="tag">{p.cohort}</span></td><td>{services}</td><td>{p.aslLevel === "none" ? "—" : p.aslLevel}</td>
                <td><span className={`tag ${TAG[p.reviewStatus]}`}>{p.reviewStatus}</span></td>
                <td>{p.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}</td>
                <td><DeleteAccount userId={u.id} name={p.businessName ?? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()} ownerPro={isOwner} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
