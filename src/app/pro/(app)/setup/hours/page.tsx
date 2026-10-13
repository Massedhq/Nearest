import { eq } from "drizzle-orm";
import { db, proHours } from "@/db";
import { requirePro, setupSteps } from "@/lib/pro";
import { SetupShell } from "@/components/SetupShell";
import { ActionForm } from "@/components/ActionForm";
import { WEEKDAYS } from "@/lib/time";
import { saveHours } from "@/app/pro/actions";
import { HoursChoice } from "@/components/HoursChoice";

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
          <div key={d} className="col" style={{ gap: 6, padding: "8px 0", borderTop: "1px solid #1C1C1F" }}>
            <label className="row small" style={{ gap: 10, cursor: "pointer" }}>
              <input type="checkbox" name={`${kind}_${d}_on`} defaultChecked={!!r} style={{ width: 22, height: 22, flex: "none", accentColor: "#ECE8E1" }} />
              <span className="b">{WEEKDAYS[d]}</span>
            </label>
            <div className="row" style={{ gap: 8 }}>
              <input className="ainput" type="time" name={`${kind}_${d}_start`} aria-label={`${WEEKDAYS[d]} start`} defaultValue={r?.startTime ?? defaults[0]} style={{ flex: 1, minWidth: 0, padding: "0 8px" }} />
              <span className="muted xs" style={{ flex: "none" }}>to</span>
              <input className="ainput" type="time" name={`${kind}_${d}_end`} aria-label={`${WEEKDAYS[d]} end`} defaultValue={r?.endTime ?? defaults[1]} style={{ flex: 1, minWidth: 0, padding: "0 8px" }} />
            </div>
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
  const hasRegular = rows.some((r) => r.kind === "regular"), hasAfter = rows.some((r) => r.kind === "after_school");
  return (
    <SetupShell steps={steps} current="hours" title="When can customers book you?" edit={edit}>
      <ActionForm action={saveHours} submitLabel={edit ? "Save hours" : "Save & continue"} laterLabel={edit ? undefined : "Save & finish later"}>
        {edit && <input type="hidden" name="edit" value="1" />}
        <HoursChoice
          initial={hasRegular && hasAfter ? "both" : hasAfter ? "after_school" : "regular"}
          regular={<DayRows kind="regular" rows={rows} defaults={["09:00", "17:00"]} />}
          afterSchool={<DayRows kind="after_school" rows={rows} defaults={["15:30", "19:00"]} />}
        />
        <p className="xs muted p">Have openings on a given day? Post them from Available Today on your dashboard. Same-day booking closes at 12:00 PM.</p>
      </ActionForm>
    </SetupShell>
  );
}
