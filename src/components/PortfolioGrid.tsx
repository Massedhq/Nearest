import Image from "next/image";
import { Icon } from "./Icon";
import { PhotoServiceSelect } from "./PhotoServiceSelect";
import { removePortfolio, toggleFeatured } from "@/app/pro/actions";

type Item = { id: string; url: string; featured: boolean; source: string; serviceId?: string | null };

export function PortfolioGrid({ items, services = [] }: { items: Item[]; services?: { id: string; name: string }[] }) {
  if (!items.length) return <p className="small muted p">No work added yet.</p>;
  return (
    <div className="grid3">
      {items.map((it) => (
        <div key={it.id} className="col" style={{ gap: 6 }}>
          <div className="ph" style={{ height: 120, padding: 0 }}>
            <Image src={it.url} alt="Portfolio work" fill sizes="140px" style={{ objectFit: "cover" }} />
            <div className="row between" style={{ position: "absolute", left: 6, right: 6, top: 6 }}>
              <form action={toggleFeatured}><input type="hidden" name="id" value={it.id} />
                <button className="iconbtn" type="submit" aria-label={it.featured ? "Unfeature" : "Feature"} style={{ width: 30, height: 30, color: it.featured ? "#E3C58A" : "#ECE8E1" }}><Icon name="star" size="s" /></button>
              </form>
              <form action={removePortfolio}><input type="hidden" name="id" value={it.id} />
                <button className="iconbtn" type="submit" aria-label="Remove" style={{ width: 30, height: 30 }}><Icon name="trash" size="s" /></button>
              </form>
            </div>
          </div>
          {services.length > 0 && <PhotoServiceSelect id={it.id} value={it.serviceId ?? null} services={services} />}
        </div>
      ))}
    </div>
  );
}
