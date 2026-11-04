import { PRO_CAMPAIGN_AGREEMENT } from "@/lib/campaign-pro";

const field = { height: 40, borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px", width: "100%" } as const;
const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

/**
 * The professional's one free service: agreement checkbox (unless already agreed) and the service they give free one
 * time to a student with a Nearest Free Card (one of their services listed at $25+). Used on the last setup page and on
 * the home-screen card for earlier pros.
 */
export function ProCampaignFields({ services, serviceId, showAgree = true, required = true }: {
  services: { id: string; name: string; priceCents: number; durationMin: number }[];
  serviceId?: string | null; slots?: number; showAgree?: boolean; required?: boolean;
}) {
  return (
    <div className="col" style={{ gap: 8 }}>
      {showAgree && (
        <label className="check xs" style={{ alignItems: "flex-start" }}>
          <input type="checkbox" name="campaignAgree" required={required} />
          <span>{PRO_CAMPAIGN_AGREEMENT}</span>
        </label>
      )}
      {services.length ? (
        <label className="xs muted">Your free service (listed at $25 or more)
          <select name="campaignServiceId" defaultValue={serviceId ?? ""} required={required} style={field}>
            <option value="" disabled>Choose a service…</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.durationMin} min (listed {money(s.priceCents)})</option>)}
          </select>
        </label>
      ) : (
        <span className="xs muted">You don&apos;t have a service listed at $25 or more yet. Add one in Services, then choose it from the free service card on your home screen.</span>
      )}
      <input type="hidden" name="campaignSlots" value="1" />
    </div>
  );
}
