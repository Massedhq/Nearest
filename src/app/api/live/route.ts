import { NextResponse } from "next/server";
import { liveSnapshot, canSeeLive } from "@/lib/live/data";
import { MAPS } from "@/lib/live/maps";

export const dynamic = "force-dynamic";

/** Nearest LIVE feed — polled by the map every few seconds. Aggregates only. */
export async function GET(req: Request) {
  if (!(await canSeeLive())) return NextResponse.json({ error: "not available" }, { status: 404 });
  const state = (new URL(req.url).searchParams.get("state") ?? "TX").toUpperCase();
  if (!MAPS[state]) return NextResponse.json({ error: "unknown state" }, { status: 400 });
  return NextResponse.json(await liveSnapshot(state), { headers: { "cache-control": "no-store" } });
}
