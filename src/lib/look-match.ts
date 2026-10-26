import "server-only";
import { and, eq, gt, isNotNull, sql } from "drizzle-orm";
import { db, lookSearches, portfolioItems, professionalProfiles, proServices, cities, categories } from "@/db";
import { liveProWhere, type Area } from "./search";
import { LOOK_MODEL, bestSimilarity, packVectors, portfolioFingerprints, queryFingerprints, unpackVectors } from "./look-model";
import { MAX_PRICE_CENTS } from "./pricing";
import { personName } from "./pro-name";

/**
 * Find by photo. A student uploads an inspo photo; Nearest shows only the professionals whose OWN portfolio photos
 * closely match that exact look — never someone just because they list the service.
 *
 *  1. Every portfolio photo is fingerprinted on the server (look-model.ts) — cron, in small batches.
 *  2. The student's photo is fingerprinted the same way and compared with every live professional's photos in their
 *     market (and category, when picked). The closest photos make a shortlist.
 *  3. The AI (ANTHROPIC_API_KEY, same key as the AI recruiter) looks at the student's photo next to each shortlisted
 *     photo and scores how close it is to the SAME look (type, style, shape, length, colour, design). Only scores at or
 *     above match.min_score are shown. Without the AI, only near-identical photos (match.fallback_similarity) are shown.
 * The student's photo is never stored — it's used for this one search and discarded.
 */

const MAX_FETCH_BYTES = 15 * 1024 * 1024;

async function fetchImage(url: string, ms = 15000): Promise<Buffer> {
  // Sample photos are stored as site paths ("/demo/…"); everything else is a full Blob URL.
  const full = url.startsWith("/") ? `${process.env.APP_URL || "https://www.usenearest.com"}${url}` : url;
  const r = await fetch(full, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`photo download failed (${r.status})`);
  const len = Number(r.headers.get("content-length") ?? 0);
  if (len > MAX_FETCH_BYTES) throw new Error("photo is too large");
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_FETCH_BYTES) throw new Error("photo is too large");
  return buf;
}

async function settings() {
  const s = await (await import("./settings")).getSettings();
  const n = (k: string, d: number) => { const v = Number(s[k]); return Number.isFinite(v) ? v : d; };
  return {
    minScore: Math.min(10, Math.max(1, n("match.min_score", 7))),
    daily: Math.max(1, Math.round(n("match.daily_searches", 20))),
    shortlist: Math.min(20, Math.max(3, Math.round(n("match.shortlist", 12)))),
    fallback: Math.min(99, Math.max(50, n("match.fallback_similarity", 88))) / 100,
  };
}

// ---------------------------------------------------------------- indexing

/** Portfolio photos that still need fingerprints (new, model upgraded, or a failed try more than a day ago). */
const pendingWhere = sql`${portfolioItems.kind} = 'image' and ${portfolioItems.lookModel} is distinct from ${LOOK_MODEL}
  and (${portfolioItems.lookError} is null or ${portfolioItems.lookIndexedAt} < now() - interval '1 day')`;

/** Cron (and Admin → Find by photo → Index now): fingerprint waiting portfolio photos within a time budget. */
export async function indexPendingLooks(budgetMs = 40_000, limit = 60) {
  const started = Date.now();
  const rows = await db.select({ id: portfolioItems.id, url: portfolioItems.url }).from(portfolioItems).where(pendingWhere)
    .orderBy(sql`${portfolioItems.createdAt} desc`).limit(limit);
  let indexed = 0, failed = 0;
  for (const r of rows) {
    if (Date.now() - started > budgetMs) break;
    try {
      const vs = await portfolioFingerprints(await fetchImage(r.url));
      await db.update(portfolioItems).set({ lookVectors: packVectors(vs), lookModel: LOOK_MODEL, lookIndexedAt: new Date(), lookError: null }).where(eq(portfolioItems.id, r.id));
      indexed++;
    } catch (e) {
      failed++;
      await db.update(portfolioItems).set({ lookVectors: null, lookModel: null, lookIndexedAt: new Date(), lookError: String((e as Error).message ?? e).slice(0, 200) }).where(eq(portfolioItems.id, r.id));
    }
  }
  const [{ left }] = await db.select({ left: sql<number>`count(*)::int` }).from(portfolioItems).where(pendingWhere);
  return { indexed, failed, left };
}

export async function lookStats() {
  const [p] = await db.select({
    photos: sql<number>`count(*) filter (where ${portfolioItems.kind} = 'image')::int`,
    ready: sql<number>`count(*) filter (where ${portfolioItems.kind} = 'image' and ${portfolioItems.lookModel} = ${LOOK_MODEL})::int`,
    failed: sql<number>`count(*) filter (where ${portfolioItems.kind} = 'image' and ${portfolioItems.lookError} is not null)::int`,
  }).from(portfolioItems);
  const [s] = await db.select({
    week: sql<number>`count(*)::int`,
    withResults: sql<number>`count(*) filter (where ${lookSearches.results} > 0)::int`,
    ai: sql<number>`count(*) filter (where ${lookSearches.aiUsed})::int`,
  }).from(lookSearches).where(gt(lookSearches.createdAt, sql`now() - interval '7 days'`));
  return { ...p, waiting: p.photos - p.ready, ...s };
}

