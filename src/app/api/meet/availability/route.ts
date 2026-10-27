import { MEET_CITIES, availability } from "@/lib/meet";

export const dynamic = "force-dynamic";

/** Public: open days and times, spots left per specialty, and the Starbucks list for one city (/meet). */
export async function GET(req: Request) {
  const city = new URL(req.url).searchParams.get("city") ?? "";
  if (!(MEET_CITIES as readonly string[]).includes(city)) return Response.json({ error: "Choose a city." }, { status: 400 });
  return Response.json(await availability(city), { headers: { "cache-control": "no-store" } });
}
