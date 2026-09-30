import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { db, professionalProfiles, proServices, portfolioItems, cities, reviews, users } from "@/db";
import { getViewer } from "@/lib/viewer";
import { liveProWhere } from "@/lib/search";
import { money } from "@/lib/time";
import { MAX_PRICE_CENTS } from "@/lib/pricing";
import { Icon } from "@/components/Icon";

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
  const r = await findPro(handle);
  if (!r) return { title: "Nearest" };
  const title = `${r.p.businessName ?? "Professional"} on Nearest`;
  return { title, description: `Book ${r.p.businessName} on Nearest — verified professionals near you.`, openGraph: { title, images: r.p.photoUrl ? [r.p.photoUrl] : [] } };
}

/** Public booking link (usenearest.com/pro-<name>): anyone can see it; verified students go straight to the full profile. */
export default async function ProLink({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  if (!handle.startsWith("pro-")) notFound();
  const r = await findPro(handle);
  const viewer = await getViewer().catch(() => null);
  if (r && viewer?.user?.accountType === "student") redirect(`/p/${r.p.userId}`);
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
    db.select().from(proServices).where(and(eq(proServices.userId, id), eq(proServices.active, true), lte(proServices.priceCents, MAX_PRICE_CENTS))).orderBy(asc(proServices.sort)).limit(8),
    db.select({ url: portfolioItems.url }).from(portfolioItems).where(and(eq(portfolioItems.userId, id), eq(portfolioItems.kind, "image"))).orderBy(desc(portfolioItems.featured), asc(portfolioItems.sort)).limit(6),
    db.select({ avg: sql<number | null>`avg(${reviews.rating})::float`, n: sql<number>`count(*)::int` }).from(reviews).where(eq(reviews.proId, id)),
    db.query.users.findFirst({ where: eq(users.id, id) }),
  ]);
  const next = encodeURIComponent(`/p/${id}`);
  return (
    <div className="scr">
      <div className="body" style={{ gap: 16 }}>
        <Link href="/" className="row" style={{ gap: 8, textDecoration: "none", color: "inherit" }}><Image src="/brand/nearest-monogram.png" alt="" width={32} height={32} /><span className="disp">Nearest</span></Link>
        <div className="card" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 12 }}>
            {r.p.photoUrl ? <Image src={r.p.photoUrl} alt="" width={64} height={64} style={{ borderRadius: 32, objectFit: "cover" }} /> : <div className="avatar">{(r.p.businessName ?? owner?.firstName ?? "N").slice(0, 2).toUpperCase()}</div>}
            <div className="col g4">
              <h1 className="disp h2" style={{ margin: 0 }}>{r.p.businessName}</h1>
              <span className="badge"><Icon name="shield" size="s" /> Approved by Nearest</span>
              <span className="small muted row" style={{ gap: 6 }}><Icon name="pin" size="s" /> {r.city ?? "Texas"}{rating.n ? ` • ★ ${Number(rating.avg).toFixed(1)} (${rating.n})` : ""}</span>
            </div>
          </div>
          {r.p.bio && <p className="small p" style={{ margin: 0 }}>{r.p.bio}</p>}
          {photos.length > 0 && <div className="grid3">{photos.map((ph) => <div key={ph.url} className="ph" style={{ height: 104, padding: 0 }}><Image src={ph.url} alt="Work by this professional" fill sizes="140px" style={{ objectFit: "cover" }} /></div>)}</div>}
        </div>
        {services.length > 0 && (
          <div className="card" style={{ gap: 6 }}>
            <span className="eyebrow">Services</span>
            {services.map((s) => <div key={s.id} className="row between small"><span>{s.name}{s.adultsOnly ? " (18+)" : ""}</span><span className="muted">{money(s.priceCents)} • {s.durationMin} min</span></div>)}
          </div>
        )}
        <div className="card pearl" style={{ gap: 10 }}>
          <span className="b">Book {r.p.businessName} on Nearest</span>
          <span className="small">Nearest is for verified students. Create your free account and verify your school to book.</span>
          <Link className="btn dark" href={`/sign-up?redirect_url=${next}`}>Create a student account</Link>
          <Link className="link small" href={`/sign-in?redirect_url=${next}`} style={{ textAlign: "center" }}>Already on Nearest? Sign in</Link>
        </div>
      </div>
    </div>
  );
}
