import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, proServices } from "@/db";
import { requirePro } from "@/lib/pro";
import { chicagoNow, money } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { createModelCall } from "@/app/pro/actions";

export const metadata = { title: "Create a model call" };

const REQS = ["Photos / video required", "Natural hair only", "Natural lashes only", "No previous extensions", "Must be available for follow-up"];

export default async function NewModelCall() {
  const { user, profile } = await requirePro();
  const services = await db.select().from(proServices).where(eq(proServices.userId, user.id)).orderBy(asc(proServices.sort));
  const today = chicagoNow().date;
  if (profile.reviewStatus !== "approved" || services.length === 0) {
    return (
      <div className="scr">
        <TopBar title="Create a Model Call" back="/pro/model-calls" />
        <div className="body">
          <div className="card warn small"><span>{services.length === 0 ? "Add your services first." : "You can publish model calls once your profile is approved."}</span></div>
          <Link className="btn ghost" href={services.length === 0 ? "/pro/setup/services" : "/pro/home"}>{services.length === 0 ? "Add services" : "Back to dashboard"}</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="scr">
      <TopBar title="Create a Model Call" back="/pro/model-calls" />
      <div className="body">
        <ActionForm action={createModelCall} submitLabel="Publish model call">
          <div className="field"><label htmlFor="serviceId">Service</label>
            <select id="serviceId" name="serviceId" required defaultValue="">
              <option value="" disabled>Choose a service</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} (regular {money(s.priceCents)})</option>)}
            </select>
          </div>
          <div className="grid2">
            <div className="field"><label htmlFor="day">Date</label><input id="day" name="day" type="date" min={today} required /></div>
            <div className="field"><label htmlFor="time">Time</label><input id="time" name="time" type="time" required /></div>
          </div>
          <div className="grid2">
            <div className="field"><label htmlFor="price">Model price ($)</label><input id="price" name="price" inputMode="decimal" placeholder="15" required /></div>
            <div className="field"><label htmlFor="spots">Spots</label><input id="spots" name="spots" inputMode="numeric" defaultValue="1" required /></div>
          </div>
          <div className="field"><label htmlFor="duration">Approx. length (minutes, optional)</label><input id="duration" name="duration" inputMode="numeric" placeholder="Uses the service length if blank" /></div>
          <span className="lbl">Requirements</span>
          {REQS.map((r) => <label key={r} className="check"><input type="checkbox" name="requirements" value={r} />{r}</label>)}
          <div className="field"><label htmlFor="otherRequirement">Other requirement (optional)</label><input id="otherRequirement" name="otherRequirement" /></div>
          <div className="field"><label htmlFor="about">About this model call</label><textarea id="about" name="about" placeholder="What you're practicing and what the model should know." /></div>
          <div className="card small"><div className="row"><Icon name="eye" size="s" /><span className="grow">Shows under <span className="b">Model Calls near me</span> for students nearby.</span></div></div>
        </ActionForm>
      </div>
    </div>
  );
}
