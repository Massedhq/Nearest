import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { and, asc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { db, professionalProfiles, proServices, modelCalls, reviews } from "@/db";
import { liveProWhere } from "@/lib/search";
import { publicPartnerPage, partnerPagePath, videoInfo, PARTNER_APPLY_PATH } from "@/lib/partners";
import { personName } from "@/lib/pro-name";
import { money } from "@/lib/time";
import { MAX_PRICE_CENTS } from "@/lib/pricing";
import { abs } from "@/lib/public/site";
import { instagramHandle, instagramUrl, tiktokHandle, tiktokUrl, facebookHandle, facebookUrl, pinterestHandle, pinterestUrl } from "@/lib/social";
import { SaveToPhone } from "@/components/SaveToPhone";
import { shopProducts, soldOut } from "@/lib/shop";
import { ShareLinkButton } from "./ShareLinkButton";

export const dynamic = "force-dynamic";

const ACCENT = "#E8C4C0";
const eyebrow = { fontSize: 11, letterSpacing: 2, color: "#B8B2A7", textTransform: "uppercase" as const, fontWeight: 700 };
const tile = { display: "flex", alignItems: "center", gap: 12, background: "#121214", border: "1px solid #2A2A2E", borderRadius: 14, padding: "10px 12px", textDecoration: "none", color: "#F4F1EA" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await publicPartnerPage(slug);
  if (!r) return { title: "Nearest" };
  const name = personName(r.p.displayName, r.u.firstName, r.u.lastName);
  const title = `${name}${r.p.businessName ? ` · ${r.p.businessName}` : ""}`;
  const description = r.page.headline || `Book ${name}, watch their videos and shop their links on Nearest.`;
  const url = abs(partnerPagePath(r.p.slug!));
  return {
    title, description,
    alternates: { canonical: url },
    manifest: `${partnerPagePath(r.p.slug!)}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: name, statusBarStyle: "black-translucent" as const },
    ...(r.p.photoUrl ? { icons: { icon: "/icons/icon-192.png", apple: r.p.photoUrl } } : {}),
    openGraph: { title, description, url, ...(r.p.photoUrl ? { images: [r.p.photoUrl] } : {}) },
  };
}

/** Public Nearest Partner page (usenearest.com/link/<slug>): the partner's link-in-bio, with booking on Nearest. */
export default async function PartnerLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await publicPartnerPage(slug);
  if (!r) notFound();
  const id = r.p.userId;
  const name = personName(r.p.displayName, r.u.firstName, r.u.lastName);
  const top = r.page.topServiceIds.slice(0, 4);
  const [[live], topServices, fallback, calls, [rating]] = await Promise.all([
    db.select({ id: professionalProfiles.userId }).from(professionalProfiles).where(and(eq(professionalProfiles.userId, id), ...liveProWhere(null, "all"))).limit(1),
    top.length ? db.select().from(proServices).where(and(eq(proServices.userId, id), eq(proServices.active, true), inArray(proServices.id, top), lte(proServices.priceCents, MAX_PRICE_CENTS))) : Promise.resolve([]),
    db.select().from(proServices).where(and(eq(proServices.userId, id), eq(proServices.active, true), lte(proServices.priceCents, MAX_PRICE_CENTS))).orderBy(asc(proServices.sort)).limit(4),
    db.select({ n: sql<number>`count(*)::int`, min: sql<number | null>`min(${modelCalls.priceCents})::int` }).from(modelCalls).where(and(eq(modelCalls.userId, id), eq(modelCalls.status, "open"), gt(modelCalls.startsAt, new Date()))),
    db.select({ avg: sql<number | null>`avg(${reviews.rating})::float`, n: sql<number>`count(*)::int` }).from(reviews).where(eq(reviews.proId, id)),
  ]);
  const products = await shopProducts(id);
  const bookable = Boolean(live);
  const services = top.length ? top.map((sid) => topServices.find((s) => s.id === sid)).filter((s): s is NonNullable<typeof s> => Boolean(s)) : fallback;
  const bookHref = `/pro-${r.p.slug}`;
  const openCalls = calls[0]?.n ?? 0;
  const socials = [
    [instagramHandle(r.p.instagram), instagramUrl, "Instagram", <><rect key="a" x="4" y="4" width="16" height="16" rx="4.5" /><circle key="b" cx="12" cy="12" r="3.6" /><path key="c" d="M16.8 7.2v.01" /></>],
    [tiktokHandle(r.p.tiktok), tiktokUrl, "TikTok", <><path key="a" d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5" /><path key="b" d="M14 4c.5 2.6 2.4 4.3 5 4.5" /></>],
    [facebookHandle(r.p.facebook), facebookUrl, "Facebook", <path key="a" d="M14.5 8.5H16V5.6c-.3 0-1.2-.1-2.3-.1-2.3 0-3.7 1.4-3.7 3.9V12H7.5v3.2H10V21h3.1v-5.8h2.5l.4-3.2h-2.9V9.7c0-.8.3-1.2 1.4-1.2z" />],
    [pinterestHandle(r.p.pinterest), pinterestUrl, "Pinterest", <><circle key="a" cx="12" cy="12" r="8.5" /><path key="b" d="M10.6 20.2 12.3 13" /><path key="c" d="M11.4 16.3c.5.6 1.3 1 2.2 1 2.3 0 3.9-2.1 3.9-4.7 0-2.6-2.2-4.5-5-4.5-3.1 0-5 2.1-5 4.5 0 1.1.5 2.2 1.4 2.6" /></>],
  ] as const;

  return (
    <div style={{ minHeight: "100dvh", background: "#000", color: "#F4F1EA", fontFamily: "var(--font-body), system-ui, sans-serif" }}>
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "22px 16px 32px", display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/" style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 22, color: "#F4F1EA", textDecoration: "none" }}>Nearest</Link>
          <ShareLinkButton url={abs(partnerPagePath(r.p.slug!))} name={name} />
        </div>

        <section style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
          {r.p.photoUrl
            ? <Image src={r.p.photoUrl} alt={name} width={184} height={184} priority style={{ width: 184, height: 184, borderRadius: 20, objectFit: "cover", border: `2px solid ${ACCENT}` }} />
            : <div style={{ width: 184, height: 184, borderRadius: 20, border: `2px solid ${ACCENT}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, fontFamily: "var(--font-display), Georgia, serif" }}>{name.slice(0, 2).toUpperCase()}</div>}
          <h1 style={{ margin: 0, fontFamily: "var(--font-display), Georgia, serif", fontWeight: 500, fontSize: 32, lineHeight: 1.1 }}>{name}</h1>
          {(r.page.headline || r.p.businessName) && <span style={{ fontSize: 14, color: "#D9D4CA" }}>{r.page.headline || r.p.businessName}</span>}
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
            {rating.n > 0
              ? <><span aria-hidden="true" style={{ color: "#D4B886", letterSpacing: 2 }}>★★★★★</span><b>{Number(rating.avg).toFixed(1)}</b><span style={{ color: "#B8B2A7", fontSize: 13 }}>({rating.n} review{rating.n === 1 ? "" : "s"})</span></>
              : <span style={{ color: "#B8B2A7", fontSize: 13 }}>New on Nearest</span>}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            {socials.map(([h, toUrl, label, icon]) => h ? (
              <a key={label} href={toUrl(h)} target="_blank" rel="noopener noreferrer" aria-label={label} style={{ width: 40, height: 40, borderRadius: 20, border: "1px solid #2A2A2E", display: "flex", alignItems: "center", justifyContent: "center", color: "#F4F1EA" }}>
                <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">{icon}</svg>
              </a>
            ) : null)}
          </div>
        </section>

        {bookable ? (
          <Link href={bookHref} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: ACCENT, color: "#0B0B0C", textDecoration: "none", borderRadius: 18, padding: 18, textAlign: "center" }}>
            <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: 2, textTransform: "uppercase" }}>Book an appointment</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Booked and paid securely on Nearest</span>
          </Link>
        ) : (
          <div style={{ border: "1px solid #3A3A3F", borderRadius: 18, padding: 16, textAlign: "center", fontSize: 13, color: "#D9D4CA" }}>Booking with {name} opens soon.</div>
        )}

        {bookable && services.length > 0 && (
          <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={eyebrow}>Top services</span>
            {services.map((s) => (
              <Link key={s.id} href={bookHref} style={tile}>
                {s.photoUrl ? <Image src={s.photoUrl} alt="" width={48} height={48} style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flex: "none" }} /> : <span style={{ width: 48, height: 48, borderRadius: 8, background: "#1C1C1F", flex: "none" }} />}
                <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}><span style={{ fontSize: 14, fontWeight: 800 }}>{s.name}{s.adultsOnly ? " (18+)" : ""}</span><span style={{ fontSize: 12, color: "#B8B2A7" }}>{money(s.priceCents)} · {s.durationMin} min</span></span>
                <span style={{ fontSize: 12, fontWeight: 800, color: ACCENT }}>Book</span>
              </Link>
            ))}
          </section>
        )}

        {bookable && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            <Link href={bookHref} style={{ display: "flex", flexDirection: "column", gap: 6, background: "#E9E4D9", color: "#0B0B0C", borderRadius: 16, padding: 14, textDecoration: "none" }}>
              <span style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 22, lineHeight: 1.05 }}>Model Calls</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{openCalls ? `${openCalls} open${calls[0]?.min ? ` · from ${money(calls[0].min)}` : ""}` : "None open right now"}</span>
            </Link>
            <Link href="/bundle" style={{ display: "flex", flexDirection: "column", gap: 6, background: "#121214", border: `1px solid ${ACCENT}`, borderRadius: 16, padding: 14, textDecoration: "none", color: "#F4F1EA" }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>Bundle my booking</span>
              <span style={{ fontSize: 12, color: ACCENT, fontWeight: 800 }}>Several services, one visit</span>
            </Link>
          </div>
        )}

        {r.page.videos.length > 0 && (
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={eyebrow}>Learn with me</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
              {r.page.videos.map((v) => {
                const info = videoInfo(v.url);
                return (
                  <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer" style={{ position: "relative", height: 196, borderRadius: 12, overflow: "hidden", textDecoration: "none", color: "#FFF", display: "block", background: "linear-gradient(160deg, #2A2320, #121214)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {info.thumb && <img src={info.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
                    <span style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,.8) 100%)" }} />
                    <span style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,.6)", borderRadius: 6, padding: "2px 6px", fontSize: 10, fontWeight: 700 }}>{info.site}</span>
                    <span style={{ position: "absolute", left: 8, right: 8, bottom: 8, fontSize: 11, fontWeight: 800, lineHeight: 1.25 }}>{v.title}</span>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {products.length > 0 && (
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={eyebrow}>Shop</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              {products.map((p) => (
                <Link key={p.id} href={`${partnerPagePath(r.p.slug!)}/shop/${p.id}`} style={{ display: "flex", flexDirection: "column", gap: 6, background: "#121214", border: "1px solid #2A2A2E", borderRadius: 14, overflow: "hidden", textDecoration: "none", color: "#F4F1EA" }}>
                  {p.photoUrl
                    ? <Image src={p.photoUrl} alt="" width={240} height={240} style={{ width: "100%", height: "auto", aspectRatio: "1 / 1", objectFit: "cover" }} />
                    : <span style={{ aspectRatio: "1 / 1", background: "linear-gradient(160deg, #2A2320, #121214)", display: "flex", alignItems: "center", justifyContent: "center", padding: 10, textAlign: "center", fontFamily: "var(--font-display), Georgia, serif", fontSize: 16 }}>{p.title}</span>}
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 10px 10px" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.3 }}>{p.title}</span>
                    <span style={{ fontSize: 12, color: "#B8B2A7" }}>{money(p.priceCents)} · {soldOut(p) ? "Sold out" : p.kind === "digital" ? "Instant download" : "Ships to you"}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {r.page.links.length > 0 && (
          <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={eyebrow}>Shop &amp; links</span>
            {r.page.links.map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer nofollow" style={{ ...tile, padding: "14px" }}>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}><span style={{ fontSize: 14, fontWeight: 700 }}>{l.title}</span>{l.note && <span style={{ fontSize: 12, color: "#B8B2A7" }}>{l.note}</span>}</span>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 17 17 7M9 7h8v8" /></svg>
              </a>
            ))}
          </section>
        )}

        <SaveToPhone name={name.split(" ")[0]} accent={ACCENT} />

        <Link href={PARTNER_APPLY_PATH} style={{ display: "flex", alignItems: "center", gap: 12, border: `1px solid ${ACCENT}`, borderRadius: 16, padding: 14, textDecoration: "none", color: "#F4F1EA" }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}><span style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>Nearest Partner</span><span style={{ fontSize: 12, color: "#B8B2A7" }}>Want a page like this? Become a partner</span></span>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m9 5 7 7-7 7" /></svg>
        </Link>
        <span style={{ fontSize: 12, color: "#8E897F", textAlign: "center" }}>Powered by Nearest</span>
      </main>
    </div>
  );
}

