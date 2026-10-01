import Link from "next/link";
import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { db, professionalProfiles, proServices } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { bundleDays, isBooked, loadBundle } from "@/lib/bundles";
import { fmtDate, fmtTime, money } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { Tabs } from "@/components/Tabs";
import { Icon } from "@/components/Icon";

export const metadata = { title: "Book your bundle" };

/** Book each saved professional, inside the bundle's week. */
export default async function BookBundle({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireVerifiedStudent();
  const loaded = await loadBundle((await params).id, user.id);
  if (!loaded) notFound();
  const { bundle, items, cats } = loaded;
  const pros = items.length ? await db.select({ userId: professionalProfiles.userId, name: professionalProfiles.businessName }).from(professionalProfiles).where(inArray(professionalProfiles.userId, items.map((i) => i.item.proId))) : [];
  const svcs = items.length ? await db.select({ id: proServices.id, name: proServices.name }).from(proServices).where(inArray(proServices.id, items.map((i) => i.item.serviceId))) : [];
  const open = bundleDays(bundle).length > 0 && bundle.status !== "expired";
  const done = items.filter((i) => isBooked(i.booking)).length;
  return (
    <div className="scr">
      <TopBar title="Book your bundle" back={`/bundle/${bundle.id}`} />
      <div className="body">
        <h1 className="disp h1">{done === cats.length ? "Your bundle is booked." : "Book your bundle"}</h1>
        <p className="small muted p">Book each professional on a day during your week. {done} of {cats.length} booked. Credits and invite rewards can&apos;t be used on bundle bookings.</p>
        {cats.map((c) => {
          const row = items.find((i) => i.item.categoryId === c.id);
          if (!row) return <Link key={c.id} className="card small" href={`/bundle/${bundle.id}?cat=${c.id}`} style={{ textDecoration: "none", color: "inherit" }}><span className="b">{c.name}</span><span className="muted">Not saved yet — choose a professional</span></Link>;
          const booked = isBooked(row.booking);
          return (
            <div key={c.id} className={`card${booked ? " ok" : ""}`} style={{ gap: 6 }}>
              <div className="row between"><span className="eyebrow">{c.name}</span>{booked && <span className="tag ok"><Icon name="check" size="s" /> Booked</span>}</div>
              <div className="row between"><span className="b">{pros.find((p) => p.userId === row.item.proId)?.name ?? "Professional"}</span><span className="b">{money(row.item.priceCents)}</span></div>
              <span className="small">{svcs.find((s) => s.id === row.item.serviceId)?.name}</span>
              {booked && row.booking
                ? <Link className="link small" href={`/bookings/${row.booking.id}`}>{fmtDate(row.booking.startsAt, { weekday: "short", month: "short", day: "numeric" })} • {fmtTime(row.booking.startsAt)}</Link>
                : open && <Link className="btn sm" href={`/book/${row.item.serviceId}?bundle=${row.item.id}`}>Book</Link>}
            </div>
          );
        })}
        {!open && done < cats.length && <div className="card warn small"><span>This bundle&apos;s week has passed or it expired. Start a new bundle for a new week.</span></div>}
      </div>
      <Tabs kind="student" active="Explore" />
    </div>
  );
}
