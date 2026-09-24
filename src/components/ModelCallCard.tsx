import Link from "next/link";
import { Icon } from "./Icon";
import { fmtDate, fmtTime, money } from "@/lib/time";

type C = {
  call: { id: string; userId: string; serviceName: string; startsAt: Date; durationMin: number; priceCents: number; spots: number; spotsTaken: number; requirements: string[] | null; about: string | null };
  businessName: string | null; city: string | null;
};

export function ModelCallCard({ c, showPro = true }: { c: C; showPro?: boolean }) {
  const left = c.call.spots - c.call.spotsTaken;
  return (
    <div className="card">
      <div className="row between"><span className="b">{c.call.serviceName}</span><span className="tag warn">{left} spot{left === 1 ? "" : "s"} left</span></div>
      {showPro && <Link href={`/p/${c.call.userId}`} className="small" style={{ textDecoration: "none" }}>{c.businessName} • <span className="muted">{c.city}</span></Link>}
      <div className="row small"><Icon name="cal" size="s" /> {fmtDate(c.call.startsAt)} • {fmtTime(c.call.startsAt)} • about {c.call.durationMin} min</div>
      <div className="row between"><span className="small muted">Model price</span><span className="b">{c.call.priceCents === 0 ? "Free" : money(c.call.priceCents)}</span></div>
      {c.call.requirements && c.call.requirements.length > 0 && <div className="chips">{c.call.requirements.map((r) => <span key={r} className="tag">{r}</span>)}</div>}
      {c.call.about && <p className="small muted p">{c.call.about}</p>}
      <Link className="btn sm" href={`/book/call/${c.call.id}`} style={{ width: "100%" }}>{c.call.priceCents === 0 ? "Claim a spot" : "Book a spot"}</Link>
    </div>
  );
}
