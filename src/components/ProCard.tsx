import Image from "next/image";
import { Icon } from "./Icon";
import { money } from "@/lib/time";
import { personName } from "@/lib/pro-name";

const ASL_LABEL: Record<string, string> = { basic: "Basic", conversational: "Conversational", fluent: "Fluent" };

/** The card students will see in search (Phase 3), used here as the pro's preview. */
export function ProCard({ p, services, photos, city, first: firstName, last: lastName }: {
  p: { businessName: string | null; photoUrl: string | null; aslLevel: string; serviceMode: string | null; travelRadiusMi: number | null; favCount?: number; displayName?: string | null; logoUrl?: string | null };
  first?: string | null; last?: string | null;
  services: { name: string; priceCents: number }[];
  photos: string[];
  city: string | null;
}) {
  const first = services[0];
  const who = personName(p.displayName, firstName, lastName);
  const initials = who.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="card" style={{ borderColor: "#ECE8E1" }}>
      <div className="row top-a">
        {p.photoUrl ? <Image src={p.photoUrl} alt="" width={52} height={52} style={{ borderRadius: 26, objectFit: "cover" }} /> : <div className="avatar">{initials}</div>}
        <div className="col g4 grow">
          <div className="row between">
            <span className="col" style={{ gap: 2 }}>
              <span className="h3">{who}</span>
              {p.businessName && p.businessName !== who && <span className="row small muted" style={{ gap: 6 }}>{p.logoUrl && <Image src={p.logoUrl} alt="" width={18} height={18} style={{ borderRadius: 4, objectFit: "cover" }} />}{p.businessName}</span>}
            </span>
            {/* Same heart students see (preview only — tapping it here does nothing) */}
            <span className="row" style={{ gap: 6 }} title="Students tap the heart to save you to their favorites">
              <span className="iconbtn" aria-hidden="true" style={{ width: 36, height: 36 }}>
                <svg className="i s" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" /></svg>
              </span>
              <span className="small b" aria-label={`Saved by ${p.favCount ?? 0} students`}>{(p.favCount ?? 0).toLocaleString()}</span>
            </span>
            <span className="iconbtn" aria-hidden="true" title="Students can share you with their connections" style={{ width: 36, height: 36 }}>
              <svg className="i s" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
            </span>
          </div>
          <span className="badge"><Icon name="shield" size="s" /> Approved by Nearest</span>
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
