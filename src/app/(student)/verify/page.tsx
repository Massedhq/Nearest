import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schools, cities } from "@/db";
import { requireStudent } from "@/lib/student";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { saveSchool, requestSchool } from "@/app/verify-actions";

export const metadata = { title: "Your school" };

const TYPE: Record<string, string> = { high_school: "High schools", college: "Colleges", trade: "Trade schools" };

export default async function VerifySchool() {
  const { profile } = await requireStudent();
  if (profile.verificationStatus === "verified") redirect("/home");
  const rows = await db
    .select({ id: schools.id, name: schools.name, type: schools.type, city: cities.name })
    .from(schools)
    .innerJoin(cities, eq(cities.id, schools.cityId))
    .where(eq(schools.active, true))
    .orderBy(asc(cities.name), asc(schools.name));
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = `${r.city} — ${TYPE[r.type]}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const year = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => year + i);
  const yearSelect = (id: string) => (
    <div className="field"><label htmlFor={id}>Expected graduation year</label>
      <select id={id} name="graduationYear" defaultValue={profile.graduationYear ?? ""} required>
        <option value="" disabled>Choose</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
  return (
    <div className="scr">
      <TopBar title="Get Verified" />
      <div className="body">
        <div className="steps" aria-label="Step 1 of 2"><span className="on" /><span /></div>
        <h1 className="disp h1">Where do you go to school?</h1>
        <p className="muted small p">Nearest is only for verified students in participating areas.</p>
        <ActionForm action={saveSchool} submitLabel="Continue">
          <div className="field"><label htmlFor="schoolId">School</label>
            <select id="schoolId" name="schoolId" defaultValue={profile.schoolId ?? ""} required>
              <option value="" disabled>Choose your school</option>
              {[...groups.entries()].map(([g, list]) => (
                <optgroup key={g} label={g}>{list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
              ))}
            </select>
          </div>
          {yearSelect("graduationYear")}
        </ActionForm>
        <details className="card">
          <summary className="b" style={{ cursor: "pointer" }}>Can&apos;t find my school?</summary>
          <p className="small muted p" style={{ marginTop: 10 }}>Tell us your school. You can keep going, and we&apos;ll add it while we review your ID.</p>
          <ActionForm action={requestSchool} submitLabel="Request my school & continue" buttonClass="btn ghost">
            <div className="field"><label htmlFor="rname">School name</label><input id="rname" name="name" required /></div>
            <div className="grid2">
              <div className="field"><label htmlFor="rcity">City</label><input id="rcity" name="city" required /></div>
              <div className="field"><label htmlFor="rtype">Type</label>
                <select id="rtype" name="type" defaultValue="high_school"><option value="high_school">High school</option><option value="college">College</option><option value="trade">Trade school</option></select>
              </div>
            </div>
            {yearSelect("rgrad")}
          </ActionForm>
        </details>
      </div>
    </div>
  );
}
