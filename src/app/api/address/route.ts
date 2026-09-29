import { US_STATES } from "@/lib/markets";

export const dynamic = "force-dynamic";

type Suggestion = { label: string; street: string; city: string; state: string; zip: string };
const cache = new Map<string, { at: number; list: Suggestion[] }>();
const abbr = (name: string) => US_STATES.find(([a, n]) => n.toLowerCase() === name.toLowerCase() || a === name.toUpperCase())?.[0] ?? name;

/**
 * Address suggestions while typing (street → full address). Uses Photon (OpenStreetMap), free and keyless,
 * biased toward Dallas–Fort Worth. Returns U.S. street addresses only.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 4 || !/\d/.test(q)) return Response.json({ list: [] }); // needs a house number to be useful
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 3600_000) return Response.json({ list: hit.list });
  try {
    const api = new URL("https://photon.komoot.io/api/");
    api.searchParams.set("q", q);
    api.searchParams.set("limit", "8");
    api.searchParams.set("lang", "en");
    api.searchParams.set("lat", url.searchParams.get("lat") ?? "32.95");
    api.searchParams.set("lon", url.searchParams.get("lon") ?? "-96.85");
    api.searchParams.append("layer", "house");
    const r = await fetch(api, { headers: { "User-Agent": "Nearest (usenearest.com)" }, signal: AbortSignal.timeout(4000) });
    if (!r.ok) return Response.json({ list: [] });
    const data = (await r.json()) as { features?: { properties: Record<string, string> }[] };
    const seen = new Set<string>();
    const list: Suggestion[] = [];
    for (const f of data.features ?? []) {
      const p = f.properties;
      if ((p.countrycode ?? "").toUpperCase() !== "US" || !p.housenumber || !p.street) continue;
      const street = `${p.housenumber} ${p.street}`;
      const city = p.city ?? p.town ?? p.village ?? p.district ?? "";
      const state = abbr(p.state ?? "");
      const zip = (p.postcode ?? "").slice(0, 5);
      const label = [street, city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      if (seen.has(label)) continue;
      seen.add(label);
      list.push({ label, street, city, state, zip });
      if (list.length === 5) break;
    }
    cache.set(key, { at: Date.now(), list });
    if (cache.size > 2000) cache.delete(cache.keys().next().value!);
    return Response.json({ list });
  } catch {
    return Response.json({ list: [] }); // typing still works if suggestions are unavailable
  }
}
