import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { db, modelCalls } from "@/db";
import { PartnerBookShell, PS, P_ACCENT } from "@/components/PartnerBookShell";
import { partnerForBooking } from "@/lib/partner-booking";
import { fmtDate, fmtTime, money } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Model Calls", robots: { index: false, follow: false } };

/**
 * Partner side Model Calls (2026-11-18, owner): the Model Calls tile on /link/<slug> stays in the partner's own pages
 * (never the student profile). Lists THIS partner's open Model Calls in the partner look; claiming a spot is for verified
 * students, so "Claim this spot" opens the normal student checkout (/book/call/<id>).
 */
export default async function PartnerModelCalls({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const x = await partnerForBooking(slug);
  if (!x || !x.r.page.studentSide) notFound();
  const calls = await db.select().from(modelCalls)
    .where(and(eq(modelCalls.userId, x.pro.userId), eq(modelCalls.status, "open"), gt(modelCalls.startsAt, new Date()), sql`${modelCalls.spotsTaken} < ${modelCalls.spots}`))
    .orderBy(asc(modelCalls.startsAt));
  return (
    <PartnerBookShell name={x.name} photo={x.pro.photoUrl} back={x.base}>
      <h2 style={PS.h1}>Model Calls</h2>
      <span style={{ fontSize: 14, color: "#D9D4CA", lineHeight: 1.5 }}>{x.name} is looking for models. Model Calls are for verified students — you&apos;ll sign in with your student account to claim a spot.</span>
      {calls.length === 0 ? (
        <div style={{ ...PS.tile, flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
          <b>None open right now</b>
          <span style={PS.muted}>Check back soon, or book a regular appointment.</span>
          <Link href={`${x.base}/book`} style={{ ...PS.btn, textDecoration: "none", textAlign: "center", alignSelf: "stretch" }}>Book an appointment</Link>
        </div>
      ) : calls.map((c) => {
        const left = c.spots - c.spotsTaken;
        return (
          <div key={c.id} style={{ ...PS.tile, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {c.photoUrl
                ? <Image src={c.photoUrl} alt={`${c.serviceName} model call by ${x.name}`} width={64} height={64} style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", flex: "none" }} />
                : <span style={{ width: 64, height: 64, borderRadius: 10, background: "#1C1C1F", flex: "none" }} />}
              <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{c.serviceName}</span>
                <span style={{ fontSize: 12, opacity: 0.8 }}>{c.flexible ? `Pick your time · open until ${fmtDate(c.startsAt)}` : `${fmtDate(c.startsAt)} · ${fmtTime(c.startsAt)}`} · {c.durationMin} min</span>
                <span style={{ fontSize: 12, color: P_ACCENT, fontWeight: 800 }}>{left} spot{left === 1 ? "" : "s"} left</span>
              </span>
              <b style={{ fontSize: 16 }}>{money(c.priceCents)}</b>
            </div>
            {c.requirements?.length ? <span style={PS.muted}>Requirements: {c.requirements.join(" · ")}</span> : null}
            {c.about && <span style={{ fontSize: 13, color: "#D9D4CA", lineHeight: 1.45 }}>{c.about}</span>}
            <Link href={`/book/call/${c.id}`} style={{ ...PS.btn, textDecoration: "none", textAlign: "center" }}>Claim this spot</Link>
          </div>
        );
      })}
    </PartnerBookShell>
  );
}
