import { ActionForm } from "@/components/ActionForm";
import { ProCampaignFields } from "@/components/ProCampaignFields";
import { needsCampaignChoice, proOffer, rewardEligibleServices, type ProProfile } from "@/lib/campaign-pro";
import { declineCampaign, optInCampaign } from "@/app/pro/campaign-actions";

/**
 * Pro home screen — the professional's one free service (given once, ever, to a student with a Nearest Free Card).
 *  • Pros who joined before they were asked: Opt in or Decline (stays until they answer).
 *  • Agreed pros: their free service, whether it's been given yet, and a way to change the service until it is.
 */
export async function ProCampaignCard({ profile }: { profile: ProProfile }) {
  const earlier = needsCampaignChoice(profile);
  if (!earlier && profile.campaignChoice !== "agreed") return null;
  const [services, offer] = await Promise.all([rewardEligibleServices(profile.userId), proOffer(profile.userId)]);

  if (earlier) {
    return (
      <div className="card warn" style={{ gap: 10 }}>
        <span className="eyebrow">New — your one free service</span>
        <span className="small">Nearest is handing out Nearest Free Cards to students. Choose one service to give free one time to a student who brings one. It&apos;s a new client brought to you by Nearest, and you still accept or decline the request.</span>
        <ActionForm action={optInCampaign} submitLabel="Opt in" buttonClass="btn sm">
          <ProCampaignFields services={services} />
        </ActionForm>
        <form action={declineCampaign}><button className="btn ghost sm" type="submit" style={{ width: "100%" }}>Decline</button></form>
        <span className="xs muted">Declining doesn&apos;t affect your normal bookings.</span>
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
