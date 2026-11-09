import "server-only";
import { and, asc, eq, inArray, lte, sql, ne } from "drizzle-orm";

/**
 * The public Nearest directory — what Google indexes so people searching "nail tech in Frisco" or a business name
 * land on Nearest. Only professionals students can book right now (liveProWhere) are listed, with what their public
 * share page already shows: business name, the name clients see, photo, city, services, prices and rating.
 * Never an address, phone or email.
 */

export type CategorySeo = { slug: string; plural: string; singular: string };

/** How people search for each category ("nail techs", not "Nails"). Categories not listed fall back to "<Name> Professionals". */
export const CATEGORY_SEO: Record<string, CategorySeo> = {
  Hair: { slug: "hair-stylists", plural: "Hair Stylists", singular: "Hair Stylist" },
  Braids: { slug: "braiders", plural: "Braiders", singular: "Braider" },
  Locs: { slug: "loctitians", plural: "Loctitians", singular: "Loctitian" },
  Barber: { slug: "barbers", plural: "Barbers", singular: "Barber" },
  Lashes: { slug: "lash-artists", plural: "Lash Artists", singular: "Lash Artist" },
  Brows: { slug: "brow-artists", plural: "Brow Artists", singular: "Brow Artist" },
  Nails: { slug: "nail-techs", plural: "Nail Techs", singular: "Nail Tech" },
  Makeup: { slug: "makeup-artists", plural: "Makeup Artists", singular: "Makeup Artist" },
  Photography: { slug: "photographers", plural: "Photographers", singular: "Photographer" },
  "Esthetician/Skincare": { slug: "estheticians", plural: "Estheticians", singular: "Esthetician" },
  "Hair Removal": { slug: "waxing", plural: "Waxing & Hair Removal Specialists", singular: "Waxing Specialist" },
  Massage: { slug: "massage-therapists", plural: "Massage Therapists", singular: "Massage Therapist" },
  "Body & Wellness": { slug: "wellness", plural: "Wellness Professionals", singular: "Wellness Professional" },
  "Tattoos & Piercings": { slug: "tattoo-piercing", plural: "Tattoo & Piercing Artists", singular: "Tattoo & Piercing Artist" },
  Fitness: { slug: "personal-trainers", plural: "Personal Trainers", singular: "Personal Trainer" },
  "Personal Styling": { slug: "personal-stylists", plural: "Personal Stylists", singular: "Personal Stylist" },
  Grooming: { slug: "grooming", plural: "Grooming Professionals", singular: "Grooming Professional" },
};

export function categorySeo(name: string): CategorySeo {
  return CATEGORY_SEO[name] ?? { slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), plural: `${name} Professionals`, singular: `${name} Professional` };
}
export const categoryBySlug = (slug: string, names: string[]) => names.find((n) => categorySeo(n).slug === slug) ?? null;

export type DirectoryPro = {
  userId: string; slug: string; business: string; personName: string | null; photo: string | null;
  fromCents: number | null; services: string[]; categories: string[]; rating: number | null; reviews: number;
};

/** Live professionals in a city, optionally only those offering a category — newest reviews/most services first. */
export async function cityPros(cityId: number, category?: string): Promise<DirectoryPro[]> {
  try {
    const { db, professionalProfiles, proServices, categories, reviews } = await import("@/db");
    const { liveProWhere } = await import("@/lib/search");
    const { MAX_PRICE_CENTS } = await import("@/lib/pricing");
    const { ensureProSlug } = await import("@/lib/connections");
    const pros = await db.select({ p: professionalProfiles }).from(professionalProfiles)
      .where(and(eq(professionalProfiles.cityId, cityId), ...liveProWhere(null, "place")));
    if (!pros.length) return [];
    const ids = pros.map((r) => r.p.userId);
    const [svc, rate] = await Promise.all([
      db.select({ userId: proServices.userId, name: proServices.name, price: proServices.priceCents, cat: categories.name }).from(proServices)
        .innerJoin(categories, eq(categories.id, proServices.categoryId))
        .where(and(inArray(proServices.userId, ids), eq(proServices.active, true), lte(proServices.priceCents, MAX_PRICE_CENTS), ne(proServices.showOn, "partner")))
        .orderBy(asc(proServices.sort)),
      db.select({ proId: reviews.proId, avg: sql<number>`avg(${reviews.rating})::float`, n: sql<number>`count(*)::int` }).from(reviews)
        .where(inArray(reviews.proId, ids)).groupBy(reviews.proId),
    ]);
    const out: DirectoryPro[] = [];
    for (const { p } of pros) {
      const mine = svc.filter((s) => s.userId === p.userId);
      const cats = [...new Set(mine.map((s) => s.cat))].filter((c) => c !== "Other");
      if (category && !cats.includes(category)) continue;
      if (!mine.length) continue;
      const inCat = category ? mine.filter((s) => s.cat === category) : mine;
      const r = rate.find((x) => x.proId === p.userId);
      out.push({
        userId: p.userId, slug: p.slug ?? (await ensureProSlug(p.userId)) ?? p.userId, business: p.businessName ?? p.displayName ?? "Professional",
        personName: p.displayName ?? null, photo: p.photoUrl ?? null,
        fromCents: inCat.length ? Math.min(...inCat.map((s) => s.price)) : null, services: inCat.slice(0, 4).map((s) => s.name), categories: cats,
        rating: r?.n ? Number(r.avg) : null, reviews: r?.n ?? 0,
      });
    }
    return out.sort((a, b) => b.reviews - a.reviews || b.services.length - a.services.length || a.business.localeCompare(b.business));
  } catch (e) {
    console.warn("directory unavailable —", (e as Error).message?.split("\n")[0]);
    return [];
  }
}

/** A professional's main category: the one they list the most services in. */
export async function mainCategory(userId: string): Promise<string | null> {
  const { db, proServices, categories } = await import("@/db");
  const rows = await db.select({ name: categories.name, n: sql<number>`count(*)::int` }).from(proServices)
    .innerJoin(categories, eq(categories.id, proServices.categoryId))
    .where(and(eq(proServices.userId, userId), eq(proServices.active, true), sql`${categories.name} <> 'Other'`))
    .groupBy(categories.name).orderBy(sql`count(*) desc`).limit(1);
  return rows[0]?.name ?? null;
}
