import { notFound } from "next/navigation";
import { liveSnapshot, canSeeLive } from "@/lib/live/data";
import { MAPS } from "@/lib/live/maps";
import { LiveMap } from "@/components/LiveMap";

export const metadata = { title: "Nearest LIVE — Your City Is Voting", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Nearest LIVE — the real-time student voting map (Texas first). Owners only until Rules & Settings → live.public is on. */
export default async function LivePage() {
  if (!(await canSeeLive())) notFound();
  const snap = await liveSnapshot("TX");
  const m = MAPS.TX;
  return <LiveMap initial={snap} outline={m.outline} width={m.width} height={m.height} />;
}
