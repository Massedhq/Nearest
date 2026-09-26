import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schools, cities, counties, cityCounties } from "@/db";
import { requireStudent } from "@/lib/student";
import { TopBar } from "@/components/TopBar";
import { Steps } from "@/components/Steps";
import { ActionForm } from "@/components/ActionForm";
import { SchoolPicker } from "@/components/SchoolPicker";
import { GradYears } from "@/components/GradYears";
import { saveSchool, requestSchool } from "@/app/verify-actions";

export const metadata = { title: "Your school" };

export default async function VerifySchool({ searchParams }: { searchParams: Promise<{ renew?: string }> }) {
  const { renew } = await searchParams;
  const { profile } = await requireStudent();
  if (profile.verificationStatus === "verified") redirect("/home");
  // Only the student's current school is loaded here; the picker loads places step by step.
  const initial = profile.schoolId
    ? (await db
        .select({ id: schools.id, name: schools.name, type: schools.type, cityId: cities.id, city: cities.name, state: cities.state, countyId: counties.id, county: counties.name })
        .from(schools)
        .innerJoin(cities, eq(cities.id, schools.cityId))
        .leftJoin(cityCounties, eq(cityCounties.cityId, cities.id))
        .leftJoin(counties, eq(counties.id, cityCounties.countyId))
        .where(eq(schools.id, profile.schoolId))
        .limit(1))[0] ?? null
    : null;
  return (
    <div className="scr">
      <TopBar />
      <div className="body">
        <Steps at={2} />
        {renew && <div className="card warn small"><span className="b">New school year — time to re-verify.</span><span className="muted">Confirm your school and take a new photo of your current school ID.</span></div>}
        <h1 className="disp h1">Where do you go to school?</h1>
        <p className="muted small p">Nearest is only for verified students in participating areas.</p>
        <ActionForm action={saveSchool} submitLabel="Continue">
          <SchoolPicker initial={initial} />
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
