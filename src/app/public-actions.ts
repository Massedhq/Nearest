"use server";
import { and, asc, eq, sql } from "drizzle-orm";
import { headers, cookies } from "next/headers";
import { db, cities, categories, locationInterest, professionalProfiles } from "@/db";

export type CityStatus = {
  query: string; found: boolean; city: string; state: string; zip: string | null; cityId: number | null;
  live: boolean; enrolling: boolean; categories: { id: number; name: string; status: "first_in" | "open" | "full" }[];
  error?: string;
};

const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/**
 * Public city checker. "City, ST", "City" or a 5-digit ZIP → the city's real status:
 * live for student bookings (a professional is live there) · open for professionals (the city is set up in Nearest,
 * per-category spots shown) · not open yet. Nothing about individual people is returned.
 */
export async function checkCity(raw: string): Promise<CityStatus> {
  const query = clip(raw, 80);
  const empty: CityStatus = { query, found: false, city: "", state: "", zip: null, cityId: null, live: false, enrolling: false, categories: [] };
  if (query.length < 2) return { ...empty, error: "Enter a city, or a 5-digit ZIP code." };
  let name = query, state = "", zip: string | null = null;
  if (/^\d{5}$/.test(query)) {
    zip = query;
    try {
      const r = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal: AbortSignal.timeout(6000), cache: "no-store" });
      const j = r.ok ? ((await r.json()) as { places?: { "place name": string; "state abbreviation": string }[] }) : null;
      const p = j?.places?.[0];
      if (!p) return { ...empty, zip, error: "We couldn't find that ZIP code. Try your city name." };
      name = p["place name"]; state = p["state abbreviation"];
    } catch { return { ...empty, zip, error: "ZIP lookup isn't responding right now. Try your city name, like \"Atlanta, GA\"." }; }
  } else {
    const m = query.match(/^(.+?)[,\s]+([A-Za-z]{2})$/);
    if (m) { name = m[1].trim(); state = m[2].toUpperCase(); }
  }
  const rows = await db.select({ id: cities.id, name: cities.name, state: cities.state, active: cities.active }).from(cities)
    .where(and(sql`lower(${cities.name}) = lower(${name})`, ...(state ? [eq(cities.state, state)] : []))).orderBy(asc(cities.state)).limit(5);
  const c = rows.find((r) => r.active) ?? null;
  if (!c) return { ...empty, city: name, state, zip };
  const { liveProWhere } = await import("@/lib/search");
  const [live] = await db.select({ n: sql<number>`count(*)::int` }).from(professionalProfiles).where(and(eq(professionalProfiles.cityId, c.id), ...liveProWhere(null, "place")));
  const { cityOpenings } = await import("@/lib/public/locations");
  const cats = await db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.active, true));
  const openings = (await cityOpenings(c.id)).map((o) => ({ ...o, id: cats.find((k) => k.name === o.name)?.id ?? 0 })).filter((o) => o.id);
  return { query, found: true, city: c.name, state: c.state, zip, cityId: c.id, live: live.n > 0, enrolling: openings.some((o) => o.status !== "full"), categories: openings };
}

/**
 * "Tell me when Nearest opens here" — opt-in only. Saves one record per email + role + city (a repeat updates it).
 * Never subscribes anyone to marketing automatically; owners see these in Admin → Outreach → City interest.
 */
export async function saveCityInterest(_: { ok?: string; error?: string }, form: FormData): Promise<{ ok?: string; error?: string }> {
  if (clip(form.get("website"), 10)) return { ok: "Thanks!" }; // honeypot
  const role = clip(form.get("role"), 20);
  if (!["professional", "student", "parent"].includes(role)) return { error: "Choose whether you're a professional, a student or a parent." };
  const email = clip(form.get("email"), 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email)) return { error: "Enter a valid email address." };
  const city = clip(form.get("city"), 80), state = clip(form.get("state"), 2).toUpperCase();
  if (!city || !/^[A-Z]{2}$/.test(state)) return { error: "Enter your city and two-letter state." };
  if (form.get("consent") !== "on") return { error: "Tick the box so we can email you about Nearest in your city." };
  const categoryId = Number(form.get("categoryId")) || null;
  const cityId = Number(form.get("cityId")) || null;
  const status = clip(form.get("status"), 20) || "not_open";
  const consent = role === "professional"
    ? "I agree that Nearest may email me about joining Nearest as a professional in my city. I can ask to stop at any time."
    : "I agree that Nearest may email me when Nearest is available in my city. I can ask to stop at any time.";
  const h = await headers();
  const ref = (await cookies()).get("nearest_ref")?.value;
  const source = clip([new URL(h.get("referer") ?? "https://x/").pathname, ref ? `ref=${ref}` : ""].filter(Boolean).join(" "), 120) || null;
  await db.insert(locationInterest).values({
    role, name: clip(form.get("name"), 80) || null, email, emailNorm: email, city, state, zip: clip(form.get("zip"), 5) || null, cityId, categoryId, status, consent, source,
  }).onConflictDoUpdate({ target: [locationInterest.emailNorm, locationInterest.role, locationInterest.city, locationInterest.state], set: { categoryId, status, consent, createdAt: new Date() } });
  return { ok: role === "professional" ? "Thanks — you're on the list for your city. Nearest will contact you if enrollment opens for your service there." : "Thanks — we'll email you when students can book in your city." };
}
