import Link from "next/link";
import type { prospectDrafts } from "@/db";
import type { DraftFields } from "@/lib/screenshot-leads";

type Draft = typeof prospectDrafts.$inferSelect;

/**
 * Build a profile: the screenshots collected for this professional (Add from screenshots) and the details read from
 * them — kept beside the form so services, prices, hours and location can be copied into their setup pages.
 */
export function BuildScreenshots({ draft }: { draft: Draft }) {
  const images = draft.images as unknown[];
  const f = draft.fields as Partial<DraftFields>;
  const rows: [string, string | undefined][] = [
    ["Business", f.business], ["Other services", f.otherServices], ["Credentials (as shown)", f.credentials],
    ["Address", f.address && f.city && f.address.toLowerCase().includes(f.city.toLowerCase()) ? f.address : [f.address, f.city, f.state, f.zip].filter(Boolean).join(", ")], ["Instagram", f.instagram ? `@${f.instagram}` : ""],
    ["Facebook", f.facebook], ["Website", f.website], ["Booking link", f.bookingLink], ["Hours", f.hours], ["Prices (as listed)", f.prices], ["Deposit", f.deposit], ["Notes", f.notes],
  ];
  return (
    <div className="card" style={{ gap: 10, maxWidth: 720 }}>
      <div className="row between"><span className="eyebrow">Their screenshots</span><Link className="link xs" href={`/admin/outreach/screenshots/${draft.id}`}>Open the screenshot record</Link></div>
      {images.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
          {images.map((_, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <a key={i} href={`/api/admin/lead-screenshots/${draft.id}/${i}`} target="_blank" rel="noreferrer"><img src={`/api/admin/lead-screenshots/${draft.id}/${i}`} alt={`Screenshot ${i + 1}`} style={{ width: "100%", height: 150, objectFit: "cover", objectPosition: "top", borderRadius: 10, border: "1px solid #2A2A2D" }} /></a>
          ))}
        </div>
      ) : <span className="small muted">No screenshots kept.</span>}
      {rows.filter(([, v]) => v).map(([k, v]) => <div key={k} className="row between small" style={{ gap: 12, alignItems: "flex-start" }}><span className="muted" style={{ flexShrink: 0 }}>{k}</span><span style={{ textAlign: "right", whiteSpace: "pre-wrap" }}>{v}</span></div>)}
      <span className="xs muted">Read from the screenshots — use them to fill in their services, prices, hours and location. Tap a screenshot to open it full size.</span>
    </div>
  );
}
