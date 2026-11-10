import Link from "next/link";
import { ServiceVideoButton } from "@/components/ServiceVideoButton";
import Image from "next/image";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, bookings, categories, cities, portfolioItems, proHours, proOpenings, reviews } from "@/db";
import { PartnerBookShell, PS, P_ACCENT, P_GOLD } from "@/components/PartnerBookShell";
import { PortfolioViewer } from "@/components/PortfolioViewer";
import { getFlag } from "@/lib/settings";
import { chicagoNow, label12, money, WEEKDAYS } from "@/lib/time";
import { partnerForBooking, partnerServices, sidePrice } from "@/lib/partner-booking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book", robots: { index: false, follow: false } };

const mins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);
const STATUS: Record<string, string> = { licensed: "Licensed", license_pending: "License pending", currently_enrolled: "Currently enrolled", self_taught: "Self-taught" };
const ASL: Record<string, string> = { basic: "Basic", conversational: "Conversational", fluent: "Fluent" };
const MODE: Record<string, string> = { come_to_me: "Come to me", travel: "I travel to you", both: "Come to me or I travel" };

/**
 * Partner side "Book profile" (matches the Nearest Partner demo, step 2): photo, name, business, verified reviews, status +
 * city + languages, where they work, available today, portfolio (tap a photo → book that look), services by category
 * (Book → straight to that service), reviews, hours, about. Open to anyone; no $150 cap; never shows other professionals.
 */
