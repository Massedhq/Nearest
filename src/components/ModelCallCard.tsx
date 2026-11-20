import Link from "next/link";
import { Icon } from "./Icon";
import { ModelCallGallery } from "./ModelCallGallery";
import { callCharge, callPhotos } from "@/lib/model-calls";
import type { modelCalls } from "@/db";
import { fmtDate, fmtTime, money } from "@/lib/time";

type C = { call: typeof modelCalls.$inferSelect; businessName: string | null; city: string | null };

/** Student side Model Call card (2026-11-20): swipeable inspiration photos/video, student price, deposit-to-book note. */
export function ModelCallCard({ c, showPro = true }: { c: C; showPro?: boolean }) {
  const left = c.call.spots - c.call.spotsTaken;
  const pay = callCharge(c.call, "student");
  return (
    <div className="card" style={{ padding: 0, gap: 0, overflow: "hidden" }}>
      <ModelCallGallery photos={callPhotos(c.call)} video={c.call.videoUrl} alt={`${c.call.serviceName}${c.businessName ? ` by ${c.businessName}` : ""}`} radius={0} ratio="5 / 4" />
      <div className="col" style={{ gap: 10, padding: 14 }}>
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <span className="col" style={{ gap: 2 }}>
            <span className="disp" style={{ fontSize: 22, lineHeight: 1.05 }}>{c.call.serviceName}</span>
            {showPro && <Link href={`/p/${c.call.userId}`} className="small" style={{ textDecoration: "none" }}>{c.businessName}{c.city ? <span className="muted"> • {c.city}</span> : null}</Link>}
          </span>
          <span className="col" style={{ alignItems: "flex-end", gap: 2 }}>
            <span className="b" style={{ fontSize: 18 }}>{pay.totalCents === 0 ? "Free" : money(pay.totalCents)}</span>
            {pay.deposit && <span className="xs b" style={{ color: "#D4B886" }}>{money(pay.onlineCents)} to book</span>}
          </span>
        </div>
        <div className="row small"><Icon name="cal" size="s" /> {c.call.flexible ? `Pick your time (through ${fmtDate(c.call.startsAt, { month: "short", day: "numeric" })})` : `${fmtDate(c.call.startsAt)} • ${fmtTime(c.call.startsAt)}`} • {c.call.durationMin} min</div>
        <div className="chips"><span className="tag warn">{left} spot{left === 1 ? "" : "s"} left</span>{(c.call.requirements ?? []).map((r) => <span key={r} className="tag">{r}</span>)}</div>
        {c.call.about && <p className="small muted p" style={{ margin: 0 }}>{c.call.about}</p>}
        <Link className="btn sm" href={`/book/call/${c.call.id}`} style={{ width: "100%" }}>{pay.totalCents === 0 ? "Claim a spot" : "Book a spot"}</Link>
      </div>
    </div>
  );
}
