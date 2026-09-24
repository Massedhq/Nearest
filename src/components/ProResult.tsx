import Image from "next/image";
import Link from "next/link";
import { Icon } from "./Icon";
import { label12, money } from "@/lib/time";

const ASL: Record<string, string> = { basic: "Basic", conversational: "Conversational", fluent: "Fluent" };

type P = {
  userId: string; businessName: string | null; photoUrl: string | null; aslLevel: string; city: string | null;
  minPrice: number | null; firstService: string | null; openings: string[] | null; photos: string[];
};

export function ProResult({ p }: { p: P }) {
  const initials = (p.businessName ?? "N").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="card">
      <div className="row top-a">
        {p.photoUrl ? <Image src={p.photoUrl} alt="" width={52} height={52} style={{ borderRadius: 26, objectFit: "cover" }} /> : <div className="avatar">{initials}</div>}
        <div className="col g4 grow">
          <span className="h3">{p.businessName}</span>
          <div className="row" style={{ flexWrap: "wrap", gap: "4px 12px" }}>
            <span className="badge"><Icon name="shield" size="s" /> Approved by Nearest</span>
            {p.aslLevel !== "none" && <span className="badge pearl"><Icon name="hand" size="s" /> ASL — {ASL[p.aslLevel]}</span>}
          </div>
          <div className="row small" style={{ gap: 12 }}>
            <span className="badge gold"><Icon name="star" size="s" /> New Professional</span>
            <span className="muted row" style={{ gap: 4 }}><Icon name="pin" size="s" /> {p.city}</span>
          </div>
        </div>
      </div>
      {p.photos.length > 0 && (
        <div className="grid3">
          {p.photos.map((u) => <div key={u} className="ph" style={{ height: 88, padding: 0 }}><Image src={u} alt="" fill sizes="120px" style={{ objectFit: "cover" }} /></div>)}
        </div>
      )}
      {p.firstService && <div className="row between"><span className="small">{p.firstService}</span><span className="b">from {money(p.minPrice ?? 0)}</span></div>}
      {p.openings?.length ? (
        <div className="row small" style={{ flexWrap: "wrap" }}><span className="tag warn"><Icon name="bolt" size="s" /> Available today</span><span className="muted">{p.openings.map(label12).join(" • ")}</span></div>
      ) : null}
      <Link className="btn ghost sm" href={`/p/${p.userId}`} style={{ width: "100%" }}>View profile</Link>
    </div>
  );
}
