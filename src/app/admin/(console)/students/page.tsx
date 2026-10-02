import { desc, eq } from "drizzle-orm";
import { db, users, studentProfiles, schools } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { requireAdmin } from "@/lib/admin";
import { isAlumni } from "@/lib/student";
import { DeleteAccount } from "@/components/DeleteAccount";

export const metadata = { title: "Students" };

const TAG: Record<string, string> = { unverified: "", pending: "warn", manual_review: "warn", verified: "ok", rejected: "bad" };

export default async function Students() {
  await requireAdmin();
  const rows = await db
    .select({ s: studentProfiles, u: users, school: schools.name })
    .from(studentProfiles)
    .innerJoin(users, eq(users.id, studentProfiles.userId))
    .leftJoin(schools, eq(schools.id, studentProfiles.schoolId))
    .orderBy(desc(studentProfiles.createdAt))
    .limit(500);
  const alumni = rows.filter(({ s }) => isAlumni(s)).length;
  const age = (dob: string | null) => (dob ? Math.floor((Date.now() - new Date(`${dob}T12:00:00Z`).getTime()) / (365.25 * 86400000)) : "—");
  return (
    <>
      <AdminHead eyebrow={`${rows.length} customer${rows.length === 1 ? "" : "s"} • ${alumni} Nearest Alumni`} title="Students" />
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Name</th><th>Email</th><th>Age</th><th>Guardian</th><th>School</th><th>Class</th><th>Status</th><th>Joined</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="empty" colSpan={10}>No students yet.</td></tr>}
            {rows.map(({ s, u, school }) => (
              <tr key={s.userId}>
                <td>{u.firstName} {u.lastName}</td><td>{u.email}</td><td>{age(u.dateOfBirth)}</td><td>{s.guardianStatus === "approved"
                  ? <><span className="tag ok">Parent approved</span><div className="xs muted">{s.guardianName} • {s.guardianEmail}</div></>
                  : s.guardianStatus === "declined"
                    ? <><span className="tag bad">Parent declined</span><div className="xs muted">{s.guardianEmail}</div></>
                    : s.guardianConsentAt || s.guardianStatus === "pending"
                      ? <><span className="tag warn">Waiting for parent</span><div className="xs muted">{s.guardianEmail}</div></>
                      : "—"}</td><td>{school ?? "—"}</td><td>{s.graduationYear ?? "—"}</td>
                <td>{isAlumni(s) ? <span className="tag ok">Nearest Alumni</span> : <span className={`tag ${TAG[s.verificationStatus]}`}>{s.verificationStatus === "verified" ? "Verified Student" : s.verificationStatus.replace("_", " ")}</span>}</td>
                <td>{s.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}</td>
                <td><DeleteAccount userId={u.id} name={`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
