import { eq } from "drizzle-orm";
import { db, proHours } from "@/db";
import { requirePro, setupSteps } from "@/lib/pro";
import { SetupShell } from "@/components/SetupShell";
import { ActionForm } from "@/components/ActionForm";
import { WEEKDAYS } from "@/lib/time";
import { saveHours } from "@/app/pro/actions";

export const metadata = { title: "Hours" };

type H = { kind: string; weekday: number; startTime: string; endTime: string };

function DayRows({ kind, rows, defaults }: { kind: "regular" | "after_school"; rows: H[]; defaults: [string, string] }) {
  return (
    <>
      {[1, 2, 3, 4, 5, 6, 0].map((d) => {
        const r = rows.find((x) => x.kind === kind && x.weekday === d);
        const weekend = d === 0 || d === 6;
        if (kind === "after_school" && weekend) return null;
        return (
          <div key={d} className="row" style={{ padding: "4px 0" }}>
            <label className="row grow small" style={{ gap: 8 }}>
              <input type="checkbox" name={`${kind}_${d}_on`} defaultChecked={!!r} style={{ width: 20, height: 20, accentColor: "#ECE8E1" }} />
              {WEEKDAYS[d].slice(0, 3)}
            </label>
            <input className="ainput" type="time" name={`${kind}_${d}_start`} aria-label={`${WEEKDAYS[d]} start`} defaultValue={r?.startTime ?? defaults[0]} style={{ width: 118 }} />
            <span className="muted xs">to</span>
            <input className="ainput" type="time" name={`${kind}_${d}_end`} aria-label={`${WEEKDAYS[d]} end`} defaultValue={r?.endTime ?? defaults[1]} style={{ width: 118 }} />
          </div>
        );
      })}
    </>
  );
}

export default async function HoursStep({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { user } = await requirePro();
  const edit = (await searchParams).edit === "1";
  const [steps, rows] = await Promise.all([setupSteps(user.id), db.select().from(proHours).where(eq(proHours.userId, user.id))]);
  return (
    <SetupShell steps={steps} current="hours" title="When can customers book you?" edit={edit}>
      <ActionForm action={saveHours} submitLabel={edit ? "Save hours" : "Save & continue"}>
        {edit && <input type="hidden" name="edit" value="1" />}
        <div className="card"><span className="eyebrow">Regular hours</span><DayRows kind="regular" rows={rows} defaults={["09:00", "17:00"]} /></div>
        <div className="card">
          <span className="eyebrow">After-school appointments (optional)</span>
          <span className="xs muted">Check the weekdays you&apos;ll take students after school.</span>
          <DayRows kind="after_school" rows={rows} defaults={["15:30", "19:00"]} />
        </div>
        <p className="xs muted p">Have openings on a given day? Post them from Available Today on your dashboard. Same-day booking closes at 12:00 PM.</p>
      </ActionForm>
    </SetupShell>
  );
}
