import Image from "next/image";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, professionalProfiles, proServices, portfolioItems, proHours, proOpenings, cities } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { openModelCalls } from "@/lib/search";
import { chicagoNow, label12, money, WEEKDAYS } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { ModelCallCard } from "@/components/ModelCallCard";

export const metadata = { title: "Professional" };

const ASL: Record<string, string> = { basic: "Basic", conversational: "Conversational", fluent: "Fluent" };
const MODE: Record<string, string> = { come_to_me: "Customers come to me", travel: "Travels to you", both: "Come to me or I travel" };

export default async function ProProfile({ params }: { params: Promise<{ id: string }> }) {
  await requireVerifiedStudent();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await db.query.professionalProfiles.findFirst({
    where: and(eq(professionalProfiles.userId, id), eq(professionalProfiles.reviewStatus, "approved"), eq(professionalProfiles.searchable, true)),
  });
  if (!p) notFound();
  const today = chicagoNow().date;
  const [services, photos, hours, openings, city, calls] = await Promise.all([
    db.select().from(proServices).where(and(eq(proServices.userId, id), eq(proServices.active, true))).orderBy(asc(proServices.sort)),
    db.select().from(portfolioItems).where(eq(portfolioItems.userId, id)).orderBy(desc(portfolioItems.featured), asc(portfolioItems.sort)).limit(24),
    db.select().from(proHours).where(eq(proHours.userId, id)),
    p.vacationMode ? [] : db.select().from(proOpenings).where(and(eq(proOpenings.userId, id), eq(proOpenings.day, today))).orderBy(asc(proOpenings.startTime)),
    p.cityId ? db.query.cities.findFirst({ where: eq(cities.id, p.cityId) }) : null,
    openModelCalls(null, "all", id),
  ]);
  const initials = (p.businessName ?? "N").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const langs = (p.languages ?? []).filter((l) => l !== "ASL");

  return (
    <div className="scr">
      <TopBar back="/home" />
      <div className="body" style={{ paddingTop: 0 }}>
        <div className="row">
          {p.photoUrl ? <Image src={p.photoUrl} alt="" width={84} height={84} style={{ borderRadius: 42, objectFit: "cover" }} /> : <div className="avatar lg">{initials}</div>}
          <div className="col g4"><h1 className="disp h2">{p.businessName}</h1><span className="badge"><Icon name="shield" size="s" /> Approved by Nearest</span></div>
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <span className="tag"><Icon name="star" size="s" /> New Professional</span>
          <span className="tag"><Icon name="pin" size="s" /> {city?.name}</span>
          {p.aslLevel !== "none" && <span className="tag"><Icon name="hand" size="s" /> ASL — {ASL[p.aslLevel]}</span>}
          {p.textCommunication && <span className="tag"><Icon name="msg" size="s" /> Text</span>}
          {langs.map((l) => <span key={l} className="tag">{l}</span>)}
        </div>
        {p.serviceMode && <div className="row small muted"><Icon name={p.serviceMode === "travel" ? "car" : "store"} size="s" /><span>{MODE[p.serviceMode]}{p.travelRadiusMi ? ` • up to ${p.travelRadiusMi} mi` : ""}</span></div>}

        {openings.length > 0 && (
          <div className="card warn"><div className="row"><Icon name="bolt" /><span className="b grow">Available today</span></div><span className="small">{openings.map((o) => label12(o.startTime)).join(" • ")}</span></div>
        )}

        {photos.length > 0 && (
          <>
            <h3 className="eyebrow p">Portfolio</h3>
            <div className="grid3">{photos.map((ph) => <div key={ph.id} className="ph" style={{ height: 112, padding: 0 }}><Image src={ph.url} alt="Portfolio work" fill sizes="140px" style={{ objectFit: "cover" }} /></div>)}</div>
          </>
        )}

        <h3 className="eyebrow p">About</h3>
        <p className="p muted" style={{ whiteSpace: "pre-line" }}>{p.bio}</p>

        <h3 className="eyebrow p">Services</h3>
        <div className="col" style={{ gap: 0 }}>
          {services.map((s) => (
            <div key={s.id} className="item"><div className="grow"><div className="b">{s.name}</div><div className="small muted">{money(s.priceCents)} • {s.durationMin} min</div></div><button className="btn dis sm" type="button" disabled>Book</button></div>
          ))}
        </div>
        <p className="xs muted p">Booking opens soon.</p>

        {calls.length > 0 && (
          <>
            <h3 className="eyebrow p">Model calls</h3>
            {calls.map((c) => <ModelCallCard key={c.call.id} c={c} showPro={false} />)}
          </>
        )}

        <h3 className="eyebrow p">Hours</h3>
        <div className="card small">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const h = hours.find((x) => x.kind === "regular" && x.weekday === d);
            const a = hours.find((x) => x.kind === "after_school" && x.weekday === d);
            return <div key={d} className="row between"><span>{WEEKDAYS[d]}</span><span className={h || a ? "" : "muted"}>{h ? `${label12(h.startTime)} – ${label12(h.endTime)}` : "Closed"}{a ? ` • after school ${label12(a.startTime)}–${label12(a.endTime)}` : ""}</span></div>;
          })}
        </div>
      </div>
    </div>
  );
}
