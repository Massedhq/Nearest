import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, proServices, professionalProfiles } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { liveProWhere } from "@/lib/search";
import { openSlots, nextDays } from "@/lib/availability";
import { getFlag } from "@/lib/settings";
import { label12, money } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";

export const metadata = { title: "Choose a time" };

export default async function ChooseTime({ params, searchParams }: { params: Promise<{ serviceId: string }>; searchParams: Promise<{ day?: string }> }) {
  await requireVerifiedStudent();
  const { serviceId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(serviceId)) notFound();
  const svc = await db.query.proServices.findFirst({ where: and(eq(proServices.id, serviceId), eq(proServices.active, true)) });
  if (!svc) notFound();
  const [pro] = await db.select().from(professionalProfiles).where(and(eq(professionalProfiles.userId, svc.userId), ...liveProWhere(null, "all"))).limit(1);
  if (!pro) notFound();
  const open = await getFlag("status.bookings");
  const days = nextDays(14);
  const day = days.includes((await searchParams).day ?? "") ? (await searchParams).day! : days[0];
  const slots = open ? await openSlots(svc.userId, svc.durationMin, day) : [];
  const d = (s: string) => new Date(`${s}T12:00:00Z`);
  return (
    <div className="scr">
      <TopBar title="Choose your appointment" back={`/p/${svc.userId}`} />
      <div className="body">
        <div className="card"><div className="row between"><div><div className="b">{svc.name}</div><div className="small muted">{pro.businessName} • {svc.durationMin} min</div></div><span className="b">{money(svc.priceCents)}</span></div></div>
        {!open && <div className="card warn small"><span>Booking is paused right now. Please check back soon.</span></div>}
        <div className="scrollx" style={{ marginRight: 0, overflowX: "auto" }}>
          {days.map((x) => (
            <Link key={x} href={`/book/${svc.id}?day=${x}`} className={`slot${x === day ? " on" : ""}`} style={{ flexDirection: "column", height: 64, gap: 0, minWidth: 58, textDecoration: "none" }}>
              <span className="xs">{d(x).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</span>
              <span style={{ fontSize: 18 }}>{d(x).getUTCDate()}</span>
            </Link>
          ))}
        </div>
        <p className="disp" style={{ fontSize: 20, margin: 0 }}>{d(day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}</p>
        {slots.length ? (
          <div className="grid3">
            {slots.map((t) => <Link key={t} className="slot" href={`/book/${svc.id}/confirm?day=${day}&time=${t}`} style={{ textDecoration: "none" }}>{label12(t)}</Link>)}
          </div>
        ) : (
          open && <p className="small muted p">No open times this day. Try another date.</p>
        )}
        <div className="card small"><div className="row top-a"><Icon name="clock" /><span className="grow muted">Only times you can actually book are shown. Standard bookings need 24 hours&apos; notice. Same-day times come from the professional&apos;s Available Today openings and close at 12:00 PM.</span></div></div>
      </div>
    </div>
  );
}
