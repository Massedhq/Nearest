import Image from "next/image";
import { PortfolioViewer } from "@/components/PortfolioViewer";
import { instagramHandle, tiktokHandle, instagramUrl, tiktokUrl } from "@/lib/social";
import Link from "next/link";
import { getFlag } from "@/lib/settings";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { MAX_PRICE_CENTS } from "@/lib/pricing";
import { db, bookings, professionalProfiles, proServices, portfolioItems, proHours, proOpenings, cities, reviews, favorites } from "@/db";
import { FavButton } from "@/components/FavButton";
import { ShareProButton } from "@/components/ShareProButton";
import { ensureProSlug, proLink } from "@/lib/connections";
import { nearPoint, miles } from "@/lib/near";
import { requireVerifiedStudent } from "@/lib/student";
import { isAdult } from "@/lib/age";
import { openModelCalls } from "@/lib/search";
import { chicagoNow, label12, money, WEEKDAYS } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { ModelCallCard } from "@/components/ModelCallCard";

export const metadata = { title: "Professional" };

const ASL: Record<string, string> = { basic: "Basic", conversational: "Conversational", fluent: "Fluent" };
const MODE: Record<string, string> = { come_to_me: "Customers come to me", travel: "Travels to you", both: "Come to me or I travel" };

