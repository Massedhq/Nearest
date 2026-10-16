import "server-only";
import { and, eq, ne, or, sql } from "drizzle-orm";
import { db, prospects, prospectDrafts, users, professionalProfiles, categories, cities, cityCounties, counties, outreachSuppression } from "@/db";
import { normEmail, normPhone, resolvePlace, logProspect } from "./outreach";
import { normSocial } from "./lead-contributors";

/**
 * Screenshot leads: an owner uploads screenshots of a professional's Instagram / booking page / business flyer.
 * AI reads what's visible into a draft; the owner checks every field against the screenshots, fixes anything, and
 * approves it into a real prospect (their own recruiting, their own referral attribution). Drafts are never contacted.
 */

export const MAX_SCREENSHOTS = 5;
export const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024; // all screenshots together, after the browser shrinks them

export type DraftFields = {
  name: string; business: string; categoryId: number | null; otherServices: string;
  address: string; city: string; county: string; state: string; zip: string;
  email: string; phone: string; instagram: string; website: string; bookingLink: string;
  source: string; credentials: string; hours: string; notes: string;
};
export const EMPTY_FIELDS: DraftFields = {
  name: "", business: "", categoryId: null, otherServices: "", address: "", city: "", county: "", state: "TX", zip: "",
  email: "", phone: "", instagram: "", website: "", bookingLink: "", source: "Instagram", credentials: "", hours: "", notes: "",
};
export const SCREENSHOT_SOURCES = ["Instagram", "Facebook", "TikTok", "Google", "Website", "Booking site", "Flyer", "Other"];

const clip = (v: unknown, max = 300) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** "@KNZBeautyBar", "instagram.com/knzbeautybar/" → "knzbeautybar" */
export function igHandle(raw: string) {
  const v = raw.trim();
  const m = v.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i) ?? v.match(/^@?([A-Za-z0-9._]{1,30})$/);
  return m ? m[1].toLowerCase().replace(/\.$/, "") : "";
}
/** "469.608.1690" → "(469) 608-1690" (anything that isn't a 10-digit US number is left as typed). */
export function prettyPhone(raw: string) {
  const d = normPhone(raw);
  return d ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw.trim();
}
const webish = (raw: string) => {
  const v = raw.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return /^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v) ? v.toLowerCase() : "";
};

/** Cleans whatever the reader (or a person) put in, and matches the category to Nearest's list. */
export async function cleanFields(raw: Record<string, unknown>): Promise<DraftFields> {
  const cats = await db.select({ id: categories.id, name: categories.name }).from(categories);
  const catText = clip(raw.category, 80);
  const catId = Number(raw.categoryId);
  const cat = Number.isInteger(catId) && catId > 0 ? cats.find((c) => c.id === catId) : cats.find((c) => c.name.toLowerCase() === catText.toLowerCase());
  const state = clip(raw.state, 20).toUpperCase();
  const email = clip(raw.email, 160).toLowerCase();
  return {
    name: clip(raw.name, 120), business: clip(raw.business, 120), categoryId: cat?.id ?? null, otherServices: clip(raw.otherServices, 300),
    address: clip(raw.address, 200), city: clip(raw.city, 80), county: clip(raw.county, 80).replace(/\s+county$/i, ""),
    state: /^[A-Z]{2}$/.test(state) ? state : state === "TEXAS" ? "TX" : state.slice(0, 2) || "TX", zip: (clip(raw.zip, 10).match(/\d{5}/)?.[0]) ?? "",
    email: normEmail(email) ?? email, phone: prettyPhone(clip(raw.phone, 30)),
    instagram: igHandle(clip(raw.instagram, 80)), website: webish(clip(raw.website, 200)) || clip(raw.website, 200), bookingLink: webish(clip(raw.bookingLink, 200)) || clip(raw.bookingLink, 200),
    source: SCREENSHOT_SOURCES.includes(clip(raw.source, 40)) ? clip(raw.source, 40) : "Instagram",
    credentials: clip(raw.credentials, 200), hours: clip(raw.hours, 300), notes: clip(raw.notes, 1500),
  };
}

/** County from the city Nearest already knows; otherwise from the ZIP code (public ZIP + census lookups). */
export async function fillCounty(f: DraftFields): Promise<{ fields: DraftFields; from: string | null }> {
  if (f.county) return { fields: f, from: null };
  if (f.city) {
    const [row] = await db.select({ name: counties.name }).from(cities).innerJoin(cityCounties, eq(cityCounties.cityId, cities.id)).innerJoin(counties, eq(counties.id, cityCounties.countyId))
      .where(and(sql`lower(${cities.name}) = lower(${f.city})`, eq(cities.state, f.state || "TX"))).limit(1);
    if (row) return { fields: { ...f, county: row.name }, from: "city" };
  }
  if (f.zip) {
    const { lookupZip } = await import("./places");
    const z = await lookupZip(f.zip);
    if (!("error" in z) && z.county) return { fields: { ...f, county: z.county, city: f.city || z.city, state: f.state || z.state }, from: "zip" };
  }
  return { fields: f, from: null };
}

