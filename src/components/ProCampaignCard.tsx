import { ActionForm } from "@/components/ActionForm";
import { ProCampaignFields } from "@/components/ProCampaignFields";
import { needsCampaignChoice, proOffer, rewardEligibleServices, type ProProfile } from "@/lib/campaign-pro";
import { declineCampaign, optInCampaign, toggleCampaignOffer } from "@/app/pro/campaign-actions";

/**
 * Pro home screen — Nearest launch campaign.
 *  • Pros who joined before the free-service checkbox existed: Opt in or Decline (stays until they answer).
 *  • Agreed pros: their free service and appointments left, with change / pause.
 */
export async function ProCampaignCard({ profile }: { profile: ProProfile }) {
  const { getCampaign } = await import("@/lib/campaign");
  const c = await getCampaign();
  const earlier = needsCampaignChoice(profile) && c.status !== "closed";
  if (!earlier && profile.campaignChoice !== "agreed") return null;
  const [services, offer] = await Promise.all([rewardEligibleServices(profile.userId), proOffer(profile.userId)]);

  if (earlier) {
    return (
      <div className="card warn" style={{ gap: 10 }}>
        <span className="eyebrow">New — Nearest launch campaign</span>
        <span className="small">Students who complete Nearest&apos;s seven-day launch promotion earn one free service once booking opens. Would you like to be one of the professionals they can book it with? It&apos;s free exposure to new clients, you choose the service and how many free appointments you give, and you still accept or decline each request.</span>
        <ActionForm action={optInCampaign} submitLabel="Opt in" buttonClass="btn sm">
          <ProCampaignFields services={services} />
        </ActionForm>
        <form action={declineCampaign}><button className="btn ghost sm" type="submit" style={{ width: "100%" }}>Decline</button></form>
        <span className="xs muted">Declining doesn&apos;t affect your normal bookings.</span>
      </div>
    );
  }

  const left = offer ? Math.max(0, offer.slotsTotal - offer.slotsUsed) : 0;
  const current = offer ? services.find((s) => s.id === offer.serviceId) : null;
  return (
    <div className="card" style={{ gap: 8 }}>
      <span className="eyebrow">Nearest launch campaign</span>
      {offer && current
        ? <span className="small">Your free service: <span className="b">{current.name}</span> • {left} of {offer.slotsTotal} free appointment{offer.slotsTotal === 1 ? "" : "s"} left{offer.active ? "" : " • paused"}</span>
        : <span className="small b">Choose your free service so approved campaign students can find you.</span>}
      <details open={!offer || !current}>
        <summary className="link xs">{offer && current ? "Change service or number of free appointments" : "Choose now"}</summary>
        <ActionForm action={optInCampaign} submitLabel="Save" buttonClass="btn sm">
          <ProCampaignFields services={services} serviceId={current?.id ?? null} slots={offer?.slotsTotal} showAgree={false} />
        </ActionForm>
      </details>
      {offer && current && (
        <form action={toggleCampaignOffer}><button className="link xs" type="submit">{offer.active ? "Pause my free appointments" : "Resume my free appointments"}</button></form>
      )}
    </div>
  );
}
