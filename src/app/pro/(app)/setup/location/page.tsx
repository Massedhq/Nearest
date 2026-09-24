import { asc, eq } from "drizzle-orm";
import { db, cities } from "@/db";
import { requirePro, setupSteps } from "@/lib/pro";
import { SetupShell } from "@/components/SetupShell";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { saveLocation } from "@/app/pro/actions";

export const metadata = { title: "Location" };

export default async function LocationStep({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { user, profile: p } = await requirePro();
  const edit = (await searchParams).edit === "1";
  const [steps, cityList] = await Promise.all([
    setupSteps(user.id),
    db.select({ id: cities.id, name: cities.name }).from(cities).where(eq(cities.active, true)).orderBy(asc(cities.name)),
  ]);
  const mode = p.serviceMode ?? "both";
  return (
    <SetupShell steps={steps} current="location" title="Where are you based?" edit={edit}>
      <ActionForm action={saveLocation} submitLabel={edit ? "Save" : "Save & continue"}>
        {edit && <input type="hidden" name="edit" value="1" />}
        <div className="grid2">
          <div className="field"><label htmlFor="cityId">City</label>
            <select id="cityId" name="cityId" defaultValue={p.cityId ?? ""} required>
              <option value="" disabled>Choose city</option>
              {cityList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="zip">ZIP</label><input id="zip" name="zip" inputMode="numeric" maxLength={5} defaultValue={p.zip ?? ""} required /></div>
        </div>
        <fieldset className="col" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="lbl" style={{ marginBottom: 8 }}>How do you provide services?</legend>
          <label className="check"><input type="radio" name="mode" value="come_to_me" defaultChecked={mode === "come_to_me"} />Customers come to me</label>
          <label className="check"><input type="radio" name="mode" value="travel" defaultChecked={mode === "travel"} />I travel to customers</label>
          <label className="check"><input type="radio" name="mode" value="both" defaultChecked={mode === "both"} />Both</label>
        </fieldset>
        <div className="field"><label htmlFor="address">Service address (private)</label><input id="address" name="address" autoComplete="street-address" defaultValue={p.addressLine ?? ""} placeholder="Street address — needed if customers come to you" /></div>
        <div className="field"><label htmlFor="radius">How far will you travel?</label>
          <select id="radius" name="radius" defaultValue={String(p.travelRadiusMi ?? 10)}>
            {[5, 10, 15, 20, 30].map((r) => <option key={r} value={r}>{r} miles</option>)}
          </select>
        </div>
        <div className="card small"><div className="row"><Icon name="eye" size="s" /><span className="grow">Customers only ever see how far away you are, like <span className="b">2.8 miles away</span>. A booked customer sees your address at 12:00 AM on the appointment day.</span></div></div>
      </ActionForm>
    </SetupShell>
  );
}
