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
  // Latest transfer request (moving to a city that's full in their category).
  const { db, proTransfers, cities } = await import("@/db");
  const { desc, eq } = await import("drizzle-orm");
  const t = await db.query.proTransfers.findFirst({ where: eq(proTransfers.userId, user.id), orderBy: desc(proTransfers.createdAt) });
  const cityName = async (id: number | null) => (id ? (await db.query.cities.findFirst({ where: eq(cities.id, id) }))?.name ?? "your city" : "your city");
  const transfer = t && t.status !== "cancelled" && (t.status === "pending" || Date.now() - (t.decidedAt?.getTime() ?? 0) < 14 * 86400000)
    ? { status: t.status, decisionNote: t.decisionNote, to: await cityName(t.toCityId), from: await cityName(t.fromCityId) } : null;
  return (
    <SetupShell steps={steps} current="location" title="Where are you based?" edit={edit}>
      {transfer && (
        <div className={`card ${transfer.status === "denied" ? "bad" : transfer.status === "approved" ? "ok" : "warn"} small`} style={{ gap: 2 }}>
          {transfer.status === "pending" && <><span className="b">Transfer to {transfer.to} — waiting for Nearest</span><span>You stay listed in {transfer.from} until it&apos;s approved. We&apos;ll let you know.</span></>}
          {transfer.status === "approved" && <><span className="b">Transfer approved</span><span>You&apos;re now listed in {transfer.to}.</span></>}
          {transfer.status === "denied" && <><span className="b">Transfer to {transfer.to} wasn&apos;t approved</span><span>{transfer.decisionNote ?? "Contact support@usenearest.com with questions."}</span></>}
        </div>
      )}
      <ActionForm action={saveLocation} submitLabel={edit ? "Save" : "Save & continue"} laterLabel={edit ? undefined : "Save & finish later"}>
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
        {edit && p.cityId && (
          <div className="field">
            <label htmlFor="transferNote">Moving to a different city? (optional)</label>
            <textarea id="transferNote" name="transferNote" maxLength={300} rows={2} placeholder="e.g. I moved to Arlington and work from home now" />
            <span className="xs muted">If your new city is full in your category, saving sends Nearest a transfer request with this note. You stay listed where you are until it&apos;s approved.</span>
          </div>
        )}
      </ActionForm>
    </SetupShell>
  );
}