/** What still has to be filled in before the draft can be approved. */
export function draftProblems(f: DraftFields) {
  const out: string[] = [];
  if (!f.name) out.push("Professional or contact name");
  if (!f.categoryId) out.push("Service category");
  if (!f.city) out.push("City");
  if (!f.county) out.push("County");
  if (!f.state) out.push("State");
  if (f.email && !normEmail(f.email)) out.push("Email (doesn't look complete)");
  if (f.phone && !normPhone(f.phone)) out.push("Phone (needs 10 digits)");
  if (!normEmail(f.email) && !normPhone(f.phone) && !f.instagram && !normSocial(f.website)) out.push("At least one way to reach them (email, phone, Instagram or website)");
  return out;
}

const socialOf = (f: DraftFields) => (f.instagram ? `instagram.com/${f.instagram}` : f.website || f.bookingLink || "");

/** Someone already in Nearest with the same email, phone or social link (a prospect or a professional account). */
export async function draftDuplicate(f: DraftFields): Promise<{ kind: "prospect"; id: string; name: string; owner: string | null } | { kind: "professional"; id: string } | { kind: "suppressed" } | null> {
  const em = normEmail(f.email), ph = normPhone(f.phone), so = normSocial(socialOf(f));
  if (em || ph) {
    const sup = await db.select({ id: outreachSuppression.id }).from(outreachSuppression)
      .where(or(...(em ? [eq(outreachSuppression.emailNorm, em)] : []), ...(ph ? [eq(outreachSuppression.phoneNorm, ph)] : []))).limit(1);
    if (sup.length) return { kind: "suppressed" };
  }
  if (em || ph || so) {
    const [m] = await db.select({ id: prospects.id, name: prospects.name, owner: users.firstName }).from(prospects).leftJoin(users, eq(users.id, prospects.recruiterId))
      .where(and(ne(prospects.status, "duplicate"), or(...(em ? [eq(prospects.emailNorm, em)] : []), ...(ph ? [eq(prospects.phoneNorm, ph)] : []), ...(so ? [eq(prospects.socialNorm, so)] : [])))).limit(1);
    if (m) return { kind: "prospect", id: m.id, name: m.name, owner: m.owner };
  }
  if (em || ph) {
    const [pro] = await db.select({ id: users.id }).from(users).innerJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
      .where(or(...(em ? [sql`lower(${users.email}) = ${em}`] : []), ...(ph ? [sql`right(regexp_replace(coalesce(${users.phone}, ''), '\\D', '', 'g'), 10) = ${ph}`] : []))).limit(1);
    if (pro) return { kind: "professional", id: pro.id };
  }
  return null;
}

/** Turns an approved draft into a prospect. Returns an error instead if it isn't complete or is already in Nearest. */
export async function approveDraft(draftId: string, actorId: string): Promise<{ prospectId: string } | { error: string }> {
  const d = await db.query.prospectDrafts.findFirst({ where: eq(prospectDrafts.id, draftId) });
  if (!d || d.status !== "review") return { error: "This draft was already handled." };
  const f = d.fields as DraftFields;
  const missing = draftProblems(f);
  if (missing.length) return { error: `Fill in: ${missing.join(", ")}.` };
  const dup = await draftDuplicate(f);
  if (dup?.kind === "suppressed") return { error: "This person is on the do-not-contact list, so they can't be added." };
  if (dup?.kind === "professional") return { error: "This person already has a Nearest professional account — no need to recruit them." };
  if (dup?.kind === "prospect") return { error: `Already in Outreach as ${dup.name}${dup.owner ? ` (with ${dup.owner})` : ""}.` };
  const cat = f.categoryId ? await db.query.categories.findFirst({ where: eq(categories.id, f.categoryId) }) : null;
  const em = normEmail(f.email), ph = normPhone(f.phone), social = socialOf(f);
  const details = [
    f.otherServices && `Also offers: ${f.otherServices}`, f.credentials && `Credentials (as shown): ${f.credentials}`, f.address && `Address: ${f.address}${f.zip && !f.address.includes(f.zip) ? ` ${f.zip}` : ""}`,
    f.instagram && `Instagram: @${f.instagram}`, f.website && `Website: ${f.website}`, f.bookingLink && f.bookingLink !== f.website && `Booking link: ${f.bookingLink}`, f.hours && `Hours: ${f.hours}`, f.notes,
  ].filter(Boolean).join("\n");
  const [row] = await db.insert(prospects).values({
    recruiterId: d.recruiterId ?? actorId, name: f.name, business: f.business || null, city: f.city, county: f.county, state: f.state, cityId: await resolvePlace(f.city, f.state),
    category: cat?.name ?? null, categoryId: cat?.id ?? null, email: em ? f.email : null, emailNorm: em, phone: ph ? f.phone : null, phoneNorm: ph,
    socialUrl: social || null, socialNorm: normSocial(social), source: f.source || "Instagram", notes: details || null,
    status: em ? "approved" : "needs_info", // never ready for email outreach without an email
  }).returning();
  await db.update(prospectDrafts).set({ status: "approved", prospectId: row.id, decidedBy: actorId, decidedAt: new Date(), updatedAt: new Date() }).where(and(eq(prospectDrafts.id, d.id), eq(prospectDrafts.status, "review")));
  await logProspect(row.id, "added", `Added from ${(d.images as unknown[]).length === 1 ? "a screenshot" : "screenshots"} (read by AI, checked and approved).`, actorId);
  return { prospectId: row.id };
}