export default async function PartnerBookProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const x = await partnerForBooking(slug);
  if (!x) notFound();
  const p = x.pro;
  const id = p.userId;
  const today = chicagoNow().date;
  const [services, cats, photos, hours, openings, city, revs] = await Promise.all([
    partnerServices(id),
    db.select({ id: categories.id, name: categories.name, sort: categories.sort }).from(categories).orderBy(asc(categories.sort), asc(categories.name)),
    db.select().from(portfolioItems).where(eq(portfolioItems.userId, id)).orderBy(desc(portfolioItems.featured), asc(portfolioItems.sort)).limit(15),
    db.select().from(proHours).where(eq(proHours.userId, id)),
    p.vacationMode ? [] : db.select().from(proOpenings).where(and(eq(proOpenings.userId, id), eq(proOpenings.day, today))).orderBy(asc(proOpenings.startTime)),
    p.cityId ? db.query.cities.findFirst({ where: eq(cities.id, p.cityId) }) : null,
    db.select({ id: reviews.id, rating: reviews.rating, body: reviews.body, createdAt: reviews.createdAt })
      .from(reviews).innerJoin(bookings, eq(bookings.id, reviews.bookingId))
      .where(and(eq(reviews.proId, id), eq(reviews.hidden, false))).orderBy(desc(reviews.createdAt)).limit(10),
  ]);
  const bookingOpen = await getFlag("status.bookings");
  const avg = revs.length ? Math.round((revs.reduce((a, r) => a + r.rating, 0) / revs.length) * 10) / 10 : null;
  const langs = (p.languages ?? []).filter((l) => l !== "ASL");
  const chips = [
    p.professionalStatus ? STATUS[p.professionalStatus] : null,
    city ? `${city.name}${city.state ? `, ${city.state}` : ""}` : null,
    langs.length ? langs.join(" · ") : null,
    p.aslLevel !== "none" ? `ASL — ${ASL[p.aslLevel]}` : null,
  ].filter(Boolean) as string[];
  const fee = money(p.travelFeeCents ?? 3500);
  const where = p.serviceMode === "travel" ? `Travels${p.travelRadiusMi ? ` up to ${p.travelRadiusMi} miles` : " to you"} · ${fee} travel fee`
    : p.serviceMode === "both" ? `Travels${p.travelRadiusMi ? ` up to ${p.travelRadiusMi} miles` : ""} · ${fee} travel fee, added only when ${x.name} comes to you`
    : null;
  // Kids services are listed in their own section, apart from everyone else's (2026-11-09).
  const grown = services.filter((s) => !s.forKids), kids = services.filter((s) => s.forKids);
  const byCat = cats.map((c) => ({ name: c.name, list: grown.filter((s) => s.categoryId === c.id) })).filter((c) => c.list.length);
  if (kids.length) byCat.push({ name: "Kids", list: kids });
  const svcHref = (sid: string) => `${x.base}/book/${sid}`;

  return (
    <PartnerBookShell name={x.name} photo={p.photoUrl} back={x.base}>
      <section style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {p.photoUrl
          ? <Image src={p.photoUrl} alt={x.name} width={88} height={88} style={{ width: 88, height: 88, borderRadius: 16, objectFit: "cover", flex: "none" }} />
          : <span style={{ width: 88, height: 88, borderRadius: 16, border: `1px solid ${P_ACCENT}`, flex: "none" }} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ ...PS.h1, fontSize: 26 }}>{x.name}</span>
          {p.businessName && p.businessName !== x.name && <span style={{ fontSize: 13, color: "#D9D4CA" }}>{p.businessName}</span>}
          <span style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
            {avg ? <><span style={{ color: P_GOLD }}>★</span><b>{avg.toFixed(1)}</b><span style={{ color: "#B8B2A7" }}>{revs.length} verified review{revs.length === 1 ? "" : "s"}</span></> : <span style={{ color: "#B8B2A7" }}>New on Nearest</span>}
          </span>
        </div>
      </section>

      {chips.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {chips.map((t) => <span key={t} style={{ border: "1px solid #3A3A3F", borderRadius: 999, padding: "6px 11px", fontSize: 12 }}>{t}</span>)}
        </div>
      )}

      {p.serviceMode && (
        <div style={{ ...PS.card, gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>{MODE[p.serviceMode] ?? "Where I work"}</span>
          {where ? <span style={PS.muted}>{where}</span> : city ? <span style={PS.muted}>In {city.name}. The address is shared on your appointment day.</span> : null}
        </div>
      )}

      {openings.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
          <span style={{ background: "#2B2410", color: "#E9CF8E", borderRadius: 999, padding: "5px 10px", fontWeight: 800, fontSize: 12 }}>Available today</span>
          <span style={{ color: "#D9D4CA" }}>{openings.map((o) => label12(o.startTime)).join(" · ")}</span>
        </div>
      )}

      {photos.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={PS.eyebrow}>Portfolio · tap a photo</span>
          <PortfolioViewer bookingOpen={bookingOpen} photos={photos.map((ph) => {
            const s = ph.serviceId ? services.find((v) => v.id === ph.serviceId) : undefined;
            return { id: ph.id, url: ph.url, kind: ph.kind, durationSec: ph.durationSec, more: ph.lookPhotos, lookVideo: ph.lookVideoUrl, lookVideoSec: ph.lookVideoSec, serviceName: s ? `${s.name}${s.adultsOnly ? " (18+)" : ""}` : null, price: s ? money(sidePrice(s)) : null, bookHref: s ? svcHref(s.id) : null };
          })} />
        </section>
      )}

      <section id="services" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <span style={PS.eyebrow}>Services</span>
        {services.length === 0 && <span style={PS.muted}>No services are listed yet.</span>}
        {byCat.map((c) => (
          <div key={c.name} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>{c.name}</span>
            {c.list.map((s) => (
              <div key={s.id} style={PS.tile}>
                {s.photoUrl ? <Image src={s.photoUrl} alt="" width={48} height={48} style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flex: "none" }} /> : <span style={{ width: 48, height: 48, borderRadius: 8, background: "#1C1C1F", flex: "none" }} />}
                <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{s.name}{s.adultsOnly ? " (18+)" : ""}</span>
                  <span style={{ fontSize: 12, color: "#B8B2A7" }}>{money(sidePrice(s))} · {mins(s.durationMin)}</span>
                  {s.videoUrl && <ServiceVideoButton url={s.videoUrl} name={s.name} bookHref={bookingOpen ? svcHref(s.id) : null} accent={P_ACCENT} />}
                  {(s.addons ?? []).length > 0 && <span style={{ fontSize: 11, color: "#8E897F" }}>Add-ons: {(s.addons ?? []).map((a) => `${a.name} +${money(a.priceCents)}`).join(" · ")}</span>}
                </span>
                {bookingOpen
                  ? <Link href={svcHref(s.id)} style={{ flex: "none", background: P_ACCENT, color: "#0B0B0C", borderRadius: 999, padding: "9px 14px", font: "800 12px var(--font-body), sans-serif", textDecoration: "none" }}>Book</Link>
                  : <span style={{ fontSize: 11, color: "#8E897F" }}>Paused</span>}
              </div>
            ))}
          </div>
        ))}
        {services.length > 1 && (
          <Link href={`${x.base}/bundle`} style={{ ...PS.tile, border: `1px solid ${P_ACCENT}` }}>
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>Bundle my booking</span>
              <span style={{ fontSize: 12, color: P_ACCENT, fontWeight: 800 }}>Several of {x.name}&apos;s services, one visit</span>
            </span>
          </Link>
        )}
      </section>

      {revs.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={PS.eyebrow}>Verified booking reviews</span>
          {revs.map((r) => (
            <div key={r.id} style={PS.card}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: P_GOLD, letterSpacing: 2 }} aria-label={`${r.rating} out of 5`}>{"★".repeat(r.rating)}<span style={{ opacity: 0.3 }}>{"★".repeat(5 - r.rating)}</span></span>
                <span style={{ fontSize: 12, color: "#B8B2A7" }}>{r.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}</span>
              </div>
              {r.body && <span style={{ fontSize: 14, color: "#D9D4CA", lineHeight: 1.5 }}>{r.body}</span>}
            </div>
          ))}
        </section>
      )}

      {hours.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={PS.eyebrow}>Hours</span>
          <div style={{ ...PS.card, gap: 7, fontSize: 13 }}>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const h = hours.find((v) => v.kind === "regular" && v.weekday === d);
              const a = hours.find((v) => v.kind === "after_school" && v.weekday === d);
              return <div key={d} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span>{WEEKDAYS[d]}</span><span style={{ color: h || a ? "#F4F1EA" : "#8E897F", textAlign: "right" }}>{h ? `${label12(h.startTime)} – ${label12(h.endTime)}` : a ? "" : "Closed"}{a ? `${h ? " · a" : "A"}fter school ${label12(a.startTime)}–${label12(a.endTime)}` : ""}</span></div>;
            })}
          </div>
        </section>
      )}

      {p.bio && (
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={PS.eyebrow}>About</span>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#D9D4CA", whiteSpace: "pre-line" }}>{p.bio}</p>
        </section>
      )}

      {bookingOpen && services.length > 0 && <a href="#services" style={PS.btn}>Book now</a>}
      <span style={PS.muted}>Anyone 18+ can book {x.name} here. You&apos;ll make a quick Nearest account (or sign in) before you pay — no school ID needed.</span>
    </PartnerBookShell>
  );
}
