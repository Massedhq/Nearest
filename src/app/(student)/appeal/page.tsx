import { desc, eq } from "drizzle-orm";
import { db, appeals } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { studentSuspendedUntil, SUSPENSION_TEXT } from "@/lib/enforcement";
import { fmtDate } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { submitAppeal } from "@/app/appeal-actions";

export const metadata = { title: "Request review" };

export default async function Appeal() {
  const { user, profile } = await requireVerifiedStudent();
  const until = studentSuspendedUntil(profile);
  const mine = await db.select().from(appeals).where(eq(appeals.userId, user.id)).orderBy(desc(appeals.createdAt)).limit(5);
  return (
    <div className="scr">
      <TopBar title="Request review" back="/home" />
      <div className="body">
        {until ? (
          <>
            <div className="card"><span className="eyebrow">Action</span><span className="b">Booking suspension</span><span className="small muted">{SUSPENSION_TEXT[profile.suspensionReason ?? "admin"]} Ends {fmtDate(until, { month: "long", day: "numeric", year: "numeric" })}.</span></div>
            <ActionForm action={submitAppeal} submitLabel="Submit for review">
              <input type="hidden" name="kind" value="student_suspension" />
              <div className="field"><label htmlFor="ex">Why should we review this?</label><textarea id="ex" name="explanation" placeholder="For example: my Sep 20 appointment was marked a no-show but I checked in at 3:58." /></div>
              <div className="card warn small"><div className="row top-a"><Icon name="clock" size="s" /><span className="grow">Reviews can take 30–90 days. The suspension stays in place while we review unless Nearest changes it.</span></div></div>
            </ActionForm>
          </>
        ) : (
          <div className="card ok"><span className="b">Your account is in good standing.</span></div>
        )}
        {mine.map((a) => <div key={a.id} className="item small"><span className="grow">Submitted {fmtDate(a.createdAt)}</span><span className={`tag ${a.status === "overturned" ? "ok" : a.status === "upheld" ? "bad" : "warn"}`}>{a.status.replace("_", " ")}</span></div>)}
      </div>
    </div>
  );
}
