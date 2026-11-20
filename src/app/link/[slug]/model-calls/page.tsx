import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { db, modelCalls } from "@/db";
import { PartnerBookShell, PS, P_ACCENT, P_GOLD } from "@/components/PartnerBookShell";
import { ModelCallGallery } from "@/components/ModelCallGallery";
import { partnerForBooking } from "@/lib/partner-booking";
import { PARTNER_SIDE_SQL, callPhotos, callCharge } from "@/lib/model-calls";
import { fmtDate, fmtTime, money } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Model Calls", robots: { index: false, follow: false } };

/**
 * Partner page Model Calls (2026-11-20, owner): THIS partner's public Model Calls (show_on partner/both, with an
 * inspiration photo) at the PUBLIC price. Open to anyone 18+ through the partner's own booking — never a student account.
 */
export default async function PartnerModelCalls({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const x = await partnerForBooking(slug);
  if (!x) notFound();
  const calls = await db.select().from(modelCalls)
    .where(and(eq(modelCalls.userId, x.pro.userId), eq(modelCalls.status, "open"), gt(modelCalls.startsAt, new Date()), sql`${modelCalls.spotsTaken} < ${modelCalls.spots}`, PARTNER_SIDE_SQL))
    .orderBy(asc(modelCalls.startsAt));
  return (
    <PartnerBookShell name={x.name} photo={x.pro.photoUrl} back={x.base}>
      <span style={PS.eyebrow}>Now casting</span>
      <h2 style={{ ...PS.h1, fontSize: 36 }}>Model Calls</h2>
      <span style={{ fontSize: 14, color: "#D9D4CA", lineHeight: 1.5 }}>{x.name} is looking for models for these looks. Swipe the photos, then claim your spot.</span>
      {calls.length === 0 ? (
        <div style={{ ...PS.card, alignItems: "flex-start" }}>
          <b>None open right now</b>
          <span style={PS.muted}>Check back soon, or book a regular appointment.</span>
          <Link href={`${x.base}/book`} style={PS.btn}>Book an appointment</Link>
        </div>
      ) : calls.map((c) => {
        const left = c.spots - c.spotsTaken;
        const pay = callCharge(c, "partner");
        return (
          <article key={c.id} style={{ ...PS.card, padding: 0, gap: 0, overflow: "hidden" }}>
            <ModelCallGallery photos={callPhotos(c)} video={c.videoUrl} alt={`${c.serviceName} by ${x.name}`} radius={0} />
            <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 24, lineHeight: 1.05 }}>{c.serviceName}</span>
                  <span style={{ fontSize: 12, color: "#B8B2A7" }}>{c.flexible ? `Pick your time · through ${fmtDate(c.startsAt, { month: "short", day: "numeric" })}` : `${fmtDate(c.startsAt, { weekday: "short", month: "short", day: "numeric" })} · ${fmtTime(c.startsAt)}`} · {c.durationMin} min</span>
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <b style={{ fontSize: 20 }}>{pay.totalCents === 0 ? "Free" : money(pay.totalCents)}</b>
                  {pay.deposit && <span style={{ fontSize: 11, color: P_GOLD, fontWeight: 800 }}>{money(pay.onlineCents)} to book</span>}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#0B0B0C", background: P_ACCENT, borderRadius: 999, padding: "4px 10px" }}>{left} spot{left === 1 ? "" : "s"} left</span>
                {(c.requirements ?? []).map((r) => <span key={r} style={{ fontSize: 11, color: "#D9D4CA", border: "1px solid #3A3A3F", borderRadius: 999, padding: "4px 10px" }}>{r}</span>)}
              </div>
              <Link href={`${x.base}/model-calls/${c.id}`} style={PS.btn}>View &amp; claim this spot</Link>
            </div>
          </article>
        );
      })}
    </PartnerBookShell>
  );
}
