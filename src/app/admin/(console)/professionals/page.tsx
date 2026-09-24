import { desc, eq, sql } from "drizzle-orm";
import { db, users, professionalProfiles, proServices, cities } from "@/db";
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
          <thead><tr><th>Business</th><th>Name</th><th>Email</th><th>City</th><th>Cohort</th><th>Services</th><th>ASL</th><th>Status</th><th>Joined</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="empty" colSpan={9}>No professionals yet.</td></tr>}
            {rows.map(({ p, u, city, services }) => (
              <tr key={p.userId}>
                <td>{p.businessName ?? "—"}</td><td>{u.firstName} {u.lastName}</td><td>{u.email}</td><td>{city ?? "—"}</td>
                <td><span className="tag">{p.cohort}</span></td><td>{services}</td><td>{p.aslLevel === "none" ? "—" : p.aslLevel}</td>
                <td><span className={`tag ${TAG[p.reviewStatus]}`}>{p.reviewStatus}</span></td>
                <td>{p.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
