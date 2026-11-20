import { ModelCallPhoto } from "@/components/ModelCallPhoto";
import { ModelCallPricing } from "@/components/ModelCallPricing";
import { isPartner } from "@/lib/partner-booking";
import { getSettings } from "@/lib/settings";
import { MAX_PRICE_DOLLARS } from "@/lib/pricing";
import { modelCalls } from "@/db";

export const MC_REQS = ["Photos / video required", "Natural hair only", "Natural lashes only", "No previous extensions", "Must be available for follow-up"];
const d$ = (c: number | null | undefined) => (c == null ? "" : String(c / 100));

/** The part of the Model Call form shared by Create and Edit: media, where it shows, prices, payment, spots, requirements, info. */
export async function ModelCallDetails({ userId, call }: { userId: string; call?: typeof modelCalls.$inferSelect }) {
  const [partner, s] = await Promise.all([isPartner(userId), getSettings()]);
  const fee = Math.max(0, Number(s["fees.service_fee_cents"] ?? 500));
  const reqs = call?.requirements ?? [];
  const other = reqs.filter((r) => !MC_REQS.includes(r)).join(", ");
  const photos = call ? (Array.isArray(call.photos) && call.photos.length ? call.photos : call.photoUrl ? [call.photoUrl] : []) : [];
  const studentPrice = call && call.showOn !== "partner" ? d$(call.proPriceCents ?? call.priceCents - call.serviceFeeCents) : "";
  return (
    <>
      <ModelCallPhoto userId={userId} photos={photos} video={call?.videoUrl ?? ""} />
      <ModelCallPricing partner={partner} fee={fee} cap={MAX_PRICE_DOLLARS} d={call ? { showOn: call.showOn, price: studentPrice, publicPrice: d$(call.publicProPriceCents), payMode: call.payMode, deposit: d$(call.depositProCents) } : {}} />
      <div className="field"><label htmlFor="spots">Spots</label><input id="spots" name="spots" inputMode="numeric" defaultValue={String(call?.spots ?? 1)} required /></div>
      <span className="lbl">Requirements</span>
      {MC_REQS.map((r) => <label key={r} className="check"><input type="checkbox" name="requirements" value={r} defaultChecked={reqs.includes(r)} />{r}</label>)}
      <div className="field"><label htmlFor="otherRequirement">Other requirement (optional)</label><input id="otherRequirement" name="otherRequirement" defaultValue={other} /></div>
      <div className="field"><label htmlFor="about">Additional information</label><textarea id="about" name="about" rows={5} defaultValue={call?.about ?? ""} placeholder="Anything models should know — what you're practicing, how long it takes, what to bring, parking, how to prep." /></div>
    </>
  );
}
