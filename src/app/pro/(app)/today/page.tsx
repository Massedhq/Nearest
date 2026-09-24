import { and, eq } from "drizzle-orm";
import { db, proOpenings } from "@/db";
import { requirePro } from "@/lib/pro";
import { getSettings } from "@/lib/settings";
import { chicagoNow, label12, toMinutes } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { saveOpenings } from "@/app/pro/actions";

export const metadata = { title: "Available Today" };

const SLOTS = Array.from({ length: 27 }, (_, i) => {
  const m = 7 * 60 + i * 30; // 7:00 AM – 8:00 PM every 30 minutes
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

export default async function Today() {
  const { user, profile } = await requirePro();
  const s = await getSettings();
  const now = chicagoNow();
  const cutoffStr = String(s["booking.same_day_cutoff"]);
  const notice = Number(s["booking.same_day_min_notice_hours"]);
  const closed = now.minutes >= toMinutes(cutoffStr);
  const minStart = now.minutes + notice * 60;
  const mine = new Set((await db.select().from(proOpenings).where(and(eq(proOpenings.userId, user.id), eq(proOpenings.day, now.date)))).map((o) => o.startTime));
  const approved = profile.reviewStatus === "approved";

  return (
    <div className="scr">
      <TopBar title="Available Today" back="/pro/home" />
      <div className="body">
        {!approved && <div className="card warn small"><span>Openings go live after your profile is approved.</span></div>}
        {profile.vacationMode && <div className="card warn small"><span>You&apos;re in vacation mode. Turn it off in Calendar to post openings.</span></div>}
        {closed ? (
          <div className="card bad"><div className="row top-a"><Icon name="clock" /><span className="grow"><span className="b">Same-day booking is closed.</span> It closes at {label12(cutoffStr)} each day. Post again tomorrow morning.</span></div></div>
        ) : (
          <>
            <div className="card small"><span className="muted">Same-day booking closes at <span className="b" style={{ color: "#ECE8E1" }}>{label12(cutoffStr)}</span>, and openings must start at least {notice} hours from now.</span></div>
            <ActionForm action={saveOpenings} submitLabel="Publish openings">
              <div className="grid3">
                {SLOTS.map((t) => {
                  const tooSoon = toMinutes(t) < minStart;
                  return (
                    <label key={t} className={`slot${tooSoon ? " off" : ""}`} style={{ gap: 6, cursor: tooSoon ? "not-allowed" : "pointer" }}>
                      <input type="checkbox" name="slot" value={t} defaultChecked={mine.has(t) && !tooSoon} disabled={tooSoon || !approved} style={{ accentColor: "#ECE8E1" }} />
                      {label12(t).replace(":00", "")}
                    </label>
                  );
                })}
              </div>
              <p className="xs muted p">Uncheck every time and publish to clear today&apos;s openings.</p>
            </ActionForm>
          </>
        )}
      </div>
    </div>
  );
}
