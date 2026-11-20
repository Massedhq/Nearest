import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, proServices } from "@/db";
import { requirePro } from "@/lib/pro";
import { chicagoNow, money } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { ModelCallWhen } from "@/components/ModelCallWhen";
import { ModelCallDetails } from "@/components/ModelCallDetails";
import { createModelCall } from "@/app/pro/actions";

export const metadata = { title: "Create a model call" };

export default async function NewModelCall() {
  const { user, profile } = await requirePro({ assistant: true });
  const services = await db.select().from(proServices).where(eq(proServices.userId, user.id)).orderBy(asc(proServices.sort));
  const today = chicagoNow().date;
  const maxDay = new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10);
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
          <ModelCallWhen today={today} maxDay={maxDay} />
          <div className="field"><label htmlFor="duration">Approx. length (minutes, optional)</label><input id="duration" name="duration" inputMode="numeric" placeholder="Uses the service length if blank" /></div>
          <ModelCallDetails userId={user.id} />
        </ActionForm>
      </div>
    </div>
  );
}
