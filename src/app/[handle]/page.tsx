import Link from "next/link";
import { ServiceVideoButton } from "@/components/ServiceVideoButton";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq, lte, sql, ne } from "drizzle-orm";
import { db, professionalProfiles, proServices, portfolioItems, cities, reviews, users, categories } from "@/db";
import { getViewer } from "@/lib/viewer";
import { liveProWhere } from "@/lib/search";
import { money } from "@/lib/time";
import { MAX_PRICE_CENTS } from "@/lib/pricing";
import { Icon } from "@/components/Icon";
import { abs } from "@/lib/public/site";
import { categorySeo, mainCategory } from "@/lib/public/directory";
import { citySlug, stateSlug } from "@/lib/public/locations";
import { JsonLd } from "@/components/public/JsonLd";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function findPro(handle: string) {
  if (!handle.startsWith("pro-")) return null;
  const key = handle.slice(4).toLowerCase();
  const where = UUID.test(key) ? eq(professionalProfiles.userId, key) : eq(professionalProfiles.slug, key);
  return (await db.select({ p: professionalProfiles, city: cities.name, state: cities.state }).from(professionalProfiles)
    .leftJoin(cities, eq(cities.id, professionalProfiles.cityId))
    .where(and(where, ...liveProWhere(null, "all"))).limit(1))[0] ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  if (handle.startsWith("par-")) return { title: "Nearest Partner" };
  const r = await findPro(handle);
  if (!r) return { title: "Nearest" };
  // Written the way people search: "Nailed by Avy — Nail Tech in Frisco, TX".
  const main = await mainCategory(r.p.userId);
  const role = main ? categorySeo(main).singular : "Beauty Professional";
  const name = r.p.businessName ?? r.p.displayName ?? "Professional";
  const where = r.city ? `${r.city}${r.state ? `, ${r.state}` : ""}` : "";
  const svc = await db.select({ name: proServices.name, price: proServices.priceCents }).from(proServices)
    .where(and(eq(proServices.userId, r.p.userId), eq(proServices.active, true), lte(proServices.priceCents, MAX_PRICE_CENTS), ne(proServices.showOn, "partner"))).orderBy(asc(proServices.sort)).limit(4);
  const from = svc.length ? Math.min(...svc.map((x) => x.price)) : null;
  const title = { absolute: `${name} — ${role}${where ? ` in ${where}` : ""} | Nearest` };
  const description = `${name}${r.p.displayName && r.p.displayName !== name ? ` (${r.p.displayName})` : ""} is a verified ${role.toLowerCase()}${where ? ` in ${where}` : ""} on Nearest.${svc.length ? ` ${svc.slice(0, 3).map((x) => x.name).join(", ")}${from != null ? ` from ${money(from)}` : ""}.` : ""} See their work and book with a free student account.`;
  const url = abs(`/pro-${r.p.slug ?? r.p.userId}`);
  const work = await db.select({ url: portfolioItems.url }).from(portfolioItems).where(and(eq(portfolioItems.userId, r.p.userId), eq(portfolioItems.kind, "image")))
    .orderBy(desc(portfolioItems.featured), asc(portfolioItems.sort)).limit(3);
  const ogImages = [...(r.p.photoUrl ? [r.p.photoUrl] : []), ...work.map((w) => w.url)];
  return { title, description, alternates: { canonical: url }, robots: { index: true, follow: true }, openGraph: { title: title.absolute, description, url, siteName: "Nearest", ...(ogImages.length ? { images: ogImages } : {}) } };
}

