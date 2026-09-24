import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schools, cities, counties, cityCounties } from "@/db";
import { requireStudent } from "@/lib/student";
import { TopBar } from "@/components/TopBar";
import { Steps } from "@/components/Steps";
import { ActionForm } from "@/components/ActionForm";
import { SchoolPicker } from "@/components/SchoolPicker";
import { GradYears } from "@/components/GradYears";
import { saveSchool, requestSchool } from "@/app/verify-actions";

export const metadata = { title: "Your school" };

export default async function VerifySchool() {
  const { profile } = await requireStudent();
  if (profile.verificationStatus === "verified") redirect("/home");
  const [rows, countyList, cityList, links] = await Promise.all([
    db
      .select({ id: schools.id, name: schools.name, type: schools.type, city: cities.name, cityId: schools.cityId })
      .from(schools)
      .innerJoin(cities, eq(cities.id, schools.cityId))
      .where(eq(schools.active, true))
      .orderBy(asc(schools.name)),
    db.select({ id: counties.id, name: counties.name }).from(counties).orderBy(asc(counties.name)),
    db.select({ id: cities.id, name: cities.name }).from(cities).where(eq(cities.active, true)).orderBy(asc(cities.name)),
    db.select().from(cityCounties),
  ]);
  return (
    <div className="scr light">
      <TopBar />
      <div className="body">
        <Steps at={2} />
        <h1 className="disp h1">Where do you go to school?</h1>
        <p className="muted small p">Nearest is only for verified students in participating areas.</p>
        <ActionForm action={saveSchool} submitLabel="Continue">
          <SchoolPicker schools={rows} counties={countyList} cities={cityList} links={links} initialId={profile.schoolId} />
          <GradYears value={profile.graduationYear} />
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
            <GradYears value={profile.graduationYear} />
          </ActionForm>
        </details>
      </div>
    </div>
  );
}
