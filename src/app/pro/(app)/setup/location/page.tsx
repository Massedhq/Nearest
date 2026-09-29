import { requirePro, setupSteps } from "@/lib/pro";
import { SetupShell } from "@/components/SetupShell";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { saveLocation } from "@/app/pro/actions";
import { cityGroups } from "@/lib/city-groups";
import { ProAddressFields } from "@/components/ProAddressFields";

export const metadata = { title: "Location" };

export default async function LocationStep({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { user, profile: p } = await requirePro();
  const edit = (await searchParams).edit === "1";
  const [steps, cityList] = await Promise.all([
    setupSteps(user.id),
    cityGroups(),
  ]);
  const mode = p.serviceMode ?? "both";
  return (
    <SetupShell steps={steps} current="location" title="Where are you based?" edit={edit}>
      <ActionForm action={saveLocation} submitLabel={edit ? "Save" : "Save & continue"}>
        {edit && <input type="hidden" name="edit" value="1" />}
        <ProAddressFields groups={cityList} address={p.addressLine ?? ""} unit={p.addressUnit ?? ""} cityId={p.cityId} zip={p.zip ?? ""} />
        <span className="xs muted">Your street address stays private. Students only see how far away you are until they&apos;ve booked.</span>
        <fieldset className="col" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="lbl" style={{ marginBottom: 8 }}>How do you provide services?</legend>
          <label className="check"><input type="radio" name="mode" value="come_to_me" defaultChecked={mode === "come_to_me"} />Customers come to me</label>
          <label className="check"><input type="radio" name="mode" value="travel" defaultChecked={mode === "travel"} />I travel to customers</label>
          <label className="check"><input type="radio" name="mode" value="both" defaultChecked={mode === "both"} />Both</label>
        </fieldset>
        <div className="field"><label htmlFor="radius">How far will you travel?</label>
          <select id="radius" name="radius" defaultValue={String(p.travelRadiusMi ?? 10)}>
            {[5, 10, 15, 20, 30].map((r) => <option key={r} value={r}>{r} miles</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="travelFee">Travel fee when you go to the customer ($35–$55)</label>
          <input id="travelFee" name="travelFee" inputMode="decimal" defaultValue={String((p.travelFeeCents ?? 3500) / 100)} placeholder="35" />
          <span className="xs muted">A flat fee added to the price only when you travel to them. Skip this if customers always come to you.</span>
        </div>
        <div className="card small"><div className="row"><Icon name="eye" size="s" /><span className="grow">Customers only ever see how far away you are, like <span className="b">2.8 miles away</span>. A booked customer sees your address at 12:00 AM on the appointment day.</span></div></div>
      </ActionForm>
    </SetupShell>
  );
}