// ---------------------------------------------------------------- the AI look check

type AiVerdict = { look: string; scores: Map<number, { score: number; why: string }> } | { error: string };

async function aiCompare(inspo: Buffer, candidates: { url: string }[], category: string | null): Promise<AiVerdict> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { error: "AI key missing" };
  const sharp = (await import("sharp")).default;
  const small = (b: Buffer, px: number) => sharp(b, { failOn: "none" }).rotate().resize(px, px, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer().then((x) => x.toString("base64"));
  const ref = await small(inspo, 900);
  const imgs = await Promise.all(candidates.map(async (c) => { try { return await small(await fetchImage(c.url, 10000), 640); } catch { return null; } }));
  const content: unknown[] = [
    { type: "text", text: "REFERENCE — the client's inspiration photo:" },
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: ref } },
  ];
  imgs.forEach((d, i) => {
    if (!d) return;
    content.push({ type: "text", text: `CANDIDATE ${i + 1} — a photo of a professional's own work:` }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: d } });
  });
  content.push({ type: "text", text: `Score every candidate 0–10 for how closely it shows the SAME look as the reference${category ? ` (the client is looking for ${category})` : ""}.` });
  const system = `You match a client's inspiration photo to beauty professionals' portfolio photos for a booking app. The client wants someone who has done THIS look — not just the same kind of service.
Judge only the look itself, ignoring background, lighting, camera angle, skin tone, hands/face of the person and photo quality.
What counts as the same look depends on the service. Lashes: type (classic, hybrid, volume, mega volume, wet/wispy/spiky, anime), length, curl, density, mapping/shape (cat-eye, doll, squirrel, open-eye), colour. Nails: shape, length, base colour, technique (chrome, French, ombré, cat-eye, 3D, charms, hand-painted art), the design itself. Hair/braids/locs: style, size, length, parting, colour, finish. Brows: shape, thickness, technique (lamination, microblading, ombré, tint). Makeup: eye look, intensity, colours, lip, finish. Other services: the visible result.
Scale: 10 = practically identical look. 8–9 = same look with only tiny differences (a client would be happy). 6–7 = same style family but noticeable differences (length, colour, mapping or design differs). 3–5 = same service, different look. 0–2 = different service or not comparable.
Be strict: a client will only see candidates you score high, and showing the wrong look breaks their trust.
Reply ONLY with JSON: {"look":"<the reference look in under 12 words>","candidates":[{"n":<candidate number>,"score":<0-10>,"why":"<under 14 words: what matches or differs>"}]} — one entry for every candidate shown.`;
  try {
    const { AI_MODEL } = await import("./outreach-ai");
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 1500, system, messages: [{ role: "user", content }] }),
      signal: AbortSignal.timeout(50000),
    });
    if (!r.ok) return { error: `AI ${r.status}: ${(await r.text()).slice(0, 160)}` };
    const data = (await r.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("").trim();
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { look?: string; candidates?: { n: number; score: number; why?: string }[] };
    const scores = new Map<number, { score: number; why: string }>();
    for (const c of json.candidates ?? []) {
      const i = Number(c.n) - 1;
      if (Number.isInteger(i) && i >= 0 && i < candidates.length && imgs[i]) scores.set(i, { score: Math.max(0, Math.min(10, Number(c.score) || 0)), why: String(c.why ?? "").slice(0, 120) });
    }
    return { look: String(json.look ?? "").slice(0, 90), scores };
  } catch (e) {
    return { error: `AI request failed: ${(e as Error).message}` };
  }
}

// ---------------------------------------------------------------- search

export type LookMatch = {
  userId: string;
  name: string;
  businessName: string | null;
  photoUrl: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  score: number; // 0–10 (AI) or similarity × 10 without the AI
  label: "Very close match" | "Close match";
  why: string | null;
  photos: { url: string; bookHref: string | null; serviceName: string | null }[];
};

export type LookResult =
  | { ok: true; look: string | null; matches: LookMatch[]; compared: number; ai: boolean; waiting: boolean }
  | { ok: false; error: string };