/** Public booking link (usenearest.com/pro-<name>): anyone can see it; verified students go straight to the full profile. */
export default async function ProLink({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  // Partner share links (usenearest.com/par-<name>) open the partner's own page. Student-side links stay pro-<name>.
  if (/^par-[a-z0-9-]{2,40}$/i.test(handle)) redirect(`/link/${handle.slice(4).toLowerCase()}`);
  if (!handle.startsWith("pro-")) notFound();
  const r = await findPro(handle);
  const viewer = await getViewer().catch(() => null);
  if (r && viewer?.user?.accountType === "student") redirect(`/p/${r.p.userId}`);
  // Partner-only partners have no student page — their partner page is where they book (2026-11-09).
  const { publicPartnerPage, partnerPagePath } = await import("@/lib/partners");
  const partnerPage = await publicPartnerPage(handle.slice(4));
  if (!r && partnerPage) redirect(partnerPagePath(partnerPage.p.slug!));
  if (!r) {
    return (
      <div className="scr" style={{ justifyContent: "center" }}>
        <div className="body" style={{ flex: "none", gap: 14, alignItems: "center", textAlign: "center" }}>
          <Image src="/brand/nearest-monogram.png" alt="Nearest" width={72} height={72} />
          <h1 className="disp h2">This professional isn&apos;t available right now.</h1>
          <Link className="btn" href="/sign-up">Find professionals on Nearest</Link>
        </div>
      </div>
    );
  }
  const id = r.p.userId;
  const [services, photos, [rating], owner] = await Promise.all([
    db.select().from(proServices).where(and(eq(proServices.userId, id), eq(proServices.active, true), lte(proServices.priceCents, MAX_PRICE_CENTS), ne(proServices.showOn, "partner"))).orderBy(asc(proServices.sort)).limit(8),
    // Up to the 10-photo portfolio limit. Each photo carries the service it shows, so Google Images gets a real description.
    db.select({ url: portfolioItems.url, service: proServices.name }).from(portfolioItems).leftJoin(proServices, eq(proServices.id, portfolioItems.serviceId))
      .where(and(eq(portfolioItems.userId, id), eq(portfolioItems.kind, "image"))).orderBy(desc(portfolioItems.featured), asc(portfolioItems.sort)).limit(10),
    db.select({ avg: sql<number | null>`avg(${reviews.rating})::float`, n: sql<number>`count(*)::int` }).from(reviews).where(eq(reviews.proId, id)),
    db.query.users.findFirst({ where: eq(users.id, id) }),
  ]);
  const allCats = await db.selectDistinct({ name: categories.name, sort: categories.sort }).from(proServices).innerJoin(categories, eq(categories.id, proServices.categoryId))
    .where(and(eq(proServices.userId, id), eq(proServices.active, true), lte(proServices.priceCents, MAX_PRICE_CENTS), ne(proServices.showOn, "partner"))).orderBy(asc(categories.sort), asc(categories.name));
  const offers = allCats.map((c) => c.name); // every service category they offer, under their name
  const next = encodeURIComponent(`/p/${id}`);
  const main = allCats.find((c) => c.name !== "Other")?.name ? await mainCategory(id) : null;
  const seo = main ? categorySeo(main) : null;
  const cityHref = r.city && r.state ? `/locations/${stateSlug(r.state)}/${citySlug(r.city)}` : null;
  // Photo descriptions for Google Images: "Gel X Full Set by Nailed by Avy, Nail Tech in Frisco, TX".
  const biz = r.p.businessName ?? r.p.displayName ?? "Professional";
  const roleLine = `${seo?.singular ?? "Beauty Professional"}${r.city ? ` in ${r.city}${r.state ? `, ${r.state}` : ""}` : ""}`;
  const photoAlt = (service: string | null) => `${service ?? `${seo?.singular ?? "Beauty"} work`} by ${biz}, ${roleLine}`;
  const pageUrl = abs(`/pro-${r.p.slug ?? id}`);
  const crumbs = [{ name: "Home", href: "/" }, { name: "Locations", href: "/locations" }, ...(cityHref ? [{ name: `${r.city}, ${r.state}`, href: cityHref }] : []), ...(cityHref && seo ? [{ name: seo.plural, href: `${cityHref}/${seo.slug}` }] : []), { name: r.p.businessName ?? "Professional", href: `/pro-${r.p.slug ?? id}` }];
  return (
    <div className="scr">
      <div className="body" style={{ gap: 16 }}>
        <Link href="/" className="row" style={{ gap: 8, textDecoration: "none", color: "inherit" }}><Image src="/brand/nearest-monogram.png" alt="" width={32} height={32} /><span className="disp">Nearest</span></Link>
        <div className="card" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 12 }}>
            {r.p.photoUrl ? <Image src={r.p.photoUrl} alt={`${biz}, ${roleLine}`} width={64} height={64} style={{ borderRadius: 32, objectFit: "cover" }} /> : <div className="avatar">{(r.p.businessName ?? owner?.firstName ?? "N").slice(0, 2).toUpperCase()}</div>}
            <div className="col g4">
              <h1 className="disp h2 row" style={{ margin: 0, gap: 6 }}>{r.p.businessName}<span className="badge" role="img" aria-label="Approved by Nearest" title="Approved by Nearest"><Icon name="shield" /></span></h1>
              {seo && <span className="small b" style={{ color: "#E3C58A" }}>{seo.singular}{r.city ? ` in ${r.city}${r.state ? `, ${r.state}` : ""}` : ""}</span>}
              {offers.length > 0 && <span className="small" style={{ color: "#D8D2C6" }}>{offers.join(" • ")}</span>}
              <span className="small muted row" style={{ gap: 6 }}><Icon name="pin" size="s" /> {r.city ?? "Texas"}{rating.n ? ` • ★ ${Number(rating.avg).toFixed(1)} (${rating.n})` : ""}</span>
            </div>
          </div>
          {r.p.bio && <p className="small p" style={{ margin: 0 }}>{r.p.bio}</p>}
          {photos.length > 0 && <div className="grid3">{photos.map((ph) => <a key={ph.url} href={ph.url} target="_blank" rel="noopener" className="ph" style={{ height: 104, padding: 0, display: "block", position: "relative" }}><Image src={ph.url} alt={photoAlt(ph.service)} title={photoAlt(ph.service)} fill sizes="(max-width: 480px) 33vw, 160px" style={{ objectFit: "cover" }} /></a>)}</div>}
        </div>
        {services.length > 0 && (
          <div className="card" style={{ gap: 6 }}>
            <span className="eyebrow">Services</span>
            {services.map((s) => <div key={s.id} className="row between small" style={{ alignItems: "flex-start" }}><span className="col" style={{ gap: 0 }}><span>{s.name}{s.adultsOnly ? " (18+)" : ""}</span>{s.videoUrl && <ServiceVideoButton url={s.videoUrl} name={s.name} />}</span><span className="muted">{money(s.priceCents)} • {s.durationMin} min</span></div>)}
          </div>
        )}
        <div className="card pearl" style={{ gap: 10 }}>
          <span className="b">Book {r.p.businessName} on Nearest</span>
          <span className="small">Nearest is for verified students. Create your free account and verify your school to book.</span>
          <Link className="btn dark" href={`/sign-up?redirect_url=${next}`}>Create a student account</Link>
          <Link className="link small" href={`/sign-in?redirect_url=${next}`} style={{ textAlign: "center" }}>Already on Nearest? Sign in</Link>
          {partnerPage && <Link className="link small" href={`${partnerPagePath(partnerPage.p.slug!)}/book`} style={{ textAlign: "center" }}>Not a student? Book {r.p.businessName} on their partner page</Link>}
        </div>
        {/* Owner rule (2026-11-09): a professional's page never links to other professionals — no "More … in City" link or visible category/city trail. */}
        {photos.length > 0 && (
          // Image credits for Google Images (who made the work, which page it belongs to). No business/rating schema — owner rule.
          <JsonLd data={{ "@context": "https://schema.org", "@graph": photos.map((ph) => ({
            "@type": "ImageObject", contentUrl: ph.url, name: photoAlt(ph.service), caption: photoAlt(ph.service),
            creditText: biz, creator: { "@type": "Organization", name: biz, url: pageUrl }, acquireLicensePage: pageUrl,
            copyrightNotice: `© ${biz}`, representativeOfPage: false,
          })) }} />
        )}
        <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: abs(c.href) })) }} />
      </div>
    </div>
  );
}
