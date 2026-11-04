import { ActionForm } from "@/components/ActionForm";
import { ProCampaignFields } from "@/components/ProCampaignFields";
import { needsCampaignChoice, proOffer, rewardEligibleServices, type ProProfile } from "@/lib/campaign-pro";
import { optInCampaign } from "@/app/pro/campaign-actions";

/**
 * Pro home screen — the professional's one free service (given once, ever, to a student with a Nearest Free Card).
 *  • Pros who joined before it existed: required — agree and choose the service (no decline; stays until they do).
 *  • Agreed pros: their free service, whether it's been given yet, and a way to change the service until it is.
 */
export async function ProCampaignCard({ profile }: { profile: ProProfile }) {
  const earlier = needsCampaignChoice(profile);
  if (!earlier && profile.campaignChoice !== "agreed") return null;
  const [services, offer] = await Promise.all([rewardEligibleServices(profile.userId), proOffer(profile.userId)]);

  if (earlier) {
    return (
      <div className="card warn" style={{ gap: 10 }}>
        <span className="eyebrow">Required — your one free service</span>
        <span className="small">Every professional on Nearest gives one free service, one time, to a student who brings a Nearest Free Card. Choose the service you&apos;ll give. The student still pays the booking fee and deposit.</span>
        <ActionForm action={optInCampaign} submitLabel="Save my free service" buttonClass="btn sm">
          <ProCampaignFields services={services} />
        </ActionForm>
      </div>
    );
  }

  const { freeServiceGiven } = await import("@/lib/promo");
  const given = await freeServiceGiven(profile.userId);
  const current = offer ? services.find((s) => s.id === offer.serviceId) : null;
  return (
    <div className="card" style={{ gap: 8 }}>
      <span className="eyebrow">Your free service</span>
      {given
        ? <span className="small">You&apos;ve given your one free service. Thank you — that&apos;s done.</span>
        : offer && current
          ? <span className="small">Your free service: <span className="b">{current.name}</span> • waiting for a student with a Nearest Free Card</span>
          : <span className="small b">Choose your free service so students with a Nearest Free Card can book it.</span>}
      {!given && (
        <details open={!offer || !current}>
          <summary className="link xs">{offer && current ? "Change my free service" : "Choose now"}</summary>
          <ActionForm action={optInCampaign} submitLabel="Save" buttonClass="btn sm">
            <ProCampaignFields services={services} serviceId={current?.id ?? null} showAgree={false} />
          </ActionForm>
        </details>
      )}
    </div>
  );
}