/** Owners see their own drafts; the main owner sees everyone's. */
export async function canSeeDraft(userId: string, recruiterId: string | null) {
  if (recruiterId === userId) return true;
  const { mainOwnerId } = await import("./partner");
  return (await mainOwnerId()) === userId;
}

// ---------------------------------------------------------------- AI reading

type Img = { data: Buffer; mime: string };

/** Asks the AI to read the screenshots. Only what's visible — never guesses contact details. */
export async function readScreenshots(images: Img[]): Promise<{ fields: Record<string, unknown>; unsure: string } | { error: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { error: "The AI reader isn't set up (ANTHROPIC_API_KEY is missing in Vercel), so fill in the details by hand." };
  const { AI_MODEL } = await import("./outreach-ai");
  const cats = (await db.select({ name: categories.name }).from(categories).where(eq(categories.active, true))).map((c) => c.name);
  const system = `You read screenshots of a beauty or wellness professional's public profile, booking page or business flyer, and pull out their business contact details for a recruiting list.
Rules:
- Use ONLY text that is visible in the screenshots. Never guess or invent an email, phone number, handle, address or name. If something isn't shown, use "".
- name: the professional's own name (e.g. "Kenzie Williams"; if only a first name is shown, use it). business: the business or brand name.
- category: the ONE best match from this list: ${cats.join(", ")}. An esthetician doing lashes and brows → "Lashes" (put the rest in otherServices).
- address/city/state/zip: from a street address or location line. Prefer the street address's city over a general area ("Dallas, TX" banner vs "Farmers Branch" address → city "Farmers Branch"). state as 2 letters. county only if it's written.
- instagram: the handle without @ (from the profile header, @mentions or the browser/app title). website: a business website or link-in-bio. bookingLink: a booking site (e.g. *.as.me, booksy, vagaro, glossgenius, square).
- source: where the screenshot is from: Instagram, Facebook, TikTok, Google, Website, Booking site, Flyer or Other.
- credentials: licensing exactly as they state it (e.g. "Licensed Esthetician") — their own claim, not verified.
- hours: business hours, short. otherServices: other services they mention. notes: one or two short lines of useful context (deposit/policies, specialties, follower count).
- unsure: list any field you weren't sure about or that looked cut off.
Reply with JSON only: {"name":"","business":"","category":"","otherServices":"","address":"","city":"","county":"","state":"","zip":"","email":"","phone":"","instagram":"","website":"","bookingLink":"","source":"","credentials":"","hours":"","notes":"","unsure":""}`;
  const content = [
    ...images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.mime, data: im.data.toString("base64") } })),
    { type: "text", text: `These ${images.length} screenshot${images.length === 1 ? " is" : "s are"} all of the same professional. Read their details.` },
  ];
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: AI_MODEL, max_tokens: 1200, system, messages: [{ role: "user", content }] }),
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) {
        const t = (await r.text()).slice(0, 200);
        lastError = r.status === 401 ? "The AI key was rejected (401)" : r.status === 404 ? `AI model "${AI_MODEL}" not found` : r.status === 400 && /credit|billing/i.test(t) ? "The AI account has no credit" : `AI service error ${r.status}`;
        if ([400, 401, 404].includes(r.status)) break;
      } else {
        const data = (await r.json()) as { content?: { type: string; text?: string }[] };
        const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("").trim();
        const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Record<string, unknown>;
        return { fields: json, unsure: clip(json.unsure, 500) };
      }
    } catch (e) { lastError = `AI request failed: ${(e as Error).message}`; }
    if (attempt === 0) await new Promise((res) => setTimeout(res, 1500));
  }
  console.error("screenshot reader", lastError);
  return { error: `${lastError} — fill in the details by hand.` };
}
