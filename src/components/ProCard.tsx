import Image from "next/image";
import { Icon } from "./Icon";
import { money } from "@/lib/time";

const ASL_LABEL: Record<string, string> = { basic: "Basic", conversational: "Conversational", fluent: "Fluent" };

/** The card students will see in search (Phase 3), used here as the pro's preview. */
export function ProCard({ p, services, photos, city }: {
  p: { businessName: string | null; photoUrl: string | null; aslLevel: string; serviceMode: string | null; travelRadiusMi: number | null };
  services: { name: string; priceCents: number }[];
  photos: string[];
  city: string | null;
}) {
  const first = services[0];
  const initials = (p.businessName ?? "N").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="card" style={{ borderColor: "#ECE8E1" }}>
      <div className="row top-a">
        {p.photoUrl ? <Image src={p.photoUrl} alt="" width={52} height={52} style={{ borderRadius: 26, objectFit: "cover" }} /> : <div className="avatar">{initials}</div>}
        <div className="col g4 grow">
          <span className="h3">{p.businessName ?? "Your business name"}</span>
          <span className="badge"><Icon name="shield" size="s" /> Identity Verified</span>
          {p.aslLevel !== "none" && <span className="badge pearl"><Icon name="hand" size="s" /> ASL — {ASL_LABEL[p.aslLevel]}</span>}
          <div className="row small" style={{ gap: 12 }}>
            <span className="muted row" style={{ gap: 4 }}><Icon name="pin" size="s" /> {city ?? "Your city"}</span>
            <span className="badge gold"><Icon name="star" size="s" /> New Professional</span>
          </div>
        </div>
      </div>
      <div className="grid3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="ph" style={{ height: 78, padding: 0 }}>
            {photos[i] && <Image src={photos[i]} alt="" fill sizes="110px" style={{ objectFit: "cover" }} />}
          </div>
        ))}
      </div>
      {first && <div className="row between"><span className="small">{first.name}</span><span className="b">{money(first.priceCents)}</span></div>}
    </div>
  );
}
