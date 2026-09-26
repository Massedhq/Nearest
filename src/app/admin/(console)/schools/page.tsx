import { asc, desc, eq } from "drizzle-orm";
import { db, schools, cities, schoolRequests, users } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { addSchool, toggleSchool, dismissRequest } from "@/app/admin/student-actions";
import { PlaceFields } from "@/components/PlaceFields";

export const metadata = { title: "Schools" };

const TYPE: Record<string, string> = { high_school: "High school", college: "College", trade: "Trade school" };

function SchoolFields({ name = "", type = "high_school", requestId, city = "" }: { name?: string; type?: string; requestId?: string; city?: string }) {
  const k = requestId ?? "new";
  return (
    <>
      {requestId && <input type="hidden" name="requestId" value={requestId} />}
      <div className="field"><label htmlFor={`n_${k}`}>School name</label><input id={`n_${k}`} name="name" defaultValue={name} required /></div>
      <div className="field"><label htmlFor={`t_${k}`}>Type</label>
        <select id={`t_${k}`} name="type" defaultValue={type}><option value="high_school">High school</option><option value="college">College</option><option value="trade">Trade school</option></select>
      </div>
      <PlaceFields id={`p_${k}`} city={city} />
    </>
  );
}

export default async function Schools() {
  await requireAdmin();
  const [list, requests] = await Promise.all([
    db.select({ s: schools, city: cities.name, state: cities.state }).from(schools).innerJoin(cities, eq(cities.id, schools.cityId)).orderBy(asc(cities.state), asc(cities.name), asc(schools.name)),
    db
      .select({ r: schoolRequests, first: users.firstName, last: users.lastName })
      .from(schoolRequests)
      .innerJoin(users, eq(users.id, schoolRequests.userId))
      .where(eq(schoolRequests.status, "pending"))
      .orderBy(desc(schoolRequests.createdAt)),
  ]);
  return (
    <>
      <AdminHead eyebrow={`${list.length} schools • ${requests.length} request${requests.length === 1 ? "" : "s"}`} title="Schools" />
      {requests.length > 0 && (
        <div className="card" style={{ gap: 14 }}>
          <span className="eyebrow">Students asked for these schools</span>
          {requests.map(({ r, first, last }) => (
            <div key={r.id} className="acols even" style={{ borderBottom: "1px solid #1C1C1F", paddingBottom: 14 }}>
              <div className="col" style={{ gap: 4 }}>
                <span className="b">{r.name}</span>
                <span className="small muted">{r.cityName} • {TYPE[r.type]} • requested by {first} {last}</span>
                <form action={dismissRequest}><input type="hidden" name="id" value={r.id} /><button className="link small" type="submit">Dismiss</button></form>
              </div>
              <ActionForm action={addSchool} submitLabel="Add school & assign student" buttonClass="btn sm">
                <SchoolFields name={r.name} type={r.type} requestId={r.id} city={r.cityName ?? ""} />
              </ActionForm>
            </div>
          ))}
        </div>
      )}
      <div className="acols">
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>School</th><th>Type</th><th>City</th><th>State</th><th>Active</th></tr></thead>
            <tbody>
              {list.map(({ s, city, state }) => (
                <tr key={s.id}>
                  <td>{s.name}</td><td>{TYPE[s.type]}</td><td>{city}</td><td>{state}</td>
                  <td><form action={toggleSchool}><input type="hidden" name="id" value={s.id} /><button className={`toggle${s.active ? " on" : ""}`} type="submit" aria-pressed={s.active} aria-label={`${s.name} active`} /></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <span className="eyebrow">+ Add school</span>
          <ActionForm action={addSchool} submitLabel="Add school" buttonClass="btn sm"><SchoolFields /></ActionForm>
        </div>
      </div>
    </>
  );
}