export async function findLookMatches(o: { studentId: string; area: Area; image: Buffer; categoryId: number | null }): Promise<LookResult> {
  const cfg = await settings();
  const [{ used }] = await db.select({ used: sql<number>`count(*)::int` }).from(lookSearches)
    .where(and(eq(lookSearches.studentId, o.studentId), gt(lookSearches.createdAt, sql`now() - interval '24 hours'`)));
  if (used >= cfg.daily) return { ok: false, error: `You've used all ${cfg.daily} photo searches for today. Try again tomorrow.` };

  let query: Float32Array[];
  try { query = await queryFingerprints(o.image); } catch { return { ok: false, error: "We couldn't read that photo. Try a different one (JPG, PNG or HEIC from your camera roll)." }; }

  const catName = o.categoryId ? (await db.query.categories.findFirst({ where: eq(categories.id, o.categoryId), columns: { name: true } }))?.name ?? null : null;
  const where = [
    ...liveProWhere(o.area, "all"),
    eq(portfolioItems.kind, "image"),
    eq(portfolioItems.lookModel, LOOK_MODEL),
    isNotNull(portfolioItems.lookVectors),
  ];
  if (o.categoryId) {
    where.push(sql`exists (select 1 from ${proServices} s where s.user_id = ${professionalProfiles.userId} and s.active and s.price_cents <= ${MAX_PRICE_CENTS} and s.category_id = ${o.categoryId})`);
    // A photo tagged with a service in another category is about something else.
    where.push(sql`(${portfolioItems.serviceId} is null or exists (select 1 from ${proServices} s2 where s2.id = ${portfolioItems.serviceId} and s2.category_id = ${o.categoryId}))`);
  }
  const rows = await db.select({
    id: portfolioItems.id, userId: portfolioItems.userId, url: portfolioItems.url, vectors: portfolioItems.lookVectors,
    serviceId: portfolioItems.serviceId,
    serviceName: sql<string | null>`(select s.name from ${proServices} s where s.id = ${portfolioItems.serviceId} and s.active and s.price_cents <= ${MAX_PRICE_CENTS})`,
    businessName: professionalProfiles.businessName, displayName: professionalProfiles.displayName, photoUrl: professionalProfiles.photoUrl,
    firstName: sql<string | null>`(select first_name from users where users.id = ${professionalProfiles.userId})`,
    lastName: sql<string | null>`(select last_name from users where users.id = ${professionalProfiles.userId})`,
    city: cities.name, lat: professionalProfiles.lat, lng: professionalProfiles.lng,
  }).from(portfolioItems)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, portfolioItems.userId))
    .leftJoin(cities, eq(cities.id, professionalProfiles.cityId))
    .where(and(...where))
    .limit(6000);

  const [{ waitingCount }] = await db.select({ waitingCount: sql<number>`count(*)::int` }).from(portfolioItems).where(pendingWhere);
  const scored = rows.map((r) => ({ ...r, sim: bestSimilarity(query, unpackVectors(r.vectors!)) })).sort((a, b) => b.sim - a.sim);

  // Shortlist: the closest photos, at most 3 per professional, above a floor that rules out other services.
  const FLOOR = 0.55;
  const perPro = new Map<string, number>();
  const shortlist: typeof scored = [];
  for (const r of scored) {
    if (r.sim < FLOOR || shortlist.length >= cfg.shortlist) break;
    const n = perPro.get(r.userId) ?? 0;
    if (n >= 3) continue;
    perPro.set(r.userId, n + 1);
    shortlist.push(r);
  }

  let look: string | null = null;
  let ai = false;
  let error: string | null = null;
  let kept: { r: (typeof shortlist)[number]; score: number; why: string | null }[] = [];
  if (shortlist.length) {
    const v = await aiCompare(o.image, shortlist, catName);
    if ("error" in v) {
      error = v.error;
      kept = shortlist.filter((r) => r.sim >= cfg.fallback).map((r) => ({ r, score: Math.round(r.sim * 100) / 10, why: null }));
    } else {
      ai = true;
      look = v.look || null;
      kept = shortlist.flatMap((r, i) => { const s = v.scores.get(i); return s && s.score >= cfg.minScore ? [{ r, score: s.score, why: s.why || null }] : []; });
    }
  }

  const byPro = new Map<string, LookMatch>();
  for (const k of kept.sort((a, b) => b.score - a.score || b.r.sim - a.r.sim)) {
    const r = k.r;
    const photo = { url: r.url, bookHref: r.serviceName && r.serviceId ? `/book/${r.serviceId}` : null, serviceName: r.serviceName };
    const m = byPro.get(r.userId);
    if (m) { if (m.photos.length < 3) m.photos.push(photo); continue; }
    byPro.set(r.userId, {
      userId: r.userId, name: personName(r.displayName, r.firstName, r.lastName), businessName: r.businessName, photoUrl: r.photoUrl,
      city: r.city, lat: r.lat, lng: r.lng, score: k.score, label: k.score >= Math.max(cfg.minScore + 1, 9) ? "Very close match" : "Close match", why: k.why, photos: [photo],
    });
  }
  const matches = [...byPro.values()];
  await db.insert(lookSearches).values({ studentId: o.studentId, categoryId: o.categoryId, detected: look, compared: rows.length, results: matches.length, aiUsed: ai, error })
    .catch((e) => console.error("look search log", e));
  return { ok: true, look, matches, compared: rows.length, ai, waiting: waitingCount > 0 };
}
