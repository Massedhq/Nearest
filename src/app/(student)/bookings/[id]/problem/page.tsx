import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, bookings } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { REASONS } from "@/lib/appointment";
import { TopBar } from "@/components/TopBar";
import { LocateForm } from "@/components/LocateButton";
import { Icon } from "@/components/Icon";
import { studentReport } from "@/app/day-actions";

export const metadata = { title: "Report a problem" };

export default async function Problem({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireVerifiedStudent();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, id), eq(bookings.studentId, user.id)) });
  if (!b) notFound();
  return (
    <div className="scr">
      <TopBar title="Report a problem" back={`/bookings/${id}`} />
      <div className="body">
        <p className="muted p small">On-site complaints are reviewed by Nearest. A complaint doesn&apos;t automatically mean the professional is at fault.</p>
        <LocateForm action={studentReport} label="Submit complaint">
          <input type="hidden" name="id" value={id} />
          <fieldset className="col" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
            <legend className="lbl" style={{ marginBottom: 8 }}>What happened?</legend>
            {REASONS.map((r, i) => <label key={r} className="check"><input type="radio" name="reason" value={r} required defaultChecked={i === 0} />{r}</label>)}
          </fieldset>
          <div className="field"><label htmlFor="details">Details</label><textarea id="details" name="details" maxLength={1000} placeholder="For example: arrived at 5:26 and checked in. No one answered the door by 5:45." /></div>
          <div className="card small"><div className="row top-a"><Icon name="pin" size="s" /><span className="grow">We re-check your location when you submit. You must still be at the appointment location.</span></div></div>
        </LocateForm>
      </div>
    </div>
  );
}
