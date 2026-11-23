import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, modelCalls } from "@/db";
import { PartnerBookShell, PS, P_ACCENT, P_GOLD } from "@/components/PartnerBookShell";
import { ModelCallGallery } from "@/components/ModelCallGallery";
import { partnerForBooking } from "@/lib/partner-booking";
import { callPhotos, callCharge, onSide } from "@/lib/model-calls";
import { openSlots, nextDays } from "@/lib/availability";
import { chicagoToUtc, fmtDate, fmtTime, money } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Model Call", robots: { index: false, follow: false } };

/** One public Model Call on a partner page: the look (photos + video), details, price, time — then claim (step 3). */
export default async function PartnerModelCall({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ day?: string; time?: string }> }) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const x = await partnerForBooking(slug);
  if (!x || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const c = await db.query.modelCalls.findFirst({ where: and(eq(modelCalls.id, id), eq(modelCalls.userId, x.pro.userId)) });
  if (!c || !onSide(c, "partner")) notFound();
  const open = c.status === "open" && c.spotsTaken < c.spots && c.startsAt.getTime() > Date.now();
  const pay = callCharge(c, "partner");
  const left = c.spots - c.spotsTaken;
  const untilDay = new Date(c.startsAt.toLocaleString("en-US", { timeZone: "America/Chicago" })).toISOString().slice(0, 10);
  const days = c.flexible ? nextDays(30).filter((d) => d <= untilDay).slice(0, 21) : [];
  const day = c.flexible ? (sp.day && days.includes(sp.day) ? sp.day : days[0]) : null;
  const slots = c.flexible && day ? await openSlots(c.userId, c.durationMin, day) : [];
  const time = c.flexible && sp.time && slots.includes(sp.time) ? sp.time : null;
  const here = `${x.base}/model-calls/${c.id}`;
  const claim = `${here}/confirm${c.flexible && day && time ? `?day=${day}&time=${time}` : ""}`;
  return (
    <PartnerBookShell name={x.name} photo={x.pro.photoUrl} back={`${x.base}/model-calls`}>
      <ModelCallGallery photos={callPhotos(c)} video={c.videoUrl} alt={`${c.serviceName} by ${x.name}`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={PS.eyebrow}>Model Call · {x.name}</span>
        <h2 style={{ ...PS.h1, fontSize: 34 }}>{c.serviceName}</h2>
        <span style={{ fontSize: 13, color: "#B8B2A7" }}>{c.flexible ? `Pick your time · through ${fmtDate(c.startsAt, { month: "long", day: "numeric" })}` : `${fmtDate(c.startsAt, { weekday: "long", month: "long", day: "numeric" })} · ${fmtTime(c.startsAt)}`} · about {c.durationMin} min · {left} spot{left === 1 ? "" : "s"} left</span>
      </div>

      <div style={{ ...PS.card, gap: 8 }}>
        {pay.deposit ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>Service <span style={PS.muted}>(remaining balance — pay {x.name} at your appointment)</span></span><b>{money(pay.balanceDueCents)}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>Deposit/Booking Fee <span style={PS.muted}>(pay now to book)</span></span><b style={{ color: P_GOLD }}>{money(pay.onlineCents)}</b></div>
          </>
        ) : <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span style={PS.muted}>Model price</span><b style={{ fontSize: 22 }}>{pay.totalCents === 0 ? "Free" : money(pay.totalCents)}</b></div>}
      </div>

      {c.requirements && c.requirements.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={PS.eyebrow}>Model requirements</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{c.requirements.map((r) => <span key={r} style={{ fontSize: 12, color: "#F4F1EA", border: `1px solid ${P_ACCENT}`, borderRadius: 999, padding: "5px 11px" }}>{r}</span>)}</div>
        </div>
      )}
      {c.about && <div style={PS.card}><span style={PS.eyebrow}>From {x.name}</span><p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", color: "#D9D4CA" }}>{c.about}</p></div>}

      {!open ? <div style={PS.card}><b>This Model Call is full or closed.</b><Link href={`${x.base}/model-calls`} style={PS.ghost}>See other Model Calls</Link></div> : (
        <>
          {c.flexible && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={PS.eyebrow}>Pick your day &amp; time</span>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
                {days.map((d) => <Link key={d} scroll={false} href={`${here}?day=${d}`} style={{ ...PS.choice(d === day), minWidth: 58, flex: "none" }}><span style={{ fontSize: 11 }}>{fmtDate(new Date(`${d}T12:00:00Z`), { weekday: "short" })}</span><b>{Number(d.slice(8))}</b></Link>)}
              </div>
              {slots.length === 0 ? <span style={PS.muted}>No open times this day — try another.</span> : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                  {slots.map((t) => <Link key={t} scroll={false} href={`${here}?day=${day}&time=${t}`} style={PS.choice(t === time)}>{fmtTime(chicagoToUtc(day!, t))}</Link>)}
                </div>
              )}
            </div>
          )}
          {c.flexible && !time ? <span style={{ ...PS.muted, textAlign: "center" }}>Pick a time above to claim your spot.</span>
            : <Link href={claim} style={PS.btn}>Claim this spot</Link>}
          <span style={{ ...PS.muted, textAlign: "center" }}>Booked and paid securely on Nearest. 18+.</span>
        </>
      )}
    </PartnerBookShell>
  );
}
