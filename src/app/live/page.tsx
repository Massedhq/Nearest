import Link from "next/link";
import { notFound } from "next/navigation";
import { liveSnapshot, canSeeLive } from "@/lib/live/data";
import { MAPS } from "@/lib/live/maps";
import { LiveMap } from "@/components/LiveMap";

export const metadata = { title: "Nearest LIVE — Your City Is Voting", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Nearest LIVE — the real-time student voting map (Texas first). Owners only until Rules & Settings → live.public is on. */
/** Only Field team pages may be the "Back" target (the map opens in the same window, so phones have a way back). */
const BACKS = ["/outreach/map", "/admin/field/map", "/admin/live", "/admin"];

export default async function LivePage({ searchParams }: { searchParams: Promise<{ back?: string }> }) {
  const { back } = await searchParams;
  const backTo = back && BACKS.includes(back) ? back : null;
  if (!(await canSeeLive())) notFound();
  const snap = await liveSnapshot("TX");
  const m = MAPS.TX;
  const map = <LiveMap initial={snap} outline={m.outline} width={m.width} height={m.height} />;
  if (!backTo) return map;
  return (
    <div style={{ background: "#050506" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 16px 0" }}>
        <Link href={backTo} className="btn ghost sm" style={{ width: "auto", display: "inline-flex" }}>{backTo === "/admin" ? "← Back to Admin" : backTo === "/admin/live" ? "← Back" : "← Back to Field team"}</Link>
      </div>
      {map}
    </div>
  );
}