export default async function ProProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notbooked?: string }> }) {
  const { user } = await requireVerifiedStudent();
  const notBooked = (await searchParams).notbooked === "1";
  const adult = isAdult(user.dateOfBirth);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await db.query.professionalProfiles.findFirst({
    where: and(eq(professionalProfiles.userId, id), eq(professionalProfiles.reviewStatus, "approved"), eq(professionalProfiles.searchable, true)),
  });
  if (!p) notFound();
  const today = chicagoNow().date;
  const [services, photos, hours, openings, city, calls] = await Promise.all([
    db.select().from(proServices).where(and(eq(proServices.userId, id), eq(proServices.active, true), lte(proServices.priceCents, MAX_PRICE_CENTS))).orderBy(asc(proServices.sort)),
    db.select().from(portfolioItems).where(eq(portfolioItems.userId, id)).orderBy(desc(portfolioItems.featured), asc(portfolioItems.sort)).limit(15), // 10 photos + 5 videos
    db.select().from(proHours).where(eq(proHours.userId, id)),
    p.vacationMode ? [] : db.select().from(proOpenings).where(and(eq(proOpenings.userId, id), eq(proOpenings.day, today))).orderBy(asc(proOpenings.startTime)),
    p.cityId ? db.query.cities.findFirst({ where: eq(cities.id, p.cityId) }) : null,
    openModelCalls(null, "all", id),
  ]);
  const bookingOpen = await getFlag("status.bookings");
  const isFav = Boolean(await db.query.favorites.findFirst({ where: and(eq(favorites.studentId, user.id), eq(favorites.proId, id)) }));
  const [{ n: favCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(favorites).where(eq(favorites.proId, id));
  const here = await nearPoint();
  const away = here ? miles(here, p) : null;
  const ig = instagramHandle(p.instagram), tt = tiktokHandle(p.tiktok);
  const social = [
    ig && { icon: "insta", label: "Instagram", text: `@${ig}`, href: instagramUrl(ig) },
    tt && { icon: "tiktok", label: "TikTok", text: `@${tt}`, href: tiktokUrl(tt) },
  ].filter(Boolean) as { icon: string; label: string; text: string; href: string }[];
  const revs = await db
    .select({ id: reviews.id, rating: reviews.rating, body: reviews.body, createdAt: reviews.createdAt,
      // a client photo shows only if the client allowed sharing AND the pro chose to show it with this review
      photo: sql<string | null>`case when ${bookings.photoStatus} = 'shown' and ${bookings.photoForPortfolio} then ${bookings.photoUrl} end` })
    .from(reviews).innerJoin(bookings, eq(bookings.id, reviews.bookingId))
    .where(and(eq(reviews.proId, id), eq(reviews.hidden, false))).orderBy(desc(reviews.createdAt)).limit(20);
  const avg = revs.length ? Math.round((revs.reduce((a, r) => a + r.rating, 0) / revs.length) * 10) / 10 : null;
  const initials = (p.businessName ?? "N").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const langs = (p.languages ?? []).filter((l) => l !== "ASL");

  return (
    <div className="scr">
      <TopBar back="/home" />
      <div className="body" style={{ paddingTop: 0 }}>
        {notBooked && <div className="card small" role="status"><span>Not booked — you backed out before paying, so you weren&apos;t charged. Pick a time again whenever you&apos;re ready.</span></div>}
        <div className="row">
          {p.photoUrl ? <Image src={p.photoUrl} alt="" width={84} height={84} style={{ borderRadius: 42, objectFit: "cover" }} /> : <div className="avatar lg">{initials}</div>}
          <div className="col g4 grow"><h1 className="disp h2">{p.businessName}</h1><span className="badge"><Icon name="shield" size="s" /> Approved by Nearest</span></div>
          <FavButton proId={id} on={isFav} size={44} count={favCount} />
          <ShareProButton proId={id} proName={p.businessName ?? "This professional"} link={proLink((await ensureProSlug(id)) ?? id)} compact />
        </div>
        {social.length > 0 && (
          <div className="row" style={{ gap: 18, flexWrap: "wrap" }}>
            {social.map((x) => (
              <a key={x.label} href={x.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${p.businessName} on ${x.label}`} title={x.text}
                className="col" style={{ alignItems: "center", gap: 4, textDecoration: "none", color: "inherit" }}>
                <span className="iconbtn" style={{ width: 48, height: 48, ...(x.icon === "insta" ? { background: "linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)", color: "#fff", borderColor: "transparent" } : {}) }}><Icon name={x.icon} /></span>
                <span className="xs">{x.label}</span>
              </a>
            ))}
          </div>
        )}
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <span className="tag"><Icon name="star" size="s" /> {avg ? `${avg} • ${revs.length} verified review${revs.length === 1 ? "" : "s"}` : "New Professional"}</span>
          <span className="tag"><Icon name="pin" size="s" /> {away != null ? `${away} mi away` : city?.name}</span>
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
            <PortfolioViewer bookingOpen={bookingOpen} photos={photos.map((ph) => {
              const svc = ph.serviceId ? services.find((x) => x.id === ph.serviceId) : undefined;
              const blocked = svc?.adultsOnly && !adult;
              return { id: ph.id, url: ph.url, kind: ph.kind, durationSec: ph.durationSec, serviceName: svc ? `${svc.name}${svc.adultsOnly ? " (18+)" : ""}` : null, price: svc ? money(svc.priceCents) : null, bookHref: svc && !blocked ? `/book/${svc.id}` : null };
            })} />
          </>
        )}

        <h3 className="eyebrow p">About</h3>
        <p className="p muted" style={{ whiteSpace: "pre-line" }}>{p.bio}</p>

        <h3 className="eyebrow p" id="services" style={{ scrollMarginTop: 80 }}>Services</h3>
        <div className="col" style={{ gap: 0 }}>
          {services.map((s) => (
            <div key={s.id} className="item"><div className="grow"><div className="b">{s.name}{s.adultsOnly && <span className="tag warn" style={{ marginLeft: 8 }}>18+</span>}</div><div className="small muted">{money(s.priceCents)} • {s.durationMin} min</div></div>{s.adultsOnly && !adult ? <button className="btn dis sm" type="button" disabled title="You must be 18 or older to book this service">18+ only</button> : bookingOpen ? <Link className="btn sm" href={`/book/${s.id}`}>Book</Link> : <button className="btn dis sm" type="button" disabled>Book</button>}</div>
          ))}
        </div>
        {!bookingOpen && <p className="xs muted p">Booking is paused right now.</p>}

        {calls.length > 0 && (
          <>
            <h3 className="eyebrow p">Model calls</h3>
            {calls.map((c) => <ModelCallCard key={c.call.id} c={c} showPro={false} />)}
          </>
        )}

        {revs.length > 0 && (
          <>
            <h3 className="eyebrow p">Verified booking reviews</h3>
            {revs.map((r) => (
              <div key={r.id} className="card">
                <div className="row between"><span className="stars" aria-label={`${r.rating} out of 5`}>{"★".repeat(r.rating)}<span style={{ opacity: 0.3 }}>{"★".repeat(5 - r.rating)}</span></span><span className="xs muted">{r.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}</span></div>
                {r.body && <p className="p small">{r.body}</p>}
                {r.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photo} alt="The client's finished look" style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 12 }} />
                )}
                <span className="badge xs"><Icon name="check" size="s" /> Verified Booking</span>
              </div>
            ))}
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
